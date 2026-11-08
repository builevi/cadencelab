"""Bounded, feature-based analysis API. No implicit scraping or fabricated data."""
from pathlib import Path
import sys
from typing import Annotated
from contextlib import asynccontextmanager
import os
# Also support the documented `cd apps/api; uvicorn main:app` invocation.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
import numpy as np
from packages.algo_core.cfi import CFIEngine
from packages.algo_core.seir_f import SEIRFEngine
from packages.algo_core.content_gaps import ContentGapEngine
from apps.api.services.jobs import JobService
from apps.api.report_routes import router as report_router
from apps.api.video_routes import router as video_router, VideoJobs

@asynccontextmanager
async def lifespan(app):
    db_path=Path(os.environ.get('SOCIALLENS_JOB_DB', str(ROOT / '.sociallens/jobs.sqlite3')))
    app.state.jobs = JobService(db_path)
    app.state.video_jobs=VideoJobs(db_path.with_suffix('.videos.sqlite3'),Path(os.environ.get('SOCIALLENS_MODELS_DIR',str(ROOT/'.sociallens/models'))))
    try:
        yield
    finally:
        app.state.jobs.close()
        app.state.video_jobs.close()

app = FastAPI(title="SocialLens Pro — Experimental Analysis", version="0.2.0", lifespan=lifespan)
app.include_router(report_router)
app.include_router(video_router)
cfi_engine = CFIEngine()
gap_engine = ContentGapEngine()


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CFIRequest(StrictRequest):
    visual_motion: list[float] = Field(min_length=1, max_length=7200)
    acoustic_flux: list[float] = Field(min_length=1, max_length=7200)
    semantic_density: list[float] = Field(min_length=1, max_length=7200)
    time_step: float = Field(default=0.5, gt=0, le=60)


class TrendRequest(StrictRequest):
    trend_keyword: str = Field(min_length=1, max_length=200)
    daily_active_spreaders: list[float] = Field(min_length=7, max_length=365)
    days: int = Field(default=7, ge=1, le=90, strict=True)
    population_size: float = Field(default=1_000_000, gt=0, le=1_000_000_000)


class DemandQuery(StrictRequest):
    query: str = Field(min_length=1, max_length=2000)
    embedding: list[float] = Field(min_length=1, max_length=1536)
    demand_count: int = Field(ge=1, le=1_000_000_000, strict=True)
    source_urls: list[str] = Field(min_length=1, max_length=20)


class GapRequest(StrictRequest):
    embeddings: list[Annotated[list[float], Field(min_length=1, max_length=1536)]] = Field(min_length=1, max_length=2000)
    cluster_labels: list[str] = Field(min_length=1, max_length=2000)
    unanswered_queries: list[DemandQuery] = Field(default_factory=list, max_length=200)
    embedding_model: str = Field(min_length=1, max_length=200)


def checked(operation):
    try:
        return operation()
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/")
def read_root():
    return {"service": "SocialLens Pro Engine", "status": "online",
            "algorithms_active": ["CFI_pacing_heuristic", "SEIR_F_conditional", "semantic_content_gaps"],
            "prediction_validation": "experimental_not_validated_on_real_outcomes"}


@app.post("/api/v1/cfi/analyze")
def analyze_cfi(request: CFIRequest):
    def run():
        slices = cfi_engine.compute_cfi(request.visual_motion, request.acoustic_flux,
                                       request.semantic_density, request.time_step)
        return {"mode": "supplied_features", "summary": cfi_engine.summarize_retention_profile(slices),
                "timeline_slices": slices}
    return checked(run)


@app.post("/api/v1/cfi/simulate")
def simulate_cfi_retention(video_seconds: int = Query(default=15, ge=1, le=600)):
    rng = np.random.default_rng(42)  # isolated from other requests
    time = np.arange(0, video_seconds, 0.5)
    request = CFIRequest(
        visual_motion=np.clip(.5+.3*np.sin(1.5*time)+rng.normal(0,.05,len(time)),0,1).tolist(),
        acoustic_flux=np.clip(.6+.25*np.cos(2*time),0,1).tolist(),
        semantic_density=rng.uniform(.3,.9,len(time)).tolist())
    result = analyze_cfi(request)
    result["mode"] = "synthetic_demo"
    return result


@app.post("/api/v1/trend/forecast")
def forecast_trend(request: TrendRequest):
    result = checked(lambda: SEIRFEngine(population_size=request.population_size)
                     .forecast_from_observations(request.daily_active_spreaders, request.days))
    return {"trend_keyword": request.trend_keyword, "forecast_days": request.days, **result}


@app.post("/api/v1/trend/simulate")
def simulate_trend(days: int = Query(default=21, ge=1, le=90)):
    return {"mode": "synthetic_scenario", "uncertainty_status": "not_calibrated",
            "trajectory": SEIRFEngine().forecast_trend_trajectory(days=days)}


@app.post("/api/v1/whitespaces/discover")
def discover_whitespaces(request: GapRequest):
    result = checked(lambda: gap_engine.discover_whitespaces(request.embeddings, request.cluster_labels,
                      [q.model_dump() for q in request.unanswered_queries]))
    return {"mode": "demand_backed_semantic_gaps", "embedding_model": request.embedding_model,
            "evidence_status": "missing_demand_data" if not request.unanswered_queries else "caller_supplied",
            "corpus_size": len(request.embeddings), "discovered_whitespaces": result,
            "limitations": "Similarity is a coverage proxy within the supplied corpus; scores are not success probabilities."}
