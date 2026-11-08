"""Video pacing diagnostics from normalized features; not a retention predictor."""
from dataclasses import dataclass
from typing import Any
import numpy as np


@dataclass
class CFISlice:
    timestamp_sec: float
    cfi_score: float
    visual_motion: float
    acoustic_flux: float
    semantic_density: float
    boredom_penalty: float
    zone: str
    recommendation: str | None = None
    stage: str = "BODY"
    stimulus_load: float = 0.0


class CFIEngine:
    """Weights/thresholds are explicit heuristics, not learned coefficients.

    Motion and spectral flux must be normalized using a fixed extraction protocol,
    not independently min-max scaled per video. Semantic density must be measured
    separately; missing semantics must not silently be replaced by zero.
    """
    def __init__(self, weight_visual=0.35, weight_acoustic=0.30,
                 weight_semantic=0.25, penalty_redundancy=0.40,
                 boredom_threshold=0.20, overload_threshold=0.85):
        weights = np.asarray([weight_visual, weight_acoustic, weight_semantic], dtype=float)
        if not np.all(np.isfinite(weights)) or np.any(weights < 0) or weights.sum() <= 0:
            raise ValueError("Weights must be finite, nonnegative and have positive sum")
        if not np.isfinite(penalty_redundancy) or not 0 <= penalty_redundancy <= 1:
            raise ValueError("penalty_redundancy must be in [0, 1]")
        if not 0 <= boredom_threshold < overload_threshold <= 1:
            raise ValueError("Thresholds must satisfy 0 <= boredom < overload <= 1")
        self.weights = weights / weights.sum()
        self.w_r = penalty_redundancy
        self.boredom_thresh = boredom_threshold
        self.overload_thresh = overload_threshold

    def compute_cfi(self, visual_flow_series, acoustic_flux_series,
                    semantic_density_series, time_step=0.5) -> list[CFISlice]:
        if not np.isfinite(time_step) or time_step <= 0:
            raise ValueError("time_step must be finite and positive")
        arrays = [np.asarray(x, dtype=float) for x in
                  (visual_flow_series, acoustic_flux_series, semantic_density_series)]
        if any(x.ndim != 1 or x.size == 0 for x in arrays):
            raise ValueError("Features must be nonempty one-dimensional arrays")
        if len({x.size for x in arrays}) != 1:
            raise ValueError("Feature arrays must have the same length")
        if any(not np.all(np.isfinite(x)) or np.any((x < 0) | (x > 1)) for x in arrays):
            raise ValueError("Features must be finite and normalized to [0, 1]")
        visual, audio, semantic = arrays
        # Units: normalized feature change per second, bounded at 1 for scoring.
        change = [np.clip(np.abs(np.gradient(x, time_step)), 0, 1)
                  if x.size > 1 else np.zeros(1) for x in (visual, audio)]
        signals = np.stack((0.5 * (visual + change[0]),
                            0.5 * (audio + change[1]), semantic))
        # Meaningful semantic content protects static talking-head videos from
        # being penalized solely for a stationary camera.
        redundancy = 1 - np.maximum.reduce(arrays)
        scores = np.clip(self.weights @ signals - self.w_r * redundancy, 0, 1)
        # Load is separate from pacing score: high scores are not automatically bad.
        load = np.mean(np.stack((visual, audio, semantic)), axis=0)
        results = []
        for i, score in enumerate(scores):
            timestamp = round(i * time_step, 6)
            stage = "HOOK" if timestamp < 3 else "BODY"
            if score < self.boredom_thresh:
                zone = "BOREDOM_VALLEY"  # legacy field: low stimulus, not observed boredom
                rec = "Ít biến thiên: xem lại nội dung và nhịp dựng; chưa kết luận người xem sẽ rời đi."
            elif load[i] > self.overload_thresh:
                zone = "OVERLOAD"
                rec = "Nhiều tín hiệu cùng lúc: kiểm tra độ dễ hiểu trước khi thêm hiệu ứng."
            else:
                zone, rec = "FLOW", None
            results.append(CFISlice(timestamp, round(float(score), 4),
                float(visual[i]), float(audio[i]), float(semantic[i]),
                round(float(redundancy[i]), 4), zone, rec, stage,
                round(float(load[i]), 4)))
        return results

    def summarize_retention_profile(self, slices: list[CFISlice]) -> dict[str, Any]:
        if not slices:
            raise ValueError("At least one slice is required")
        scores = np.array([s.cfi_score for s in slices])
        low = [s for s in slices if s.zone == "BOREDOM_VALLEY"]
        # Count contiguous episodes, rather than calling every slice a new valley.
        starts = [s.timestamp_sec for i, s in enumerate(slices)
                  if s.zone == "BOREDOM_VALLEY" and
                  (i == 0 or slices[i-1].zone != "BOREDOM_VALLEY")]
        mean_score = float(scores.mean())
        grade = "F" if mean_score < self.boredom_thresh else (
            "A" if mean_score >= 0.65 and not low else "B" if mean_score >= 0.4 else "C")
        hook = [s.cfi_score for s in slices if s.timestamp_sec < 3]
        return {
            "overall_grade": grade,
            "grade_basis": "heuristic_pacing_only",
            "predicted_completion_rate": None,
            "prediction_status": "not_calibrated",
            "pacing_score": round(mean_score, 4),
            "hook_strength_3s": round(float(np.mean(hook)), 4) if hook else None,
            "boredom_valleys_count": len(starts),
            "low_stimulus_fraction": round(len(low) / len(slices), 4),
            "critical_drop_points": [],
            "review_points": starts,
            "overload_fraction": round(sum(s.zone == "OVERLOAD" for s in slices) / len(slices), 4),
            "limitations": "Chỉ số nhịp dựng heuristic; chưa dự báo retention hoặc chứng minh quan hệ nhân quả.",
        }
