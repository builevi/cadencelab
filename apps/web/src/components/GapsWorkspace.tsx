"use client";

import React, { useEffect, useState } from "react";
import {
  DEFAULT_GAP_PAYLOAD,
  DemandQueryInput,
  GapDiscoveryResponse,
} from "../lib/contracts";

export function GapsWorkspace() {
  const [embeddingModel, setEmbeddingModel] = useState<string>(
    DEFAULT_GAP_PAYLOAD.embedding_model
  );
  const [queries, setQueries] = useState<DemandQueryInput[]>(
    DEFAULT_GAP_PAYLOAD.unanswered_queries
  );
  const [newQueryText, setNewQueryText] = useState<string>("");
  const [newDemandCount, setNewDemandCount] = useState<string>("25");
  const [newSourceUrl, setNewSourceUrl] = useState<string>(
    "https://example.com/comments/new-question-signal"
  );

  const [status, setStatus] = useState<"loading" | "empty" | "error" | "full">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [data, setData] = useState<GapDiscoveryResponse | null>(null);

  useEffect(() => {
    runDiscover(DEFAULT_GAP_PAYLOAD.unanswered_queries, embeddingModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runDiscover(
    queryList: DemandQueryInput[],
    modelName: string
  ) {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/v1/whitespaces/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embedding_model: modelName,
          cluster_labels: DEFAULT_GAP_PAYLOAD.cluster_labels,
          embeddings: DEFAULT_GAP_PAYLOAD.embeddings,
          unanswered_queries: queryList,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }
      const json: GapDiscoveryResponse = await res.json();
      setData(json);
      if (json.discovered_whitespaces.length === 0) {
        setStatus("empty");
      } else {
        setStatus("full");
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Lỗi gọi /whitespaces/discover."
      );
    }
  }

  function handleAddQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!newQueryText.trim()) return;
    const added: DemandQueryInput = {
      query: newQueryText.trim(),
      embedding: [0.09, 0.14, 0.21, 0.94],
      demand_count: Math.max(1, Math.round(Number(newDemandCount) || 1)),
      source_urls: [newSourceUrl.trim()],
    };
    const updated = [...queries, added];
    setQueries(updated);
    setNewQueryText("");
    runDiscover(updated, embeddingModel);
  }

  return (
    <div className="workspace-grid">
      {/* Left Column (4 cols): Corpus Overview & Add Demand Evidence */}
      <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <section className="slate-pane" aria-label="Thông tin kho nội dung đối thủ và bộ câu hỏi">
          <h2>Kho Bài đăng và Bằng chứng Nhu cầu</h2>
          <p className="brand-sub" style={{ marginTop: "var(--space-2xs)", marginBottom: "var(--space-md)" }}>
            Truy xuất Cosine Similarity trên vector chuẩn hóa L2; tự động loại câu hỏi đã được phủ (&gt;= 0.80)
          </p>

          <div className="inner-strip" style={{ fontSize: "var(--text-xs)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Mô hình vector (embedding_model):</span>
              <strong className="num">{embeddingModel}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Số bài đăng đối thủ trong mẫu:</span>
              <strong className="num">{DEFAULT_GAP_PAYLOAD.embeddings.length} bài</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Số câu hỏi đầu vào hiện tại:</span>
              <strong className="num">{queries.length} câu hỏi</strong>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", marginTop: "var(--space-md)" }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setQueries(DEFAULT_GAP_PAYLOAD.unanswered_queries);
                runDiscover(
                  DEFAULT_GAP_PAYLOAD.unanswered_queries,
                  embeddingModel
                );
              }}
            >
              Nạp lại 4 câu hỏi mẫu
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setQueries([]);
                runDiscover([], embeddingModel);
              }}
            >
              Xóa câu hỏi
            </button>
          </div>
        </section>

        <section className="slate-pane" aria-label="Thêm câu hỏi nhu cầu có dẫn chứng">
          <h3>Thêm Câu hỏi từ Bình luận / Tìm kiếm</h3>
          <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-md)" }}>
            Mỗi câu hỏi bắt buộc phải có số lượng tín hiệu nhu cầu và URL dẫn chứng hợp lệ (http/https)
          </p>

          <form onSubmit={handleAddQuery} style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <div>
              <label className="field-label" htmlFor="gap-model">
                Tên phiên bản Embedding Model
              </label>
              <input
                id="gap-model"
                type="text"
                className="field-input"
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="gap-query">
                Nội dung câu hỏi của khán giả
              </label>
              <textarea
                id="gap-query"
                className="field-textarea"
                placeholder="Nhập câu hỏi thực tế trích từ bình luận..."
                value={newQueryText}
                onChange={(e) => setNewQueryText(e.target.value)}
              />
            </div>

            <div className="workspace-grid">
              <div className="col-6">
                <label className="field-label" htmlFor="gap-count">
                  Số tín hiệu (demand_count)
                </label>
                <input
                  id="gap-count"
                  type="number"
                  className="field-input num"
                  value={newDemandCount}
                  onChange={(e) => setNewDemandCount(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="field-label" htmlFor="gap-url">
                  URL dẫn chứng (source_urls)
                </label>
                <input
                  id="gap-url"
                  type="text"
                  className="field-input"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className={
                status === "loading" ? "btn-pill is-loading" : "btn-pill"
              }
              disabled={status === "loading"}
            >
              Thêm và xếp hạng
            </button>
          </form>
        </section>
      </div>

      {/* Right Column (8 cols): Ranked Semantic Content Gaps */}
      <div className="col-8" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <section className="glass-pane" aria-label="Bảng xếp hạng khoảng trống nội dung có dẫn chứng">
          {status === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div className="skeleton-line" style={{ width: "55%" }} />
              <div className="skeleton-line" style={{ width: "100%", height: "140px" }} />
            </div>
          )}

          {status === "error" && (
            <div className="error-banner" role="alert">
              <strong>Lỗi kiểm tra bằng chứng nhu cầu (HTTP 422): </strong>
              <span>{errorMessage}</span>
              <div style={{ marginTop: "var(--space-sm)" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setQueries(DEFAULT_GAP_PAYLOAD.unanswered_queries);
                    runDiscover(
                      DEFAULT_GAP_PAYLOAD.unanswered_queries,
                      DEFAULT_GAP_PAYLOAD.embedding_model
                    );
                  }}
                >
                  Khôi phục mẫu
                </button>
              </div>
            </div>
          )}

          {status === "empty" && (
            <div className="inner-strip" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
              <h3>
                Không phát hiện cơ hội nội dung (Trạng thái:{" "}
                {data?.evidence_status || "missing_demand_data"})
              </h3>
              <p className="brand-sub" style={{ marginTop: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
                Hệ thống không tự bịa cơ hội thị trường khi danh sách câu hỏi rỗng hoặc toàn bộ câu hỏi đã được đối thủ trả lời (similarity &gt;= 0.80).
              </p>
              <button
                type="button"
                className="btn-pill"
                onClick={() => {
                  setQueries(DEFAULT_GAP_PAYLOAD.unanswered_queries);
                  runDiscover(
                    DEFAULT_GAP_PAYLOAD.unanswered_queries,
                    embeddingModel
                  );
                }}
              >
                Nạp lại mẫu
              </button>
            </div>
          )}

          {status === "full" && data && (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--space-md)",
                  marginBottom: "var(--space-md)",
                }}
              >
                <div>
                  <h2>
                    Xếp hạng Khoảng trống Nội dung ({data.discovered_whitespaces.length} cơ hội chưa được phủ)
                  </h2>
                  <p className="brand-sub" style={{ marginTop: "var(--space-3xs)" }}>
                    Chế độ: {data.mode}, trạng thái bằng chứng: {data.evidence_status}
                  </p>
                </div>
                <span className="tag tag--periwinkle">
                  Mẫu khảo sát: {data.corpus_size} bài đăng
                </span>
              </div>

              <div className="ruled-tally">
                <div className="tally-item">
                  <span className="tally-label">Câu hỏi đầu vào</span>
                  <span className="tally-figure">{queries.length}</span>
                  <span className="tally-sub">Đã khử trùng lặp chuẩn hóa</span>
                </div>
                <div className="tally-item">
                  <span className="tally-label">Câu hỏi chưa được phủ (&lt; 0.80)</span>
                  <span className="tally-figure">
                    {data.discovered_whitespaces.length}
                  </span>
                  <span className="tally-sub">
                    Đã lọc câu hỏi trùng chủ đề B5 (similarity ~ 1.0)
                  </span>
                </div>
                <div className="tally-item">
                  <span className="tally-label">Điểm ưu tiên cao nhất</span>
                  <span className="tally-figure">
                    {data.discovered_whitespaces[0]?.market_opportunity_score.toFixed(
                      3
                    ) ?? "0.000"}
                  </span>
                  <span className="tally-sub">
                    Heuristic trọng số nhu cầu nhân độ hổng ngữ nghĩa
                  </span>
                </div>
                <div className="tally-item">
                  <span className="tally-label">Tọa độ 3D giả lập</span>
                  <span className="tally-figure">Đã loại bỏ</span>
                  <span className="tally-sub">
                    void_center_coordinates = []
                  </span>
                </div>
              </div>

              <div className="data-table-wrap" style={{ marginTop: "var(--space-lg)" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mã định danh</th>
                      <th>Câu hỏi khán giả (query)</th>
                      <th className="num">Số tín hiệu</th>
                      <th className="num">Độ tương đồng gần nhất</th>
                      <th className="num">Điểm ưu tiên</th>
                      <th>Cụm chủ đề lân cận</th>
                      <th>Nguồn dẫn chứng (source_urls)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.discovered_whitespaces.map((gap) => (
                      <tr key={gap.whitespace_id}>
                        <td className="num" style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                          {gap.whitespace_id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{gap.query}</div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)", marginTop: "var(--space-3xs)" }}>
                            {gap.suggested_content_angle}
                          </div>
                        </td>
                        <td className="num">{gap.demand_count}</td>
                        <td className="num">
                          {gap.nearest_content_similarity.toFixed(4)}
                        </td>
                        <td className="num">
                          <span className="tag tag--apricot">
                            {gap.market_opportunity_score.toFixed(4)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2xs)" }}>
                            {gap.bounding_clusters.map((c) => (
                              <span key={c} className="tag tag--neutral">
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3xs)", fontSize: "var(--text-xs)" }}>
                            {gap.supporting_sources.map((src, i) => (
                              <a
                                key={src}
                                href={src}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Nguồn #{i + 1} ({new URL(src).pathname.split("/").pop()})
                              </a>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="brand-sub" style={{ marginTop: "var(--space-md)" }}>
                Giới hạn kỹ thuật: {data.limitations}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
