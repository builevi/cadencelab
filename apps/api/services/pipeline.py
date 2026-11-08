"""Report orchestration: deterministic measurements + optional evidenced AI modules."""
from .reports import build_report
from .semantic import analyze_channel
from .providers import configured_provider


def run_pipeline(request, progress=lambda value: None, provider=None, report=None):
    progress(25)
    result=report if report is not None else build_report(request)
    for i,(channel,analysis) in enumerate(zip(request.channels,result['channels'])):
        if request.analysis_mode=='semantic':
            semantic=analyze_channel(channel,request.language,provider or configured_provider(), request.target_post_id)
            # Keep deterministic module as well as semantic interpretation.
            analysis['semantic_analysis']=semantic
        progress(30+int(55*(i+1)/len(request.channels)))
    result['language']=request.language
    result['analysis_mode']=request.analysis_mode
    result['report_parts']={
        'report_part_1':{'quantitative_synthesis':[
            {'channel_id':c['channel_id'],'platform':c['platform'],'totals':c['totals'],
             'publication_range':c['publication_range'],'snapshot_range':c['snapshot_range'],
             'posting_statistics':c['qualitative_modules'][3]['findings'],'performance':c['performance']}
            for c in result['channels']]},
        'report_part_2':{'qualitative_analysis':[
            {'channel_id':c['channel_id'],'platform':c['platform'],
             'modules':c.get('semantic_analysis',{}).get('modules',c['qualitative_modules'])}
            for c in result['channels']]},
        'report_part_3':{'evaluations':evaluations(result), 'video_ideas':[],
                         'video_ideas_status':'requires_editorial_generation'}}
    statuses=[m['status'] for c in result['channels'] for m in c.get('semantic_analysis',{}).get('modules',[])]
    result['semantic_status']=('not_requested' if request.analysis_mode=='statistics' else
        'unavailable' if statuses and all(s=='unavailable' for s in statuses) else
        'partial' if 'unavailable' in statuses else 'completed')
    # This is a statement about this implementation, not an accuracy claim.
    result['limitations']=[x for x in result['limitations'] if 'No automatic URL collection' not in x]
    result['limitations'].append('No automatic URL collection or retention prediction. AI interpretations need review.')
    progress(95)
    return result


def evaluations(result):
    output=[]
    for c in result['channels']:
        low=[p for p in c['performance'] if p['status']=='below_peer_baseline']
        insufficient=sum(p['status']=='insufficient_data' for p in c['performance'])
        output.append({'channel_id':c['channel_id'],'platform':c['platform'],
            'below_baseline_posts':[{'post_id':p['post_id'],'url':p['url'],
                'relative_views':p['relative_views'],'action':
                'Review this post against matched peers; obtain retention/transcript/media evidence before attributing cause.'}
                for p in low],
            'insufficient_baseline_posts':insufficient,
            'recommended_data':['Collect comparable snapshots and at least five matched peer posts.'] if insufficient else []})
    return output
