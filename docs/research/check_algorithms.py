"""Current-engine probes; original baseline results are preserved separately.

Run from any directory in an environment with the project's dependencies.
"""
import dataclasses
import json
from pathlib import Path
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from packages.algo_core.cfi import CFIEngine
from packages.algo_core.seir_f import SEIRFEngine
from packages.algo_core.content_gaps import ContentGapEngine
from apps.api.main import app


def main():
    cfi, seir, gaps = CFIEngine(), SEIRFEngine(), ContentGapEngine()
    zeros = np.zeros(30)
    initial = seir._initial(100,200)
    short, long = seir.forecast_trend_trajectory(days=7), seir.forecast_trend_trajectory(days=60)
    truth = SEIRFEngine(transmission_rate=.65)
    states = truth._solve(truth._initial(200,400), np.arange(36))
    fitted = seir.forecast_from_observations(states[:28,2], days=8)
    predicted = np.array([x.active_spreaders for x in fitted['trajectory']])
    actual = states[28:,2]
    corpus, labels = np.array([[1.,0.,0.],[0.,1.,0.]]), ['A','B']
    query = {'query':'Synthetic test question', 'embedding':[0.,0.,1.],
             'demand_count':20,'source_urls':['https://example.com/synthetic-fixture']}
    original_gap = gaps.discover_whitespaces(corpus, labels, [query])
    results = {
        'scope': 'regression_and_synthetic_holdout_not_real_user_validation',
        'cfi_zero_signal': cfi.summarize_retention_profile(cfi.compute_cfi(zeros,zeros,zeros)),
        'seir_initial_population': float(sum(initial[:4])),
        'seir_configured_population': float(seir.N),
        'seir_day_one_horizon_comparison': {'7_days': dataclasses.asdict(short[0]),
                                          '60_days':dataclasses.asdict(long[0])},
        'synthetic_holdout': {'training_days':28,'holdout_days':8,
            'fitted_beta':fitted['fit']['transmission_rate'],
            'true_beta':.65,
            'seir_mae':float(np.mean(np.abs(predicted-actual))),
            'last_value_baseline_mae':float(np.mean(np.abs(states[27,2]-actual))),
            'relative_mae':float(np.mean(np.abs(predicted-actual))/np.mean(actual)),
            'limitation':'Synthetic data generated from the same model family; not evidence of real-world accuracy.'},
        'gap_without_demand':gaps.discover_whitespaces(corpus,labels,[]),
        'gap_with_demand':[dataclasses.asdict(x) for x in original_gap],
        'gap_scale_invariant':original_gap == gaps.discover_whitespaces(corpus*.1,labels,[query]),
        'gap_duplicate_invariant':original_gap == gaps.discover_whitespaces(corpus,labels,[query,query]),
        'api_import':{'status':'ok','version':app.version},
    }
    print(json.dumps(results, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == '__main__':
    main()
