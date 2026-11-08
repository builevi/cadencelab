"""SEIR-F scenarios and conditional fits to daily active-spreader observations.

F is accumulated active-spreader-days. Fatigue enters the removal rate as
alpha * F / N (alpha has inverse-day-squared units). F/N is NOT a probability.
"""
from dataclasses import dataclass
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares


@dataclass
class TrendForecast:
    day: int
    active_virality: float  # active spreaders / fixed population N
    audience_fatigue: float  # F/N, population-normalized accumulated activity
    trend_phase: str
    actionable_advice: str
    active_spreaders: float = 0.0
    growth_rate: float = 0.0


class SEIRFEngine:
    def __init__(self, population_size=1_000_000.0, transmission_rate=0.85,
                 exposure_rate=0.50, recovery_rate=0.15,
                 fatigue_impact=0.35, fatigue_decay=0.05):
        values = np.asarray([population_size, transmission_rate, exposure_rate,
                             recovery_rate, fatigue_impact, fatigue_decay], dtype=float)
        if not np.all(np.isfinite(values)) or population_size <= 0 or np.any(values[1:] < 0):
            raise ValueError("Population must be positive and rates finite/nonnegative")
        self.N, self.beta, self.sigma, self.gamma, self.alpha, self.kappa = values

    def _deriv(self, t, y, beta=None):
        s, e, i, r, f = y
        incidence = (self.beta if beta is None else beta) * s * i / self.N
        removal = (self.gamma + self.alpha * f / self.N) * i
        return [-incidence, incidence-self.sigma*e,
                self.sigma*e-removal, removal, i-self.kappa*f]

    def _initial(self, infected, exposed):
        if not np.isfinite(infected + exposed) or min(infected, exposed) < 0 or infected + exposed > self.N:
            raise ValueError("Initial infected + exposed must be within population")
        return np.array([self.N-infected-exposed, exposed, infected, 0., 0.])

    def _solve(self, initial, times, beta=None):
        times = np.asarray(times, dtype=float)
        if len(times) == 1:
            return np.asarray(initial, dtype=float)[None, :]
        sol = solve_ivp(lambda t, y: self._deriv(t, y, beta), (0, times[-1]),
                        initial, t_eval=times, rtol=1e-7, atol=1e-8)
        if not sol.success or not np.all(np.isfinite(sol.y)):
            raise ValueError("SEIR-F solver did not converge")
        states = sol.y.T
        if states[:, :4].min() < -1e-3 or not np.allclose(states[:, :4].sum(axis=1), self.N, atol=0.01):
            raise ValueError("SEIR-F solution violates population constraints")
        return np.maximum(states, 0)

    @staticmethod
    def _validate_days(days):
        if isinstance(days, bool) or not isinstance(days, (int, np.integer)) or not 1 <= days <= 365:
            raise ValueError("days must be an integer between 1 and 365")

    def _format(self, states, beta=None, first_day=1):
        output = []
        for day, state in enumerate(states, first_day):
            i, f = state[2], state[4]
            growth = self._deriv(0, state, beta)[2] / max(i, 1e-9)
            # Phase uses the current state only, never a future-window argmax.
            phase = "INACTIVE" if i < 1 else "SURGING" if growth > 0.02 else (
                "DECLINING" if growth < -0.02 else "PLATEAU")
            output.append(TrendForecast(day, float(i/self.N), float(f/self.N), phase,
                "Kịch bản có điều kiện; đối chiếu dữ liệu thực trước khi quyết định sản xuất hoặc ngân sách.",
                float(i), float(growth)))
        return output

    def forecast_trend_trajectory(self, initial_infected=100., days=30):
        """Explicit simulation: future days 1..days, excluding the initial t=0."""
        self._validate_days(days)
        initial = self._initial(initial_infected, initial_infected * 2)
        states = self._solve(initial, np.arange(days+1, dtype=float))
        return self._format(states[1:])

    def forecast_from_observations(self, daily_active_spreaders, days=7):
        """Fit beta and initial exposed count; other rates/N are fixed priors.

        Input is consecutive daily ACTIVE SPREADER counts, not cumulative views,
        likes or audience size. Missing days must be resolved by the caller.
        No claim of identifiable psychological fatigue or calibrated intervals.
        """
        self._validate_days(days)
        observed = np.asarray(daily_active_spreaders, dtype=float)
        if observed.ndim != 1 or not 7 <= observed.size <= 365:
            raise ValueError("Provide 7..365 consecutive daily active-spreader observations")
        if not np.all(np.isfinite(observed)) or np.any(observed < 0) or np.any(observed > self.N):
            raise ValueError("Observations must be finite and within [0, population]")
        if observed[0] <= 0:
            raise ValueError("First observed active-spreader count must be positive")
        if observed[0] >= self.N:
            raise ValueError("Initial activity must leave room for susceptible/exposed audience")
        times = np.arange(observed.size, dtype=float)
        available = self.N - observed[0]

        def simulate(params):
            beta, exposed_fraction = params
            initial = self._initial(observed[0], available * exposed_fraction)
            return self._solve(initial, times, beta)

        def residual(params):
            return np.log1p(simulate(params)[:, 2]) - np.log1p(observed)

        fit = least_squares(residual, [min(max(self.beta, 0.001), 4.99),
                                     min(0.99, 2*observed[0]/available)],
                            bounds=([0, 0], [5, 1]), loss="soft_l1", max_nfev=150)
        if not fit.success:
            raise ValueError("Trend parameter fit did not converge")
        states = simulate(fit.x)
        fitted = states[:, 2]
        future = self._solve(states[-1], np.arange(days+1, dtype=float), fit.x[0])
        return {
            "mode": "fitted_conditional_scenario",
            "trajectory": self._format(future[1:], fit.x[0]),
            "fit": {
                "observations": int(observed.size),
                "transmission_rate": float(fit.x[0]),
                "initial_exposed": float(available * fit.x[1]),
                "training_mae": float(np.mean(np.abs(fitted-observed))),
                "training_log_rmse": float(np.sqrt(np.mean((np.log1p(fitted)-np.log1p(observed))**2))),
                "fixed_priors": {"population": float(self.N), "exposure_rate": float(self.sigma),
                    "recovery_rate": float(self.gamma), "fatigue_impact": float(self.alpha),
                    "fatigue_decay": float(self.kappa)},
                "initial_state_assumptions": {"recovered": 0, "fatigue": 0,
                    "infected": "first_observation", "exposed": "fitted"},
                "at_parameter_boundary": bool(fit.x[0] < 1e-4 or fit.x[0] > 4.999 or
                                                fit.x[1] < 1e-6 or fit.x[1] > .999999),
            },
            "uncertainty_status": "not_calibrated",
            "limitations": "Fit error is in-sample, not forecast accuracy. Fixed priors and hidden states need validation; no causal fatigue inference.",
        }
