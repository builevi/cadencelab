"""Regression and synthetic validation; no claim about real-world accuracy."""
import dataclasses
import json
import subprocess
import sys
import unittest
from pathlib import Path
import numpy as np
from fastapi.testclient import TestClient
from apps.api.main import app
from packages.algo_core.cfi import CFIEngine
from packages.algo_core.seir_f import SEIRFEngine
from packages.algo_core.content_gaps import ContentGapEngine


class CFITests(unittest.TestCase):
    def setUp(self):
        self.engine = CFIEngine()

    def test_zero_signals_are_flagged_even_during_hook(self):
        slices = self.engine.compute_cfi([0]*10, [0]*10, [0]*10)
        summary = self.engine.summarize_retention_profile(slices)
        self.assertEqual(slices[0].stage, 'HOOK')
        self.assertEqual(slices[0].zone, 'BOREDOM_VALLEY')
        self.assertEqual(summary['overall_grade'], 'F')
        self.assertEqual(summary['boredom_valleys_count'], 1)
        self.assertEqual(summary['review_points'], [0.0])
        self.assertIsNone(summary['predicted_completion_rate'])
        self.assertEqual(summary['critical_drop_points'], [])

    def test_single_slice_supported(self):
        self.assertEqual(len(self.engine.compute_cfi([.5], [.5], [.5])), 1)

    def test_static_but_semantic_content_is_not_automatic_boredom(self):
        slices = self.engine.compute_cfi([0]*10, [0]*10, [1]*10)
        self.assertTrue(all(s.zone != 'BOREDOM_VALLEY' for s in slices))

    def test_hook_does_not_hide_high_load(self):
        self.assertEqual(self.engine.compute_cfi([1], [1], [1])[0].zone, 'OVERLOAD')

    def test_derivative_uses_seconds(self):
        ramp = np.linspace(.2, .6, 9)
        faster = self.engine.compute_cfi(ramp, ramp, ramp, .5)
        slower = self.engine.compute_cfi(ramp, ramp, ramp, 1)
        self.assertGreater(faster[4].cfi_score, slower[4].cfi_score)
        # Same physical ramp sampled at twice the frequency has same midpoint score.
        dense = np.linspace(.2, .6, 17)
        resampled = self.engine.compute_cfi(dense, dense, dense, .25)
        self.assertAlmostEqual(faster[4].cfi_score, resampled[8].cfi_score)

    def test_invalid_inputs_rejected(self):
        for a,b,c,step in [([],[],[],.5), ([0],[0,1],[0],.5),
                           ([float('nan')],[0],[0],.5), ([2],[0],[0],.5),
                           ([0],[0],[0],0), ([[0]],[[0]],[[0]],.5)]:
            with self.subTest(a=a, step=step), self.assertRaises(ValueError):
                self.engine.compute_cfi(a,b,c,step)

    def test_repeated_analysis_is_deterministic_and_bounded(self):
        rng = np.random.default_rng(100)
        features = rng.uniform(0,1,(3,1000))
        first = self.engine.compute_cfi(*features)
        self.assertEqual(first, self.engine.compute_cfi(*features))
        self.assertTrue(all(0 <= s.cfi_score <= 1 for s in first))


class SEIRTests(unittest.TestCase):
    def setUp(self):
        self.engine = SEIRFEngine()

    def test_mass_and_nonnegativity(self):
        initial = self.engine._initial(100, 200)
        self.assertEqual(sum(initial[:4]), self.engine.N)
        states = self.engine._solve(initial, np.arange(61))
        np.testing.assert_allclose(states[:,:4].sum(axis=1), self.engine.N, atol=.01)
        self.assertTrue(np.all(states >= 0))

    def test_future_days_and_horizon_invariance(self):
        short = self.engine.forecast_trend_trajectory(days=7)
        long = self.engine.forecast_trend_trajectory(days=60)
        states = self.engine._solve(self.engine._initial(100,200), np.array([0.,1.]))
        self.assertAlmostEqual(short[0].active_spreaders, states[1,2], places=3)
        self.assertEqual([x.day for x in short], list(range(1,8)))
        np.testing.assert_allclose([x.active_virality for x in short],
                                   [x.active_virality for x in long[:7]], rtol=2e-6)
        self.assertEqual([x.trend_phase for x in short], [x.trend_phase for x in long[:7]])

    def test_inactive_scenario_is_finite(self):
        output = self.engine.forecast_trend_trajectory(initial_infected=0, days=5)
        self.assertTrue(all(x.trend_phase == 'INACTIVE' and x.active_spreaders == 0 for x in output))
        json.dumps([dataclasses.asdict(x) for x in output], allow_nan=False)

    def test_fit_and_synthetic_holdout(self):
        truth = SEIRFEngine(transmission_rate=.65)
        states = truth._solve(truth._initial(200,400), np.arange(36))
        fitted = self.engine.forecast_from_observations(states[:28,2], days=8)
        predicted = np.array([x.active_spreaders for x in fitted['trajectory']])
        actual = states[28:,2]
        mae = np.mean(np.abs(predicted-actual))
        naive_mae = np.mean(np.abs(states[27,2]-actual))
        self.assertLess(mae, naive_mae)
        self.assertLess(mae / np.mean(actual), .02)
        self.assertAlmostEqual(fitted['fit']['transmission_rate'], .65, places=3)
        self.assertEqual(fitted['uncertainty_status'], 'not_calibrated')

    def test_different_observations_change_forecast(self):
        rising = self.engine.forecast_from_observations(np.geomspace(100,1000,14), 3)
        falling = self.engine.forecast_from_observations(np.geomspace(1000,100,14), 3)
        self.assertNotAlmostEqual(rising['trajectory'][0].active_spreaders,
                                  falling['trajectory'][0].active_spreaders)

    def test_invalid_history_and_population(self):
        for observations in [[], [1]*6, [0]*7, [1]*6+[np.nan], [1]*6+[-1], [1e8]*7]:
            with self.subTest(observations=observations), self.assertRaises(ValueError):
                self.engine.forecast_from_observations(observations)
        for days in [0, -1, 1.5, True, 366]:
            with self.subTest(days=days), self.assertRaises(ValueError):
                self.engine.forecast_trend_trajectory(days=days)
        with self.assertRaises(ValueError):
            self.engine.forecast_trend_trajectory(initial_infected=self.engine.N)


class GapTests(unittest.TestCase):
    def setUp(self):
        self.engine = ContentGapEngine()
        self.corpus = np.array([[1.,0.,0.],[0.,1.,0.]])
        self.labels = ['A','B']
        self.query = {'query':'How to do C?', 'embedding':[0.,0.,1.],
                      'demand_count':20, 'source_urls':['https://example.com/question/1']}

    def discover(self, queries, corpus=None):
        return self.engine.discover_whitespaces(self.corpus if corpus is None else corpus,
                                                self.labels, queries)

    def test_no_evidence_means_no_opportunities(self):
        self.assertEqual(self.discover([]), [])
        with self.assertRaises(ValueError):
            self.discover([{**self.query, 'source_urls':[]}])

    def test_demand_increases_score_not_probability(self):
        low = self.discover([{**self.query, 'demand_count':1}])[0]
        high = self.discover([self.query])[0]
        self.assertLess(low.market_opportunity_score, high.market_opportunity_score)
        self.assertEqual(high.supporting_sources, self.query['source_urls'])
        self.assertEqual(high.void_center_coordinates, [])
        self.assertNotIn('thường xuyên tìm kiếm', high.audience_demand_signal)

    def test_covered_question_is_not_reported_as_gap(self):
        self.assertEqual(self.discover([{**self.query,'embedding':[1.,0.,0.]}]), [])

    def test_scale_and_row_order_invariance(self):
        expected = self.discover([self.query])
        self.assertEqual(expected, self.discover([{**self.query, 'embedding':[0,0,17]}], self.corpus*.1))
        actual = self.engine.discover_whitespaces(self.corpus[::-1], self.labels[::-1], [self.query])
        self.assertEqual(expected, actual)

    def test_duplicate_query_does_not_inflate_demand(self):
        self.assertEqual(self.discover([self.query]), self.discover([self.query, self.query]))
        self.assertEqual(self.discover([self.query]), self.discover([
            self.query, {**self.query, 'query':'  HOW to do C?  ', 'demand_count':2}]))

    def test_invalid_embeddings_and_counts(self):
        for update in [{'embedding':[0,0,0]}, {'embedding':[1,0]},
                       {'embedding':[np.nan,0,1]}, {'demand_count':0},
                       {'demand_count':True}, {'source_urls':['not-a-url']}]:
            with self.subTest(update=update), self.assertRaises(ValueError):
                self.discover([{**self.query,**update}])
        with self.assertRaises(ValueError):
            self.discover([self.query], np.zeros((2,3)))


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_import_from_documented_working_directory(self):
        root = Path(__file__).resolve().parents[1]
        subprocess.run([sys.executable, '-c', 'from main import app; assert app.version == "0.2.0"'],
                       cwd=root/'apps/api', check=True, capture_output=True)

    def test_live_feature_analysis(self):
        response = self.client.post('/api/v1/cfi/analyze', json={
            'visual_motion':[0]*10,'acoustic_flux':[0]*10,'semantic_density':[0]*10})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['summary']['overall_grade'],'F')
        self.assertIsNone(response.json()['summary']['predicted_completion_rate'])

    def test_invalid_requests_return_422(self):
        cases = [('/api/v1/cfi/analyze',{'visual_motion':[0],'acoustic_flux':[0,1],'semantic_density':[0]}),
                 ('/api/v1/trend/forecast',{'trend_keyword':'x','daily_active_spreaders':[1]*6}),
                 ('/api/v1/trend/forecast',{'trend_keyword':'x','daily_active_spreaders':[0]*7}),
                 ('/api/v1/whitespaces/discover',{'embeddings':[[1,0]],'cluster_labels':['A'],
                    'embedding_model':'test','unanswered_queries':[{'query':'Q','embedding':[0,1],
                    'demand_count':1,'source_urls':['invalid']}]}),
                 ('/api/v1/whitespaces/discover',{'embeddings':[[1,0],[1]],'cluster_labels':['A','B'],
                    'embedding_model':'test'})]
        for path, body in cases:
            with self.subTest(path=path, body=body):
                self.assertEqual(self.client.post(path,json=body).status_code,422)
        self.assertEqual(self.client.post('/api/v1/cfi/simulate?video_seconds=-1').status_code,422)
        self.assertEqual(self.client.post('/api/v1/trend/simulate?days=0').status_code,422)
        self.assertEqual(self.client.post('/api/v1/trend/forecast?trend_keyword=test').status_code,422)

    def test_synthetic_demo_labeled_and_rng_isolated(self):
        np.random.seed(17)
        expected = np.random.random()
        np.random.seed(17)
        response = self.client.post('/api/v1/cfi/simulate')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['mode'],'synthetic_demo')
        self.assertEqual(np.random.random(),expected)

    def test_data_driven_trend_api(self):
        response = self.client.post('/api/v1/trend/forecast',json={
            'trend_keyword':'test','daily_active_spreaders':[100,120,150,180,210,250,300], 'days':3})
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.json()['trajectory']),3)
        self.assertEqual(response.json()['mode'],'fitted_conditional_scenario')

    def test_gap_missing_demand_is_explicit(self):
        response = self.client.post('/api/v1/whitespaces/discover',json={
            'embeddings':[[1,0]],'cluster_labels':['A'],'embedding_model':'fixture-v1'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['discovered_whitespaces'],[])
        self.assertEqual(response.json()['evidence_status'],'missing_demand_data')

    def test_gap_evidence_passes_through(self):
        response = self.client.post('/api/v1/whitespaces/discover',json={
            'embeddings':[[1,0]],'cluster_labels':['A'],'embedding_model':'fixture-v1',
            'unanswered_queries':[{'query':'Q','embedding':[0,1],'demand_count':10,
                                  'source_urls':['https://example.com/q']} ]})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['discovered_whitespaces'][0]['supporting_sources'],['https://example.com/q'])


if __name__ == '__main__':
    unittest.main()
