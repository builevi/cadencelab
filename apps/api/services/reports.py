"""Source-backed report contracts and deterministic descriptive analysis."""
from collections import Counter
from statistics import median
from typing import Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, model_validator


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class AudienceComment(Model):
    text: str = Field(min_length=1, max_length=4000)
    url: HttpUrl


class Post(Model):
    id: str = Field(min_length=1, max_length=200)
    url: HttpUrl
    published_at: AwareDatetime
    observed_at: AwareDatetime
    format: Literal['short_video','long_video','image','text','carousel']
    duration_seconds: float | None = Field(default=None, gt=0, le=86400)
    views: int | None = Field(default=None, ge=0, strict=True)
    likes: int | None = Field(default=None, ge=0, strict=True)
    comments: int | None = Field(default=None, ge=0, strict=True)
    shares: int | None = Field(default=None, ge=0, strict=True)
    caption: str = Field(default='', max_length=10000)
    transcript: str = Field(default='', max_length=30000)
    ad_text: str = Field(default='', max_length=10000)
    audience_comments: list[AudienceComment] = Field(default_factory=list, max_length=100)


    @model_validator(mode='after')
    def validate_dates(self):
        if self.observed_at < self.published_at:
            raise ValueError('observed_at must be at or after published_at')
        if self.format in ('short_video','long_video') and self.duration_seconds is None:
            raise ValueError('Video posts require duration_seconds for fair cohorts')
        return self


class Channel(Model):
    id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    platform: Literal['tiktok','facebook','instagram','youtube']
    url: HttpUrl
    posts: list[Post] = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def unique_posts(self):
        if len({p.id for p in self.posts}) != len(self.posts):
            raise ValueError('Duplicate post IDs within a channel')
        return self


class ReportRequest(Model):
    kind: Literal['channel','single_video','comparison','merge'] = 'channel'
    channels: list[Channel] = Field(min_length=1, max_length=10)
    target_post_id: str | None = Field(default=None, max_length=200)
    analysis_mode: Literal['statistics','semantic'] = 'statistics'
    language: Literal['vi','en'] = 'vi'


    @model_validator(mode='after')
    def validate_scope(self):
        if len({(c.platform,c.id) for c in self.channels}) != len(self.channels):
            raise ValueError('Duplicate channel identity')
        text_size=sum(len(p.caption)+len(p.transcript)+len(p.ad_text)+sum(len(x.text) for x in p.audience_comments)
                      for c in self.channels for p in c.posts)
        if text_size > 2_000_000:
            raise ValueError('At most 2 million text characters per report')
        if sum(len(c.posts) for c in self.channels) > 5000:
            raise ValueError('At most 5000 posts per report')
        if self.kind in ('channel','single_video') and len(self.channels) != 1:
            raise ValueError('channel/single_video requires exactly one channel')
        if self.kind in ('comparison','merge') and len(self.channels) < 2:
            raise ValueError('comparison/merge requires at least two channels')
        if self.kind == 'single_video':
            targets = [p for p in self.channels[0].posts if p.id == self.target_post_id]
            if len(targets) != 1 or targets[0].format not in ('short_video','long_video'):
                raise ValueError('single_video target must identify one supplied video')
        elif self.target_post_id is not None:
            raise ValueError('target_post_id is only allowed for single_video')
        return self


def cohort(post):
    hours = (post.observed_at-post.published_at).total_seconds()/3600
    age = next((name for limit,name in [(24,'under_24h'),(72,'1_3d'),(168,'3_7d'),
                                         (720,'7_30d')] if hours < limit),'30d_plus')
    duration = None if post.duration_seconds is None else next(
        (label for limit,label in [(30,'under_30s'),(60,'30_60s'),(180,'60_180s')]
         if post.duration_seconds < limit),'180s_plus')
    return post.format, age, duration


def channel_analysis(channel):
    posts = sorted(channel.posts, key=lambda p:(p.published_at,p.id))
    # Leave-one-out peer baseline, matched by format, length and observation age.
    groups = {}
    for p in posts:
        groups.setdefault(cohort(p),[]).append(p)
    performance = []
    for p in posts:
        # Constrain capture dates too: a historical snapshot is not a current peer.
        peers = [q for q in groups[cohort(p)] if q.id != p.id and q.views is not None
                 and abs((q.observed_at-p.observed_at).total_seconds()) <= 86400]
        base = median(q.views for q in peers) if len(peers) >= 5 else None
        ratio = p.views/base if p.views is not None and base is not None and base > 0 else None
        status = 'insufficient_data' if ratio is None else (
            'below_peer_baseline' if ratio < .5 else 'above_peer_baseline' if ratio >= 2 else 'within_peer_range')
        performance.append({'post_id':p.id,'url':str(p.url),'views':p.views,
            'cohort':list(cohort(p)),'peer_count':len(peers),'peer_median_views':base,
            'relative_views':ratio,'status':status,
            'engagement_per_view':(p.likes+p.comments+p.shares)/p.views
                if p.views and all(x is not None for x in [p.likes,p.comments,p.shares]) else None})
    totals = {}
    for metric in ['views','likes','comments','shares']:
        values = [getattr(p,metric) for p in posts if getattr(p,metric) is not None]
        totals[metric]={'known_total':sum(values) if values else None,'observed_posts':len(values),
                        'missing_posts':len(posts)-len(values)}
    modules = [{'id':key,'status':'requires_semantic_analysis','findings':[],
                'missing':['validated structured semantic analysis and supporting evidence']}
               for key in ['brand_positioning','tone_of_voice','target_audience_clues',
                           'posting_and_trends','content_pillars','content_structure_analysis',
                           'transcript_analysis','ad_strategy']]
    modules[3]={'id':'posting_and_trends','status':'descriptive_only',
        'findings':{'posts_by_weekday_utc':dict(Counter(p.published_at.utctimetuple().tm_wday for p in posts)),
                    'format_mix':dict(Counter(p.format for p in posts))},
        'missing':['Repeated snapshots required to measure growth; no best-time causal inference.']}
    return {'channel_id':channel.id,'platform':channel.platform,'name':channel.name,
        'corpus_size':len(posts),'totals':totals,'performance':performance,
        'qualitative_modules':modules,'source_urls':[str(p.url) for p in posts],
        'snapshot_range':{'from':min(p.observed_at for p in posts).isoformat(),
                          'to':max(p.observed_at for p in posts).isoformat()},
        'publication_range':{'from':posts[0].published_at.isoformat(),'to':posts[-1].published_at.isoformat()}}


def build_report(request: ReportRequest):
    channels = [channel_analysis(c) for c in request.channels]
    result = {'schema_version':'1.0','kind':request.kind,'data_source':'caller_supplied_snapshot',
        'channels':channels,'target_post_id':request.target_post_id,
        'methodology':{'low_performance_rule':'views < 0.5 × leave-one-out cohort median',
            'minimum_peers':5,'cohorts':['same channel','same format','same duration bucket',
                'same post-age bucket','snapshots within 24 hours'],
            'engagement_definition':'(likes + comments + shares) / views; only when all inputs are known'},
        'limitations':['Relative views flag is descriptive, not proof of a weak hook or distribution restriction.',
            'Views are platform-specific counters; cross-platform totals are not unique people.',
            'No automatic URL collection, retention prediction or semantic model invocation in this report.']}
    if request.kind == 'single_video':
        result['target_performance']=next(p for p in channels[0]['performance'] if p['post_id']==request.target_post_id)
    if request.kind == 'comparison':
        result['comparison']=[{'channel_id':c['channel_id'],'platform':c['platform'],
            'posts':c['corpus_size'],'median_known_views':median([p['views'] for p in c['performance'] if p['views'] is not None])
                if any(p['views'] is not None for p in c['performance']) else None} for c in channels]
        result['limitations'].append('Channel summaries may cover different periods and formats; no automatic winner ranking.')
    if request.kind == 'merge':
        result['merge']={'channel_count':len(channels),'post_count':sum(c['corpus_size'] for c in channels),
                         'metrics_kept_separate_by_channel':True}
    return result
