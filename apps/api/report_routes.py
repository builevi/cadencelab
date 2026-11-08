import asyncio
import json
from fastapi import APIRouter, Header, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from .services.jobs import JobConflict
from .services.reports import ReportRequest
from .services.imports import CSVImport, parse_csv
from .services.sources import SourceRequest
from pydantic import ValidationError

router = APIRouter(prefix='/api/v1/reports', tags=['Report jobs'])


def service(request):
    jobs = getattr(request.app.state,'jobs',None)
    if jobs is None:
        raise HTTPException(503,'Report worker is not initialized')
    return jobs


@router.post('/jobs', status_code=202)
def create_job(body: ReportRequest, request: Request,
               idempotency_key: str | None = Header(default=None, max_length=200)):
    if idempotency_key is not None and not idempotency_key.strip():
        raise HTTPException(422,'Idempotency-Key cannot be blank')
    try:
        job = service(request).submit(body,idempotency_key)
    except JobConflict as exc:
        raise HTTPException(409,str(exc)) from exc
    return {**job,'status_url':f"/api/v1/reports/jobs/{job['id']}",
            'events_url':f"/api/v1/reports/jobs/{job['id']}/events",
            'result_url':f"/api/v1/reports/jobs/{job['id']}/result"}


@router.post('/from-url', status_code=202)
def create_source_job(body: SourceRequest, request: Request,
                      idempotency_key: str | None = Header(default=None, max_length=200)):
    return create_job(body, request, idempotency_key)


@router.post('/imports/csv', status_code=202)
def import_csv(body: CSVImport, request: Request,
               idempotency_key: str | None = Header(default=None, max_length=200)):
    try:
        payload=parse_csv(body)
    except (ValueError, ValidationError) as exc:
        # Do not reflect captions, transcripts, credentials or entire rows in error responses.
        raise HTTPException(422,'Invalid normalized CSV: check headers, rows, dates and metric types') from None
    return create_job(payload, request, idempotency_key)


@router.get('/jobs')
def list_jobs(request: Request, limit: int = Query(50,ge=1,le=100), offset: int = Query(0,ge=0)):
    return {'items':service(request).list_jobs(limit,offset),'limit':limit,'offset':offset}


@router.post('/jobs/{id}/cancel')
def cancel_job(id: str, request: Request):
    job=service(request).cancel(id)
    if job is None:
        raise HTTPException(404,'Job not found')
    return job


@router.get('/jobs/{id}')
def get_job(id: str, request: Request):
    job = service(request).get(id)
    if job is None:
        raise HTTPException(404,'Job not found')
    return job


@router.get('/jobs/{id}/result')
def get_result(id: str, request: Request):
    jobs = service(request)
    job = jobs.get(id)
    if job is None:
        raise HTTPException(404,'Job not found')
    if job['state'] != 'completed':
        raise HTTPException(409,detail={'state':job['state'],'message':'Report is not completed'})
    return jobs.get(id,result=True)


@router.get('/jobs/{id}/events')
async def events(id: str, request: Request):
    jobs = service(request)
    if jobs.get(id) is None:
        raise HTTPException(404,'Job not found')

    async def stream():
        previous = None
        # Bounded connection; reconnect returns current durable state, not a historical log.
        for _ in range(240):
            if await request.is_disconnected():
                return
            job = await asyncio.to_thread(jobs.get,id)
            if job != previous:
                yield 'event: progress\ndata: '+json.dumps(job)+'\n\n'
                previous = job
            if job['state'] in ('completed','failed','cancelled'):
                return
            yield ': heartbeat\n\n'
            await asyncio.sleep(.25)
        yield 'event: reconnect\ndata: {}\n\n'
    return StreamingResponse(stream(),media_type='text/event-stream',
        headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})
