"""Durable local job runner. SQLite adapter for local use; no tenant auth yet."""
import hashlib
from contextlib import contextmanager
import json
import logging
from pathlib import Path
import sqlite3
from threading import Event, Thread
import time
from uuid import uuid4
from .reports import ReportRequest, build_report
from .pipeline import run_pipeline
from .sources import SourceRequest, SourceError, resolve_source, fetch_metadata, normalize_metadata


class JobConflict(ValueError):
    pass


class JobService:
    def __init__(self, path, *, start_worker=True):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.stop = Event()
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute('''CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE, fingerprint TEXT NOT NULL,
                state TEXT NOT NULL, progress INTEGER NOT NULL, payload TEXT NOT NULL,
                result TEXT, error TEXT, created REAL NOT NULL, updated REAL NOT NULL,
                lease_until REAL, attempts INTEGER NOT NULL DEFAULT 0)''')
        self.thread = Thread(target=self.work, daemon=True, name='sociallens-local-worker')
        if start_worker:
            self.thread.start()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def submit(self, request, key=None):
        payload = json.dumps(request.model_dump(mode='json'), sort_keys=True, ensure_ascii=False)
        fingerprint = hashlib.sha256(payload.encode()).hexdigest()
        now = time.time()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if key:
                existing = db.execute('SELECT * FROM jobs WHERE idempotency_key=?',(key,)).fetchone()
                if existing:
                    if existing['fingerprint'] != fingerprint:
                        raise JobConflict('Idempotency key already belongs to a different request')
                    return self.public(existing)
            if db.execute("SELECT count(*) FROM jobs WHERE state IN ('queued','running')").fetchone()[0] >= 1000:
                raise JobConflict('Local queue is full')
            id = str(uuid4())
            db.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                (id,key,fingerprint,'queued',0,payload,None,None,now,now,None,0))
            row = db.execute('SELECT * FROM jobs WHERE id=?',(id,)).fetchone()
        return self.public(row)

    @staticmethod
    def public(row):
        value={k:row[k] for k in ['id','state','progress','created','updated','attempts','error']}
        payload=json.loads(row['payload'])
        if 'source_url' in payload:value['source_url']=payload['source_url']
        return value

    def get(self, id, result=False):
        with self.connect() as db:
            row = db.execute('SELECT * FROM jobs WHERE id=?',(id,)).fetchone()
        if row is None:
            return None
        if result:
            return json.loads(row['result']) if row['state']=='completed' else None
        return self.public(row)

    def claim(self):
        now = time.time()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute("UPDATE jobs SET state='queued',progress=0,updated=? WHERE state='running' AND lease_until < ? AND attempts < 3",(now,now))
            db.execute("UPDATE jobs SET state='failed',error='worker_lease_expired',updated=? WHERE state='running' AND lease_until < ? AND attempts >= 3",(now,now))
            row = db.execute("SELECT * FROM jobs WHERE state='queued' ORDER BY created,id LIMIT 1").fetchone()
            if row is None:
                return None
            db.execute("UPDATE jobs SET state='running',progress=1,attempts=attempts+1,updated=?,lease_until=? WHERE id=?",(now,now+300,row['id']))
        return dict(row)

    def execute_one(self):
        row = self.claim()
        if row is None:
            return False
        try:
            result = self.process(row)
            encoded = json.dumps(result, ensure_ascii=False, allow_nan=False)
            with self.connect() as db:
                db.execute("UPDATE jobs SET state='completed',progress=100,result=?,updated=?,lease_until=NULL WHERE id=? AND state='running' AND attempts=?",(encoded,time.time(),row['id'],row['attempts']+1))
        except Exception as exc:
            logging.error('Report computation failed for job %s (details suppressed)', row['id'])
            with self.connect() as db:
                db.execute("UPDATE jobs SET state='failed',error=?,updated=?,lease_until=NULL WHERE id=? AND state='running' AND attempts=?",(self.failure_code(exc),time.time(),row['id'],row['attempts']+1))
        finally:
            self.cleanup(row)
        return True

    def process(self, row):
        payload=json.loads(row['payload'])
        def compute():
            source=None
            if 'source_url' in payload:
                source_request=SourceRequest.model_validate(payload)
                self.update_progress(row,5)
                identity=resolve_source(source_request.source_url)
                self.update_progress(row,10)
                data=fetch_metadata(identity,source_request.post_limit)
                request,source=normalize_metadata(data,identity,source_request)
            else:
                request=ReportRequest.model_validate(payload)
            result=run_pipeline(request,lambda value:self.update_progress(row,value),report=build_report(request))
            if source:
                result['source']=source
                result['data_source']='collected_public_snapshot'
                result['limitations']=[x for x in result['limitations'] if not x.startswith('No automatic URL collection')]
                result['limitations'].extend(source['limitations'])
            return result
        return self.with_heartbeat(row,compute)

    def with_heartbeat(self, row, operation):
        heartbeat_stop = Event()
        def heartbeat():
            while not heartbeat_stop.wait(20):
                try:self.update_progress(row, None)
                except sqlite3.Error:logging.error('Job heartbeat failed')
        pulse = Thread(target=heartbeat, daemon=True)
        pulse.start()
        try:return operation()
        finally:
            heartbeat_stop.set()
            pulse.join(timeout=1)

    def failure_code(self, exc):
        return str(exc) if isinstance(exc,SourceError) else 'report_computation_failed'

    def cleanup(self, row):
        pass

    def work(self):
        while not self.stop.is_set():
            try:
                if self.execute_one():
                    continue
            except sqlite3.Error:
                logging.exception('Local job database operation failed')
            self.stop.wait(.1)

    def update_progress(self, row, value):
        with self.connect() as db:
            db.execute("UPDATE jobs SET progress=COALESCE(?,progress),updated=?,lease_until=? WHERE id=? AND state='running' AND attempts=?",
                       (value,time.time(),time.time()+300,row['id'],row['attempts']+1))

    def list_jobs(self, limit=50, offset=0):
        with self.connect() as db:
            rows=db.execute('SELECT * FROM jobs ORDER BY created DESC,id DESC LIMIT ? OFFSET ?',
                            (limit,offset)).fetchall()
        return [self.public(row) for row in rows]

    def cancel(self, id):
        with self.connect() as db:
            db.execute("UPDATE jobs SET state='cancelled',updated=?,lease_until=NULL WHERE id=? AND state IN ('queued','running')",(time.time(),id))
        # An in-flight external request may finish; its result cannot overwrite cancelled state.
        return self.get(id)

    def close(self):
        self.stop.set()
        if self.thread.is_alive():
            self.thread.join(timeout=10)
