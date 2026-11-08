import unittest
from apps.api.services.imports import CSVImport, parse_csv


def body(text):
    return CSVImport(channel_id='test',channel_name='Test',platform='tiktok',
                     channel_url='https://example.com/channel',csv_text=text)

HEADER='id,url,published_at,observed_at,format,duration_seconds,views,likes,caption\n'
ROW='p1,https://example.com/p1,2026-01-01T00:00:00Z,2026-02-01T00:00:00Z,short_video,30,100,,"Câu hỏi, có dấu"\n'


class CSVTests(unittest.TestCase):
    def test_import_handles_unicode_quotes_and_unknown_metrics(self):
        r=parse_csv(body('\ufeff'+HEADER+ROW))
        p=r.channels[0].posts[0]
        self.assertEqual(p.views,100)
        self.assertIsNone(p.likes)
        self.assertEqual(p.caption,'Câu hỏi, có dấu')

    def test_reject_bad_headers_and_row_width(self):
        for text in [HEADER.replace('id,','url,',1)+ROW,HEADER.replace('id,','unknown,',1)+ROW,
                     HEADER+ROW.replace('p1,','p1,extra,',1),HEADER]:
            with self.subTest(text=text),self.assertRaises(ValueError):parse_csv(body(text))

    def test_reject_negative_fractional_or_unknown_text_metric(self):
        for value in ['-1','1.5','N/A']:
            with self.subTest(value=value),self.assertRaises(ValueError):
                parse_csv(body(HEADER+ROW.replace(',100,',','+value+',')))

    def test_reject_naive_dates_and_duplicate_posts(self):
        for text in [HEADER+ROW.replace('00:00:00Z','00:00:00'),HEADER+ROW+ROW]:
            with self.assertRaises(ValueError):parse_csv(body(text))


if __name__=='__main__':unittest.main()
