"""Local upload queue. Originals are removed after terminal processing/cancellation."""
import asyncio
import json
import os
from pathlib import Path
from threading import Lock
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import Field
from .services.reports import Model
from .services.jobs import JobService, JobConflict
from .services.video import MAX_BYTES, VideoError, analyze_video

_UPLOAD_LOCK=Lock()
router=APIRouter(prefix='/api/v1/videos',tags=['Video uploads'])


class VideoTask(Model):
    upload_id: str = Field(pattern=r'^[0-9a-f]{32}$')
    language: Literal['auto','vi','en'] = 'auto'


class VideoJobs(JobService):
    def __init__(self,path,model_dir,**kwargs):
        self.uploads=Path(path).parent/'video-uploads'
        self.uploads.mkdir(parents=True,exist_ok=True)
        self.model_dir=Path(model_dir)
        super().__init__(path,**kwargs)

    def process(self,row):
        task=VideoTask.model_validate_json(row['payload'])
        return self.with_heartbeat(row,lambda:analyze_video(self.uploads/(task.upload_id+'.bin'),
            self.model_dir,lambda value:self.update_progress(row,value),task.language))

    def failure_code(self,exc):
        return str(exc) if isinstance(exc,VideoError) else 'video_processing_failed'

    def cleanup(self,row):
        try:
            task=VideoTask.model_validate_json(row['payload'])
            (self.uploads/(task.upload_id+'.bin')).unlink(missing_ok=True)
        except (ValueError,OSError):pass

    def cancel(self,id):
        job=super().cancel(id)
        if job and job['state']=='cancelled':
            with self.connect() as db:row=db.execute('SELECT payload FROM jobs WHERE id=?',(id,)).fetchone()
            if row:self.cleanup(row)
        return job


def jobs(request):return request.app.state.video_jobs


def urls(job):
    base='/api/v1/videos/jobs/'+job['id']
    return {**job,'status_url':base,'result_url':base+'/result','events_url':base+'/events'}


@router.post('/jobs',status_code=202)
async def upload(request:Request,file:UploadFile=File(),language:Literal['auto','vi','en']=Form('auto')):
    service=jobs(request)
    id=uuid4().hex
    path=service.uploads/(id+'.bin')
    with _UPLOAD_LOCK:
        if len(list(service.uploads.glob('*.bin')))>=20:
            raise HTTPException(429,'Đang có nhiều video chờ xử lý. Hãy thử lại sau.')
        path.touch(mode=0o600,exist_ok=False)
    submitted=False
    try:
        size=0
        with path.open('wb') as output:
            while chunk:=await file.read(1024*1024):
                size+=len(chunk)
                if size>MAX_BYTES:raise HTTPException(413,'File tối đa 25 MB.')
                output.write(chunk)
        if not size:raise HTTPException(422,'File video đang trống.')
        try:job=service.submit(VideoTask(upload_id=id,language=language))
        except JobConflict:raise HTTPException(429,'Hàng đợi đang đầy.') from None
        submitted=True
        return urls(job)
    finally:
        await file.close()
        if not submitted:path.unlink(missing_ok=True)


@router.get('/jobs/{id}')
def status(id:str,request:Request):
    job=jobs(request).get(id)
    if job is None:raise HTTPException(404,'Không tìm thấy tác vụ video.')
    return job


@router.get('/jobs/{id}/result')
def result(id:str,request:Request):
    job=status(id,request)
    if job['state']!='completed':raise HTTPException(409,{'state':job['state'],'message':'Video chưa xử lý xong.'})
    return jobs(request).get(id,result=True)


@router.post('/jobs/{id}/cancel')
def cancel(id:str,request:Request):
    job=jobs(request).cancel(id)
    if job is None:raise HTTPException(404,'Không tìm thấy tác vụ video.')
    return job


@router.get('/jobs/{id}/events')
async def events(id:str,request:Request):
    status(id,request)
    async def stream():
        previous=None
        for _ in range(240):
            if await request.is_disconnected():return
            job=await asyncio.to_thread(jobs(request).get,id)
            if previous!=job:
                yield 'event: progress\ndata: '+json.dumps(job)+'\n\n';previous=job
            if job['state'] in ('completed','failed','cancelled'):return
            yield ': heartbeat\n\n'
            await asyncio.sleep(.25)
        yield 'event: reconnect\ndata: {}\n\n'
    return StreamingResponse(stream(),media_type='text/event-stream',headers={'Cache-Control':'no-cache'})
