"""Bounded public metadata collection. Never substitute a demo on source failure."""
from datetime import datetime, timezone
import json
import importlib.util
import math
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from typing import Literal
from urllib.parse import parse_qs, urlsplit
import httpx
from pydantic import Field, field_validator
from .reports import Model, ReportRequest


class SourceError(ValueError):pass


def source_identity(raw):
    try:u=urlsplit(raw.strip())
    except ValueError:raise SourceError('Link không hợp lệ.') from None
    try:port=u.port
    except ValueError:raise SourceError('Link không hợp lệ.') from None
    if u.scheme!='https' or u.username or u.password or port not in (None,443):
        raise SourceError('Hãy dùng link HTTPS công khai của TikTok hoặc YouTube.')
    host=(u.hostname or '').lower();path=u.path.rstrip('/')
    if host in ('www.tiktok.com','tiktok.com'):
        match=re.fullmatch(r'/@([\w.-]{1,100})(?:/video/(\d{10,25}))?',path)
        if match:
            handle,id=match.groups()
            return {'platform':'tiktok','handle':handle,'video_id':id,
                    'url':f'https://www.tiktok.com/@{handle}'+(f'/video/{id}' if id else '')}
    if host in ('vm.tiktok.com','vt.tiktok.com') and re.fullmatch(r'/[A-Za-z0-9]{3,100}',path):
        return {'platform':'tiktok','short':True,'url':f'https://{host}{path}/'}
    if host in ('www.youtube.com','youtube.com','youtu.be'):
        id=(path[1:] if host=='youtu.be' else parse_qs(u.query).get('v',[''])[0] if path=='/watch' else
            path.split('/')[-1] if path.startswith(('/shorts/','/embed/')) else '')
        if re.fullmatch(r'[A-Za-z0-9_-]{11}',id):
            return {'platform':'youtube','video_id':id,'handle':None,'url':f'https://www.youtube.com/watch?v={id}'}
        if host!='youtu.be' and re.fullmatch(r'/@[\w.-]{1,100}(?:/videos)?',path):
            handle=path.split('/')[1][1:]
            return {'platform':'youtube','handle':handle,'video_id':None,'url':f'https://www.youtube.com/@{handle}/videos'}
    raise SourceError('Hiện hỗ trợ link kênh hoặc video công khai TikTok/YouTube. Hãy kiểm tra lại link.')


class SourceRequest(Model):
    source_url: str = Field(min_length=1,max_length=1000)
    analysis_mode: Literal['statistics','semantic'] = 'semantic'
    language: Literal['vi','en'] = 'vi'
    post_limit: int = Field(default=12,ge=1,le=20,strict=True)

    @field_validator('source_url')
    @classmethod
    def valid_url(cls,value):return source_identity(value)['url']


def resolve_source(url):
    identity=source_identity(url)
    if not identity.get('short'):return identity
    try:
        with httpx.Client(follow_redirects=False,timeout=10) as client:
            for _ in range(4):
                response=client.get(identity['url'])
                if response.status_code not in (301,302,303,307,308):break
                location=response.headers.get('location','')
                identity=source_identity(location)
                if not identity.get('short'):return identity
    except (httpx.RequestError,SourceError):pass
    raise SourceError('Chưa mở được link TikTok rút gọn. Hãy dán link đầy đủ dạng tiktok.com/@kenh hoặc /video/…')


def fetch_metadata(identity,limit):
    if importlib.util.find_spec('yt_dlp') is None:
        raise SourceError('Máy chủ chưa có bộ đọc link. Hãy khởi động backend bằng môi trường uv đã đồng bộ dependency; chưa có dữ liệu báo cáo.')
    launcher=[sys.executable,'--metadata-worker'] if getattr(sys,'frozen',False) else [sys.executable,'-m','yt_dlp']
    command=launcher+['--ignore-config','--no-cache-dir','--skip-download',
        '--dump-single-json','--no-warnings','--no-progress','--quiet','--socket-timeout','10',
        '--retries','0','--extractor-retries','0','--playlist-end',str(limit),
        '--ignore-no-formats-error','--use-extractors','TikTok.*,Youtube.*','--',identity['url']]
    try:
        with tempfile.TemporaryFile() as output,tempfile.TemporaryFile() as errors:
            process=subprocess.run(command,stdout=output,stderr=errors,timeout=55)
            if process.returncode:
                raise SourceError('Không lấy được dữ liệu công khai từ nền tảng. Kênh có thể bị giới hạn truy cập, cần đăng nhập hoặc collector chưa hỗ trợ. Anh có thể nhập CSV hoặc tải file video; hệ thống không dùng báo cáo mẫu thay thế.')
            if output.tell()>8_000_000:raise SourceError('Dữ liệu nguồn quá lớn. Hãy thử link một video hoặc giảm số bài.')
            output.seek(0)
            try:data=json.load(output)
            except (ValueError,UnicodeError):raise SourceError('Nền tảng chưa trả dữ liệu đọc được. Hãy thử lại hoặc nhập CSV.') from None
            if not isinstance(data,dict):raise SourceError('Nguồn dữ liệu không hợp lệ.')
            return data
    except subprocess.TimeoutExpired:
        raise SourceError('Nền tảng phản hồi quá lâu. Hãy thử lại, dùng link một video hoặc nhập CSV.') from None


def numeric(value):
    return value if isinstance(value,int) and not isinstance(value,bool) and value>=0 else None


def normalize_metadata(data,identity,request,now=None):
    now=now or datetime.now(timezone.utc)
    entries=data.get('entries') if 'entries' in data else [data]
    if not isinstance(entries,list):raise SourceError('Chưa đọc được danh sách bài đăng của kênh.')
    posts=[];skipped=0;seen=set();name=None
    for item in entries[:request.post_limit]:
        if not isinstance(item,dict):skipped+=1;continue
        id=str(item.get('id',''))
        if not id or id in seen:continue
        if identity['video_id'] and id!=identity['video_id']:
            raise SourceError('Nguồn trả về video khác link đã gửi. Báo cáo đã được dừng để tránh nhầm dữ liệu.')
        # TikTok uploader is the unique handle; uploader_id is generally a numeric account ID.
        owner=item.get('uploader') if identity['platform']=='tiktok' else item.get('uploader_id')
        if not identity['video_id'] and owner and str(owner).lstrip('@').casefold()!=identity['handle'].casefold():
            raise SourceError('Dữ liệu thu được không khớp kênh đã yêu cầu. Báo cáo đã được dừng.')
        try:
            timestamp=item.get('timestamp')
            if timestamp is not None:
                published=datetime.fromtimestamp(float(timestamp),timezone.utc)
            else:published=datetime.strptime(item['upload_date'],'%Y%m%d').replace(tzinfo=timezone.utc)
            duration=float(item['duration'])
            if not math.isfinite(duration) or duration<=0 or duration>86400 or published>now:raise ValueError()
            if identity['platform']=='tiktok':
                if not re.fullmatch(r'\d{10,25}',id):raise ValueError()
                handle=identity['handle'] or str(owner or '')
                url=f'https://www.tiktok.com/@{handle}/video/{id}'
            else:
                if not re.fullmatch(r'[A-Za-z0-9_-]{11}',id):raise ValueError()
                url=f'https://www.youtube.com/watch?v={id}'
            posts.append({'id':id,'url':url,'published_at':published.isoformat(),'observed_at':now.isoformat(),
                'format':'short_video' if duration<=180 else 'long_video','duration_seconds':duration,
                'views':numeric(item.get('view_count')),'likes':numeric(item.get('like_count')),
                'comments':numeric(item.get('comment_count')),'shares':numeric(item.get('repost_count')),
                'caption':str(item.get('description') or item.get('title') or '')[:10000]})
            seen.add(id);name=name or item.get('channel') or item.get('uploader')
        except (ValueError,KeyError,TypeError,OverflowError):skipped+=1
    if not posts:raise SourceError('Chưa thu được bài đăng có ngày đăng và độ dài hợp lệ từ link này. Hãy thử một video công khai hoặc nhập dữ liệu CSV; chưa có báo cáo để hiển thị.')
    channel_id=str(identity['handle'] or data.get('channel_id') or data.get('uploader_id') or identity['video_id'])[:200]
    body={'kind':'single_video' if identity['video_id'] else 'channel','analysis_mode':request.analysis_mode,
        'language':request.language,'target_post_id':identity['video_id'],
        'channels':[{'id':channel_id,'name':str(name or channel_id)[:200],
                     'platform':identity['platform'],'url':identity['url'],'posts':posts}]}
    normalized=ReportRequest.model_validate(body)
    return normalized,{'requested_url':request.source_url,'resolved_url':identity['url'],
        'collector':'yt-dlp_public_metadata','collected_at':now.isoformat(),
        'collected_posts':len(posts),'skipped_posts':skipped,'requested_limit':request.post_limit,
        'limitations':['Limited public snapshot, not a complete channel history.',
            'Missing metrics are unknown, not zero. No transcript, comments text, ads or video pacing inferred from URL.',
            'Single video collection alone does not provide five matched peers for a relative-performance baseline.']}
