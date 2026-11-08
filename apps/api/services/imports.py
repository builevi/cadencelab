"""Import a documented normalized CSV contract, without guessing vendor column names."""
import csv
import io
from typing import Literal
from pydantic import Field, HttpUrl
from .reports import Model, ReportRequest


class CSVImport(Model):
    channel_id: str = Field(min_length=1,max_length=200)
    channel_name: str = Field(min_length=1,max_length=200)
    platform: Literal['tiktok','facebook','instagram','youtube']
    channel_url: HttpUrl
    csv_text: str = Field(min_length=1,max_length=2_000_000)
    analysis_mode: Literal['statistics','semantic'] = 'statistics'
    language: Literal['vi','en'] = 'vi'


def parse_csv(body: CSVImport):
    required={'id','url','published_at','observed_at','format'}
    allowed=required|{'duration_seconds','views','likes','comments','shares','caption','transcript','ad_text'}
    reader=csv.DictReader(io.StringIO(body.csv_text.lstrip('\ufeff'),newline=''))
    columns=reader.fieldnames or []
    if len(columns)!=len(set(columns)) or not required.issubset(columns) or set(columns)-allowed:
        raise ValueError('CSV headers must be unique, include id/url/published_at/observed_at/format, and use documented columns')
    posts=[]
    for index,row in enumerate(reader,start=2):
        if len(posts)>=1000:
            raise ValueError('CSV accepts at most 1000 posts')
        if None in row or any(v is None for v in row.values()):
            raise ValueError(f'CSV row {index}: column count mismatch')
        row={key:value for key,value in row.items() if value!=''}
        try:
            for key in ['views','likes','comments','shares']:
                if key in row: row[key]=int(row[key])
            if 'duration_seconds' in row: row['duration_seconds']=float(row['duration_seconds'])
        except ValueError:
            raise ValueError(f'CSV row {index}: metrics must be numeric; unknown metrics must be blank') from None
        posts.append(row)
    return ReportRequest.model_validate({'kind':'channel','analysis_mode':body.analysis_mode,
        'language':body.language,'channels':[{'id':body.channel_id,'name':body.channel_name,
        'platform':body.platform,'url':str(body.channel_url),'posts':posts}]})
