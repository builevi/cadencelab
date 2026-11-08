"""Demand-backed semantic content-gap ranking; not persistent homology.

Query and corpus embeddings must come from the SAME model/version. Similarity
is a retrieval proxy, not proof that a post answers a question. Scores describe
only the supplied corpus and evidence; they are not success probabilities.
"""
from dataclasses import dataclass
import hashlib
from urllib.parse import urlparse
import numpy as np


@dataclass
class ContentWhitespace:
    whitespace_id: str
    bounding_clusters: list[str]
    void_center_coordinates: list[float]  # legacy: empty; no fake 3D projection
    market_opportunity_score: float
    audience_demand_signal: str
    suggested_content_angle: str
    query: str
    demand_count: int
    nearest_content_similarity: float
    supporting_sources: list[str]
    evidence_status: str = "caller_supplied_not_independently_verified"
    score_basis: str = "demand_weighted_semantic_gap_not_probability"


class ContentGapEngine:
    def __init__(self, coverage_threshold=0.8, demand_half_saturation=20.0):
        if not np.isfinite(coverage_threshold) or not 0 < coverage_threshold <= 1:
            raise ValueError("coverage_threshold must be in (0, 1]")
        if not np.isfinite(demand_half_saturation) or demand_half_saturation <= 0:
            raise ValueError("demand_half_saturation must be positive")
        self.coverage_threshold = coverage_threshold
        self.demand_half_saturation = demand_half_saturation

    def discover_whitespaces(self, embeddings, cluster_labels, unanswered_queries):
        corpus = np.asarray(embeddings, dtype=float)
        if corpus.ndim != 2 or not 1 <= corpus.shape[0] <= 2000 or not 1 <= corpus.shape[1] <= 1536:
            raise ValueError("Corpus must have 1..2000 rows and 1..1536 embedding dimensions")
        if len(cluster_labels) != len(corpus) or any(not isinstance(x, str) or not x.strip() for x in cluster_labels):
            raise ValueError("Provide one nonempty cluster label per corpus row")
        if not np.all(np.isfinite(corpus)):
            raise ValueError("Corpus embeddings must be finite")
        norms = np.linalg.norm(corpus, axis=1)
        if np.any(norms <= 1e-12) or not np.all(np.isfinite(norms)):
            raise ValueError("Corpus embeddings must have finite nonzero norms")
        corpus = corpus / norms[:, None]
        if len(unanswered_queries) > 200:
            raise ValueError("At most 200 demand queries are supported per request")
        # Repeated copies of the same question must not inflate demand counts.
        queries = {}
        for record in unanswered_queries:
            query = record.get("query", "")
            if not isinstance(query, str) or not query.strip() or len(query) > 2000:
                raise ValueError("Each demand query needs nonempty text up to 2000 characters")
            vector = np.asarray(record.get("embedding", []), dtype=float)
            if vector.shape != (corpus.shape[1],) or not np.all(np.isfinite(vector)):
                raise ValueError("Query embeddings must match corpus dimension and be finite")
            norm = np.linalg.norm(vector)
            if not np.isfinite(norm) or norm <= 1e-12:
                raise ValueError("Query embeddings must have finite nonzero norm")
            count = record.get("demand_count")
            if isinstance(count, bool) or not isinstance(count, (int, np.integer)) or not 1 <= count <= 1_000_000_000:
                raise ValueError("demand_count must be a positive integer up to 1 billion")
            sources = record.get("source_urls", [])
            if not isinstance(sources, list) or not 1 <= len(sources) <= 20:
                raise ValueError("Demand evidence requires 1..20 source URLs")
            for url in sources:
                if not isinstance(url, str) or len(url) > 2048:
                    raise ValueError("Invalid evidence URL")
                parsed = urlparse(url)
                if parsed.scheme not in ("https", "http") or not parsed.netloc:
                    raise ValueError("Evidence must use absolute HTTP(S) URLs")
            key = " ".join(query.casefold().split())
            vector = vector / norm
            if key in queries:
                previous = queries[key]
                if not np.allclose(previous[1], vector, atol=1e-6):
                    raise ValueError("Duplicate question has inconsistent embeddings")
                queries[key] = (previous[0], vector, max(previous[2], int(count)),
                                sorted(set(previous[3]) | set(sources)))
            else:
                queries[key] = (query.strip(), vector, int(count), sorted(set(sources)))
        output = []
        for key, (query, vector, count, sources) in queries.items():
            similarity = np.clip(corpus @ vector, -1, 1)
            best = float(similarity.max())
            if best >= self.coverage_threshold:
                continue
            demand_weight = count / (count + self.demand_half_saturation)
            gap = 1 - max(0, best)
            order = sorted(range(len(corpus)), key=lambda i: (-float(similarity[i]), cluster_labels[i], i))
            neighbors = list(dict.fromkeys(cluster_labels[i] for i in order))[:3]
            output.append(ContentWhitespace(
                "gap_" + hashlib.sha256(key.encode()).hexdigest()[:16], neighbors, [],
                round(demand_weight * gap, 6),
                f"Dữ liệu đầu vào ghi nhận {count} tín hiệu cho câu hỏi này; cần kiểm tra nguồn và khử trùng lặp người dùng.",
                f"Kiểm tra các nội dung gần nhất trong mẫu trước khi viết bài trả lời: {query}",
                query, count, round(best, 6), sources))
        return sorted(output, key=lambda x: (-x.market_opportunity_score, x.whitespace_id))[:5]
