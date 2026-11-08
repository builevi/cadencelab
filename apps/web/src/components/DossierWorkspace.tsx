"use client";

import React, { useState } from "react";
import {
  SAMPLE_CHANNEL_REPORT,
  SAMPLE_SINGLE_VIDEO,
} from "../lib/contracts";

interface DossierWorkspaceProps {
  reportMode: "channel" | "single" | "competitor" | "merge";
  onChangeReportMode: (mode: "channel" | "single" | "competitor" | "merge") => void;
  onOpenCFIWithPreset: (presetKey: string) => void;
}

export function DossierWorkspace({
  reportMode,
  onChangeReportMode,
  onOpenCFIWithPreset,
}: DossierWorkspaceProps) {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({
    brand_positioning: true,
    content_pillars: true,
    reel_and_cfi_diagnostics: true,
    ad_strategy: true,
  });
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number>(0);
  const [exportedFlag, setExportedFlag] = useState<boolean>(false);
  const [analysisMode, setAnalysisMode] = useState<"statistics" | "semantic">(
    "statistics"
  );
  const [liveJobState, setLiveJobState] = useState<string | null>(null);
  const [liveJobProgress, setLiveJobProgress] = useState<number>(0);
  const [liveJobId, setLiveJobId] = useState<string | null>(null);
  const [liveSemanticStatus, setLiveSemanticStatus] = useState<string | null>(
    null
  );
  const [livePeerStats, setLivePeerStats] = useState<
    Array<{
      post_id: string;
      views: number;
      peer_median_views: number | null;
      relative_views: number | null;
      status: string;
      engagement_per_view: number | null;
    }>
  >([]);
  const [liveModules, setLiveModules] = useState<
    Array<{
      id: string;
      status: string;
      summary?: string;
      findings?: unknown;
      missing?: string[];
      error?: string;
    }>
  >([]);
  const [liveBelowBaseline, setLiveBelowBaseline] = useState<
    Array<{
      post_id: string;
      url: string;
      relative_views: number | null;
      action: string;
    }>
  >([]);
  const [sqliteJobs, setSqliteJobs] = useState<
    Array<{
      id: string;
      state: string;
      progress: number;
    }>
  >([]);

  const report = SAMPLE_CHANNEL_REPORT;
  const single = SAMPLE_SINGLE_VIDEO;

  async function refreshSqliteJobs() {
    try {
      const res = await fetch("/api/v1/reports/jobs?limit=6&offset=0");
      if (res.ok) {
        const data = await res.json();
        setSqliteJobs(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {
      // Ignore offline fetch error
    }
  }

  async function pollAndLoadJobResult(jobId: string, initialState: string) {
    setLiveJobId(jobId);
    setLiveJobState(initialState || "running");
    setLiveJobProgress(20);
    await refreshSqliteJobs();

    for (let attempt = 0; attempt < 240; attempt++) {
      await new Promise((r) => setTimeout(r, attempt < 10 ? 200 : 1000));
      const pollRes = await fetch(`/api/v1/reports/jobs/${jobId}`);
      if (!pollRes.ok) break;
      const jobInfo = await pollRes.json();
      setLiveJobState(jobInfo.state);
      setLiveJobProgress(jobInfo.progress ?? 0);
      if (jobInfo.state === "completed") {
        const resultRes = await fetch(`/api/v1/reports/jobs/${jobId}/result`);
        if (resultRes.ok) {
          const full = await resultRes.json();
          const perf =
            full?.report_parts?.report_part_1?.quantitative_synthesis?.[0]
              ?.performance ||
            full?.channels?.[0]?.performance ||
            [];
          const mods =
            full?.report_parts?.report_part_2?.qualitative_analysis?.[0]
              ?.modules ||
            full?.channels?.[0]?.qualitative_modules ||
            [];
          const evals =
            full?.report_parts?.report_part_3?.evaluations?.[0]
              ?.below_baseline_posts || [];
          setLivePeerStats(perf);
          setLiveModules(Array.isArray(mods) ? mods : []);
          setLiveBelowBaseline(Array.isArray(evals) ? evals : []);
          setLiveSemanticStatus(full?.semantic_status || null);
        }
        await refreshSqliteJobs();
        break;
      }
      if (jobInfo.state === "failed" || jobInfo.state === "cancelled") {
        await refreshSqliteJobs();
        break;
      }
    }
  }

  async function handleRunLiveReportJob() {
    setLiveJobState("queued");
    try {
      const posts = [1, 2, 3, 4, 5, 6].map((idx) => ({
        id: `post_0${idx}`,
        url: `https://www.tiktok.com/@lumiderm.vn/video/74291820${idx}`,
        published_at: "2026-10-20T09:00:00Z",
        observed_at: "2026-10-25T09:00:00Z",
        format: "short_video",
        duration_seconds: 24,
        views: idx === 1 ? 18200 : idx === 6 ? 124500 : 46000 + idx * 1500,
        likes: idx === 6 ? 8420 : 2100 + idx * 110,
        comments: idx === 6 ? 614 : 180 + idx * 12,
        shares: idx === 6 ? 932 : 220 + idx * 15,
        caption: `Thử nghiệm lâm sàng LumiDerm mẫu số ${idx} phục hồi hàng rào bảo vệ da`,
        transcript: `0s-3s: Kiểm tra độ thẩm thấu của tinh chất LumiDerm mẫu ${idx} trên giấy thử chuyên dụng.`,
        ad_text: `Ưu đãi dùng thử phác đồ phục hồi da nhạy cảm LumiDerm đợt ${idx}.`,
      }));

      const createRes = await fetch("/api/v1/reports/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "channel",
          analysis_mode: analysisMode,
          language: "vi",
          channels: [
            {
              id: "lumiderm.vn",
              name: "LumiDerm Vietnam",
              platform: "tiktok",
              url: "https://www.tiktok.com/@lumiderm.vn",
              posts,
            },
          ],
        }),
      });
      if (!createRes.ok) {
        setLiveJobState("failed");
        return;
      }
      const created = await createRes.json();
      await pollAndLoadJobResult(created.id, created.state);
    } catch {
      setLiveJobState("failed");
    }
  }

  async function handleRunCsvImportJob() {
    setLiveJobState("queued");
    try {
      const csvRows = [
        "id,url,published_at,observed_at,format,duration_seconds,views,likes,comments,shares,caption",
        ...[1, 2, 3, 4, 5, 6].map((idx) => {
          const views =
            idx === 2 ? 15400 : idx === 6 ? 132000 : 48000 + idx * 1200;
          return `csv_0${idx},https://www.tiktok.com/@lumiderm.vn/video/84291820${idx},2026-10-20T09:00:00Z,2026-10-25T09:00:00Z,short_video,25,${views},${2200 + idx * 90},${190 + idx * 10},${210 + idx * 12},Bản ghi CSV chuẩn hóa bài số ${idx}`;
        }),
      ].join("\n");

      const createRes = await fetch("/api/v1/reports/imports/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: "lumiderm.vn",
          channel_name: "LumiDerm Vietnam (CSV)",
          platform: "tiktok",
          channel_url: "https://www.tiktok.com/@lumiderm.vn",
          csv_text: csvRows,
          analysis_mode: analysisMode,
          language: "vi",
        }),
      });
      if (!createRes.ok) {
        setLiveJobState("failed");
        return;
      }
      const created = await createRes.json();
      await pollAndLoadJobResult(created.id, created.state);
    } catch {
      setLiveJobState("failed");
    }
  }

  function toggleModule(key: string) {
    setOpenModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleExportMarkdown() {
    const lines = [
      `# Hồ sơ Phân tích Chiến lược: ${report.brand_name}`,
      `Phạm vi dữ liệu: ${report.analyzed_window}`,
      `Lượt theo dõi: ${report.quantitative.followers.toLocaleString("en-US")} | Tỷ lệ tương tác trung bình: ${report.quantitative.er_percent}%`,
      "",
      "## 8 Học phần Phân tích Chiến lược",
      ...report.modules_01_to_08.map(
        (m) => `### ${m.index}. ${m.title} (${m.meta})\n${m.summary}`
      ),
    ];
    const blob = new Blob([lines.join("\n\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cadencelab-strategic-dossier.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportedFlag(true);
    setTimeout(() => setExportedFlag(false), 2500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <div className="inner-strip" role="note"><strong>Đang xem báo cáo mẫu</strong><p className="brand-sub">Các số liệu và nhận xét bên dưới là dữ liệu minh họa LumiDerm, không phải kết quả từ link của anh. Để phân tích link thật, dùng ô nhập link ở Trang chủ.</p></div>
      {/* Top Mode Selector & Export Bar on Smoked Glass */}
      <section className="glass-pane" aria-label="Bộ chọn loại hồ sơ phân tích">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <h2>Hồ sơ Phân tích Chiến lược và Giải mã Nội dung</h2>
            <p className="brand-sub" style={{ marginTop: "var(--space-2xs)" }}>
              Tầng 1 kế thừa cấu trúc báo cáo 8 học phần, kết hợp trực tiếp với chỉ số nhịp dựng CFI và khoảng trống nhu cầu
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
            <button
              type="button"
              className={reportMode === "channel" ? "btn-pill" : "btn-ghost"}
              onClick={() => onChangeReportMode("channel")}
            >
              Báo cáo kênh
            </button>
            <button
              type="button"
              className={reportMode === "single" ? "btn-pill" : "btn-ghost"}
              onClick={() => onChangeReportMode("single")}
            >
              Báo cáo 1 video
            </button>
            <button
              type="button"
              className={reportMode === "competitor" ? "btn-pill" : "btn-ghost"}
              onClick={() => onChangeReportMode("competitor")}
            >
              Đối sánh 1-vs-1
            </button>
            <button
              type="button"
              className={reportMode === "merge" ? "btn-pill" : "btn-ghost"}
              onClick={() => onChangeReportMode("merge")}
            >
              Gộp đa kênh
            </button>
          </div>
        </div>
      </section>

      {reportMode === "channel" && (
        <>
          {/* Quantitative Synthesis on Slate */}
          <section className="slate-pane" aria-label="Tổng hợp định lượng kênh">
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
                <h2>{report.brand_name}</h2>
                <p className="brand-sub" style={{ marginTop: "var(--space-3xs)" }}>
                  {report.analyzed_window} (Dữ liệu mẫu kiểm thử)
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", alignItems: "center" }}>
                <span className="tag tag--periwinkle">
                  {report.posts_count} bài đăng tự nhiên
                </span>
                <span className="tag tag--apricot">
                  {report.active_ads_count} quảng cáo đang hoạt động
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    setAnalysisMode((m) =>
                      m === "statistics" ? "semantic" : "statistics"
                    )
                  }
                >
                  {analysisMode === "statistics"
                    ? "Chế độ: Thống kê"
                    : "Chế độ: Ngữ nghĩa"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleRunLiveReportJob}
                >
                  {liveJobState === "completed"
                    ? "Chạy lại Job JSON"
                    : "Chạy Job JSON"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleRunCsvImportJob}
                >
                  Nhập CSV mẫu
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={refreshSqliteJobs}
                >
                  Lịch sử DB
                </button>
                <button
                  type="button"
                  className={exportedFlag ? "btn-pill is-success" : "btn-ghost"}
                  onClick={handleExportMarkdown}
                >
                  {exportedFlag ? "Đã xuất (.md)" : "Xuất hồ sơ (.md)"}
                </button>
              </div>
            </div>

            {/* Dusk Ruled Tally of 4 Figures */}
            <div className="ruled-tally">
              <div className="tally-item">
                <span className="tally-label">Lượt theo dõi kênh</span>
                <span className="tally-figure">
                  {report.quantitative.followers.toLocaleString("en-US")}
                </span>
                <span className="tally-sub">
                  Tần suất {report.quantitative.posting_per_week} bài mỗi tuần
                </span>
              </div>
              <div className="tally-item">
                <span className="tally-label">Tổng lượt xem mẫu khảo sát</span>
                <span className="tally-figure">
                  {report.quantitative.total_views.toLocaleString("en-US")}
                </span>
                <span className="tally-sub">
                  Trung bình {report.quantitative.avg_views.toLocaleString("en-US")} mỗi bài
                </span>
              </div>
              <div className="tally-item">
                <span className="tally-label">Tổng lượt tương tác</span>
                <span className="tally-figure">
                  {(
                    report.quantitative.total_reactions +
                    report.quantitative.total_comments +
                    report.quantitative.total_shares
                  ).toLocaleString("en-US")}
                </span>
                <span className="tally-sub">
                  Trung bình{" "}
                  {(
                    report.quantitative.avg_reactions +
                    report.quantitative.avg_comments +
                    report.quantitative.avg_shares
                  ).toLocaleString("en-US")}{" "}
                  mỗi bài
                </span>
              </div>
              <div className="tally-item">
                <span className="tally-label">Tỷ lệ tương tác trung bình (ER)</span>
                <span className="tally-figure">{report.quantitative.er_percent}%</span>
                <span className="tally-sub">
                  Đỉnh tương tác vào Thứ 5 (6.9%)
                </span>
              </div>
            </div>

            {/* Strip of Nights (Weekday Activity Bars) + Format/CTA Stacked Horizontal Bars */}
            <div className="workspace-grid" style={{ marginTop: "var(--space-lg)" }}>
              <div className="col-6 inner-strip">
                <h3>Hiệu suất đăng bài theo thứ trong tuần</h3>
                <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-md)" }}>
                  Chiều cao cột thể hiện tỷ lệ tương tác ER trung bình; chấm cam đánh dấu ngày hiệu quả cao nhất
                </p>
                <svg viewBox="0 0 420 120" className="chart-svg" role="img" aria-label="Biểu đồ hiệu suất theo thứ trong tuần">
                  <line x1="0" y1="20" x2="420" y2="20" className="chart-gridline" />
                  <line x1="0" y1="55" x2="420" y2="55" className="chart-gridline" />
                  <line x1="0" y1="90" x2="420" y2="90" className="chart-gridline" />
                  {report.quantitative.weekday_activity.map((item, idx) => {
                    const barHeight = Math.round((item.avg_er / 8.0) * 70);
                    const x = 18 + idx * 56;
                    const y = 90 - barHeight;
                    return (
                      <g key={item.day}>
                        {item.flagged && (
                          <circle
                            cx={x + 11}
                            cy={y - 8}
                            r="3.5"
                            className="chart-marker-apricot"
                          />
                        )}
                        <rect
                          x={x}
                          y={y}
                          width="22"
                          height={barHeight}
                          rx="2"
                          className={
                            item.flagged ? "chart-bar-apricot" : "chart-bar-accent"
                          }
                        />
                        <text x={x + 11} y="106" textAnchor="middle" className="chart-label">
                          {item.day}
                        </text>
                        <text x={x + 11} y="118" textAnchor="middle" className="chart-label">
                          {item.avg_er}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="col-6 inner-strip">
                <h3>Phân bổ định dạng bài đăng và lời kêu gọi quảng cáo</h3>
                <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-md)" }}>
                  Biểu diễn tỷ lệ thành phần bằng thanh ngang xếp chồng theo chuẩn trực quan hóa Hallmark
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                  <div>
                    <div className="field-label">Cơ cấu định dạng nội dung tự nhiên (40 bài)</div>
                    <svg viewBox="0 0 400 20" className="chart-svg" role="img" aria-label="Thanh tỷ lệ định dạng nội dung">
                      <rect x="0" y="2" width="216" height="16" rx="2" className="chart-bar-accent" />
                      <rect x="220" y="2" width="116" height="16" rx="2" className="chart-bar-apricot" />
                      <rect x="340" y="2" width="60" height="16" rx="2" className="chart-bar-muted" />
                    </svg>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xs)", marginTop: "var(--space-xs)" }}>
                      {report.quantitative.format_mix.map((f) => (
                        <div
                          key={f.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <span>{f.label}</span>
                          <span className="num">
                            {f.count} bài ({f.share_pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="field-label">Cơ cấu nút kêu gọi hành động trên Ads Library (12 mẫu)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xs)" }}>
                      {report.quantitative.cta_mix.map((c) => (
                        <div
                          key={c.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <span>{c.label}</span>
                          <span className="num">
                            {c.count} mẫu ({c.share_pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {livePeerStats.length > 0 && (
              <div className="inner-strip" style={{ marginTop: "var(--space-md)" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "var(--space-sm)",
                    marginBottom: "var(--space-xs)",
                  }}
                >
                  <h3>
                    Kết quả Pipeline 3 Phần (report_part_1, report_part_2, report_part_3) từ Report Worker API
                  </h3>
                  <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
                    <span className="tag tag--periwinkle num">
                      Job: {liveJobId?.slice(0, 8)} ({liveJobState} {liveJobProgress}%)
                    </span>
                    {liveSemanticStatus && (
                      <span className="tag tag--apricot num">
                        semantic_status: {liveSemanticStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mã bài đăng</th>
                        <th className="num">Lượt xem</th>
                        <th className="num">Trung vị Cohort (Leave-One-Out)</th>
                        <th className="num">Tỷ lệ so với Cohort</th>
                        <th className="num">Tương tác / Lượt xem</th>
                        <th>Phân loại hiệu suất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {livePeerStats.map((row) => (
                        <tr key={row.post_id}>
                          <td className="num">{row.post_id}</td>
                          <td className="num">{row.views.toLocaleString("en-US")}</td>
                          <td className="num">
                            {row.peer_median_views !== null
                              ? row.peer_median_views.toLocaleString("en-US")
                              : "N/A"}
                          </td>
                          <td className="num">
                            {row.relative_views !== null
                              ? `${row.relative_views.toFixed(2)}x`
                              : "N/A"}
                          </td>
                          <td className="num">
                            {row.engagement_per_view !== null
                              ? `${(row.engagement_per_view * 100).toFixed(2)}%`
                              : "N/A"}
                          </td>
                          <td>
                            <span
                              className={
                                row.status === "below_peer_baseline"
                                  ? "tag tag--apricot"
                                  : "tag tag--periwinkle"
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {liveModules.length > 0 && (
                  <div style={{ marginTop: "var(--space-md)" }}>
                    <div className="field-label">
                      Trạng thái 8 học phần từ report_part_2 ({liveModules.length} học phần)
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--space-xs)",
                        marginTop: "var(--space-2xs)",
                      }}
                    >
                      {liveModules.map((m) => (
                        <span
                          key={m.id}
                          className={
                            m.status === "analyzed" || m.status === "descriptive_only"
                              ? "tag tag--periwinkle num"
                              : "tag tag--apricot num"
                          }
                        >
                          {m.id}: {m.status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {liveBelowBaseline.length > 0 && (
                  <div style={{ marginTop: "var(--space-sm)", fontSize: "var(--text-xs)" }}>
                    <div className="field-label">
                      Cảnh báo bài đăng dưới ngưỡng từ report_part_3 ({liveBelowBaseline.length} bài)
                    </div>
                    {liveBelowBaseline.map((b) => (
                      <div key={b.post_id} style={{ marginTop: "var(--space-3xs)" }}>
                        <strong className="num">{b.post_id}</strong> ({b.relative_views?.toFixed(2)}x trung vị): {b.action}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sqliteJobs.length > 0 && (
              <div className="inner-strip" style={{ marginTop: "var(--space-md)" }}>
                <div className="field-label">
                  Bản ghi Job lưu trong SQLite Local (.sociallens/jobs.sqlite3)
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--space-xs)",
                    marginTop: "var(--space-2xs)",
                  }}
                >
                  {sqliteJobs.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      className="btn-ghost"
                      onClick={() => pollAndLoadJobResult(j.id, j.state)}
                    >
                      {j.id.slice(0, 8)} ({j.state} {j.progress}%)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Dusk Bone Well: 8-Module Qualitative Strategic Dossier + 3 Evaluations */}
          <section className="bone-well" aria-label="Hồ sơ phân tích định tính 8 học phần trên nền giấy sáng">
            <div className="workspace-grid">
              <div className="col-7">
                <div className="bone-sheet">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "var(--space-sm)",
                      marginBottom: "var(--space-md)",
                    }}
                  >
                    <div>
                      <h2 style={{ color: "var(--color-well-ink)" }}>
                        Phân tích Chiến lược 8 Học phần (01 đến 08)
                      </h2>
                      <p className="bone-muted" style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-3xs)" }}>
                        Đặt trên giếng giấy sáng (Bone Well) giúp đọc báo cáo dài không mỏi mắt
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                      <button
                        type="button"
                        className="btn-bone"
                        onClick={() =>
                          setOpenModules({
                            brand_positioning: true,
                            tone_of_voice: true,
                            target_audience: true,
                            posting_and_trends: true,
                            content_pillars: true,
                            content_structure_analysis: true,
                            reel_and_cfi_diagnostics: true,
                            ad_strategy: true,
                          })
                        }
                      >
                        Mở tất cả 8 mục
                      </button>
                      <button
                        type="button"
                        className="btn-bone"
                        onClick={() => setOpenModules({})}
                      >
                        Thu gọn
                      </button>
                    </div>
                  </div>

                  <div className="dossier-accordion">
                    {report.modules_01_to_08.map((mod) => {
                      const isOpen = !!openModules[mod.key];
                      return (
                        <div key={mod.key} className="dossier-item">
                          <button
                            type="button"
                            className="dossier-trigger"
                            aria-expanded={isOpen}
                            onClick={() => toggleModule(mod.key)}
                          >
                            <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)" }}>
                              <span className="dossier-index">{mod.index}</span>
                              <span>{mod.title}</span>
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                              <span
                                className={
                                  mod.key === "reel_and_cfi_diagnostics"
                                    ? "tag tag--bone-apricot"
                                    : "tag tag--bone-periwinkle"
                                }
                              >
                                {mod.meta}
                              </span>
                              <span className="num bone-muted" style={{ fontSize: "var(--text-xs)" }}>
                                {isOpen ? "Thu gọn" : "Mở"}
                              </span>
                            </span>
                          </button>

                          {isOpen && (
                            <div className="dossier-body">
                              <p style={{ marginBottom: "var(--space-sm)", fontWeight: 500 }}>
                                {mod.summary}
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                                {mod.details.map((d) => (
                                  <div
                                    key={d.label}
                                    style={{
                                      paddingTop: "var(--space-xs)",
                                      borderTop: "var(--rule-hair) solid var(--color-well-rule)",
                                    }}
                                  >
                                    <div
                                      className="bone-muted"
                                      style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}
                                    >
                                      {d.label}
                                    </div>
                                    <p style={{ marginTop: "var(--space-3xs)" }}>{d.text}</p>
                                  </div>
                                ))}
                              </div>
                              {mod.key === "reel_and_cfi_diagnostics" && (
                                <div style={{ marginTop: "var(--space-md)" }}>
                                  <button
                                    type="button"
                                    className="btn-bone"
                                    onClick={() => onOpenCFIWithPreset("paced_reel")}
                                  >
                                    Kiểm tra sóng CFI 0.5s
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column inside Bone Well: Evaluations (Pillar / Formula / Funnel) + AI Remix Studio */}
              <div className="col-5" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div className="bone-sheet">
                  <h3 style={{ color: "var(--color-well-ink)", marginBottom: "var(--space-xs)" }}>
                    Ma trận Đánh giá và Hành động (Strengths, Weaknesses, Actions)
                  </h3>
                  <p className="bone-muted" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-md)" }}>
                    Tổng hợp điểm mạnh, điểm nghẽn và đề xuất hành động cụ thể trên 3 trục chiến lược
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    {report.evaluations.map((ev) => (
                      <div
                        key={ev.key}
                        style={{
                          paddingTop: "var(--space-sm)",
                          borderTop: "var(--rule-hair) solid var(--color-well-rule)",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", marginBottom: "var(--space-xs)" }}>
                          {ev.label}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                          <div>
                            <span className="tag tag--bone-periwinkle">Điểm mạnh</span>
                            <ul style={{ margin: "var(--space-2xs) 0 0 var(--space-md)", padding: 0 }}>
                              {ev.strengths.map((s) => (
                                <li key={s} style={{ marginBottom: "var(--space-3xs)" }}>{s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="tag tag--bone-apricot">Điểm yếu cần khắc phục</span>
                            <ul style={{ margin: "var(--space-2xs) 0 0 var(--space-md)", padding: 0 }}>
                              {ev.weaknesses.map((w) => (
                                <li key={w} style={{ marginBottom: "var(--space-3xs)" }}>{w}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong style={{ display: "block", marginBottom: "var(--space-3xs)" }}>
                              Hành động đề xuất:
                            </strong>
                            <ul style={{ margin: "0 0 0 var(--space-md)", padding: 0 }}>
                              {ev.actions.map((a) => (
                                <li key={a} style={{ marginBottom: "var(--space-3xs)" }}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Content Remix Studio */}
                <div className="bone-sheet">
                  <h3 style={{ color: "var(--color-well-ink)", marginBottom: "var(--space-xs)" }}>
                    Remix Studio: Kịch bản Đối trọng từ Khoảng trống Nhu cầu
                  </h3>
                  <p className="bone-muted" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--space-sm)" }}>
                    Chuyển hóa trực tiếp câu hỏi khán giả chưa được phủ và nhịp dựng CFI thành kịch bản quay
                  </p>

                  <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
                    {report.video_ideas.map((idea, idx) => (
                      <button
                        key={idea.title}
                        type="button"
                        className="btn-bone"
                        aria-pressed={selectedIdeaIndex === idx}
                        onClick={() => setSelectedIdeaIndex(idx)}
                      >
                        Kịch bản #{idx + 1}
                      </button>
                    ))}
                  </div>

                  {report.video_ideas[selectedIdeaIndex] && (
                    <div
                      style={{
                        padding: "var(--space-sm)",
                        background: "var(--color-well)",
                        borderRadius: "var(--radius-inner)",
                        fontSize: "var(--text-xs)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-xs)",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                        {report.video_ideas[selectedIdeaIndex].title}
                      </div>
                      <div>
                        <span className="tag tag--bone-apricot">
                          {report.video_ideas[selectedIdeaIndex].target_pillar}
                        </span>
                      </div>
                      <div>
                        <strong>Mở đầu Hook (0.0s - 3.0s): </strong>
                        <span>{report.video_ideas[selectedIdeaIndex].hook_0_3s}</span>
                      </div>
                      <div>
                        <strong>Chỉ dẫn nhịp dựng CFI: </strong>
                        <span>{report.video_ideas[selectedIdeaIndex].pacing_note}</span>
                      </div>
                      <div>
                        <strong>Căn cứ dữ liệu: </strong>
                        <span>{report.video_ideas[selectedIdeaIndex].reason}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {reportMode === "single" && (
        <section className="bone-well" aria-label="Báo cáo phân tích chuyên sâu 1 video lẻ">
          <div className="workspace-grid">
            <div className="col-5">
              <div className="bone-sheet">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-sm)" }}>
                  <h2 style={{ color: "var(--color-well-ink)" }}>
                    Video #{single.post_id}
                  </h2>
                  <span className="tag tag--bone-periwinkle">{single.platform}</span>
                </div>
                <p className="bone-muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-3xs)" }}>
                  Kênh: {single.owner}, đăng lúc {single.create_time} (Dữ liệu mẫu)
                </p>

                <div
                  style={{
                    marginTop: "var(--space-md)",
                    padding: "var(--space-sm)",
                    background: "var(--color-well)",
                    borderRadius: "var(--radius-inner)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <div className="bone-muted" style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>
                    Mô tả bài đăng (Caption)
                  </div>
                  <p style={{ marginTop: "var(--space-3xs)" }}>{single.caption}</p>
                </div>

                <div
                  style={{
                    marginTop: "var(--space-sm)",
                    padding: "var(--space-sm)",
                    background: "var(--color-well)",
                    borderRadius: "var(--radius-inner)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <div className="bone-muted" style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>
                    Lời thoại đầy đủ (Transcript)
                  </div>
                  <p style={{ marginTop: "var(--space-3xs)" }}>{single.transcript}</p>
                </div>

                <table className="data-table bone-table" style={{ marginTop: "var(--space-md)" }}>
                  <thead>
                    <tr>
                      <th>Chỉ số đo lường</th>
                      <th className="num">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Lượt xem (Views)</td>
                      <td className="num">{single.metrics.view.toLocaleString("en-US")}</td>
                    </tr>
                    <tr>
                      <td>Lượt thích (Likes)</td>
                      <td className="num">{single.metrics.like.toLocaleString("en-US")}</td>
                    </tr>
                    <tr>
                      <td>Bình luận (Comments)</td>
                      <td className="num">{single.metrics.comment.toLocaleString("en-US")}</td>
                    </tr>
                    <tr>
                      <td>Chia sẻ / Lưu trữ (Shares / Saves)</td>
                      <td className="num">
                        {single.metrics.share.toLocaleString("en-US")} /{" "}
                        {single.metrics.save.toLocaleString("en-US")}
                      </td>
                    </tr>
                    <tr>
                      <td>Tỷ lệ tương tác (ER)</td>
                      <td className="num" style={{ fontWeight: 600 }}>{single.calculated.er_percent}%</td>
                    </tr>
                    <tr>
                      <td>Điểm nhịp dựng CFI (Heuristic)</td>
                      <td className="num" style={{ fontWeight: 600 }}>{single.calculated.pacing_score}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: "var(--space-md)" }}>
                  <button
                    type="button"
                    className="btn-bone"
                    onClick={() => onOpenCFIWithPreset("paced_reel")}
                  >
                    Chẩn đoán CFI 0.5s
                  </button>
                </div>
              </div>
            </div>

            <div className="col-7" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div className="bone-sheet">
                <h3 style={{ color: "var(--color-well-ink)", marginBottom: "var(--space-sm)" }}>
                  Giải phẫu Cấu trúc Nội dung (Hook, Body, CTA và Tâm lý)
                </h3>
                <div className="data-table-wrap">
                  <table className="data-table bone-table">
                    <thead>
                      <tr>
                        <th>Thành phần</th>
                        <th>Cơ chế triển khai (Mechanics)</th>
                        <th>Đòn bẩy tâm lý (Psychology)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Mở đầu (Hook 0-3s)</td>
                        <td>{single.structure.hook.mechanics}</td>
                        <td>{single.structure.hook.psychology}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Thân bài (Body)</td>
                        <td>{single.structure.body.structure}</td>
                        <td>{single.structure.body.triggers}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Kêu gọi (CTA)</td>
                        <td>{single.structure.cta.mechanics}</td>
                        <td>{single.structure.cta.psychology}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bone-sheet">
                <h3 style={{ color: "var(--color-well-ink)", marginBottom: "var(--space-sm)" }}>
                  Bình luận tiêu biểu và Phản ứng khán giả
                </h3>
                <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-sm)" }}>
                  <strong>Thái độ người xem:</strong> {single.structure.audience_reaction.sentiment}
                </p>
                <div className="data-table-wrap">
                  <table className="data-table bone-table">
                    <thead>
                      <tr>
                        <th>Người dùng</th>
                        <th>Nội dung bình luận</th>
                        <th className="num">Lượt thích</th>
                        <th className="num">Phản hồi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {single.top_comments.map((c) => (
                        <tr key={c.author}>
                          <td style={{ fontWeight: 500 }}>{c.author}</td>
                          <td>{c.text}</td>
                          <td className="num">{c.likes}</td>
                          <td className="num">{c.replies}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {reportMode === "competitor" && (
        <section className="bone-well" aria-label="Báo cáo đối sánh trực tiếp 2 đối thủ">
          <div className="bone-sheet">
            <h2 style={{ color: "var(--color-well-ink)", marginBottom: "var(--space-xs)" }}>
              Đối sánh Trực tiếp 1-vs-1: LumiDerm Vietnam và DermaLab Studio (Dữ liệu mẫu)
            </h2>
            <p className="bone-muted" style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-md)" }}>
              So sánh định lượng hiệu suất nội dung, nhịp dựng CFI trung bình và hoạt động quảng cáo trong cùng cửa sổ 30 ngày
            </p>
            <div className="data-table-wrap">
              <table className="data-table bone-table">
                <thead>
                  <tr>
                    <th>Tiêu chí đối sánh</th>
                    <th className="num">LumiDerm Vietnam</th>
                    <th className="num">DermaLab Studio</th>
                    <th>Nhận định chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Tần suất đăng bài mỗi tuần</td>
                    <td className="num">4.5 bài</td>
                    <td className="num">6.8 bài</td>
                    <td>DermaLab phủ dày số lượng nhưng trùng lặp chủ đề đập hộp.</td>
                  </tr>
                  <tr>
                    <td>Tỷ lệ tương tác trung bình (ER)</td>
                    <td className="num">5.66%</td>
                    <td className="num">3.42%</td>
                    <td>LumiDerm vượt +2.24% nhờ tuyến nội dung thử nghiệm trên giấy thấm.</td>
                  </tr>
                  <tr>
                    <td>Điểm nhịp dựng CFI trung bình (0.5s)</td>
                    <td className="num">0.584 (Hạng B)</td>
                    <td className="num">0.392 (Hạng C)</td>
                    <td>Video của DermaLab thường có đoạn tĩnh kéo dài quá 4 giây ở phần mở đầu.</td>
                  </tr>
                  <tr>
                    <td>Số mẫu quảng cáo đang chạy (Ads Library)</td>
                    <td className="num">12 mẫu</td>
                    <td className="num">19 mẫu</td>
                    <td>DermaLab dồn ngân sách cho quảng cáo giảm giá trực tiếp 30%.</td>
                  </tr>
                  <tr>
                    <td>Độ phủ câu hỏi phân biệt hàng thật giả</td>
                    <td className="num">0.31 (Chưa phủ)</td>
                    <td className="num">0.28 (Chưa phủ)</td>
                    <td>Cơ hội đại dương xanh cho bên nào ra chuỗi video kiểm định trước.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {reportMode === "merge" && (
        <section className="bone-well" aria-label="Báo cáo gộp đa kênh">
          <div className="bone-sheet">
            <h2 style={{ color: "var(--color-well-ink)", marginBottom: "var(--space-xs)" }}>
              Báo cáo Hợp nhất Đa kênh (Cross-Channel Merge: TikTok, Facebook, Instagram, YouTube)
            </h2>
            <p className="bone-muted" style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-md)" }}>
              Kiểm toán sự đồng bộ thông điệp, phân bổ định dạng và hiệu suất chuyển đổi giữa 4 nền tảng của thương hiệu (Dữ liệu mẫu)
            </p>
            <div className="data-table-wrap">
              <table className="data-table bone-table">
                <thead>
                  <tr>
                    <th>Nền tảng</th>
                    <th>Vai trò trong phễu</th>
                    <th className="num">Bài đăng / 30 ngày</th>
                    <th className="num">Lượt xem trung bình</th>
                    <th className="num">Tỷ lệ tương tác (ER)</th>
                    <th>Trạng thái đồng bộ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>TikTok</td>
                    <td>Đỉnh phễu (Thu hút nhận biết &amp; thử nghiệm trực quan)</td>
                    <td className="num">18</td>
                    <td className="num">48,000</td>
                    <td className="num">5.66%</td>
                    <td>Hiệu quả cao nhất ở định dạng 15s - 25s.</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Facebook Fanpage</td>
                    <td>Giữa &amp; Cuối phễu (Tư vấn tin nhắn &amp; Ads Library)</td>
                    <td className="num">24</td>
                    <td className="num">19,400</td>
                    <td className="num">3.85%</td>
                    <td>Chuyển đổi tốt qua bài Carousel bảng thành phần.</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Instagram Reels</td>
                    <td>Giữ chân khách hàng cũ &amp; thẩm mỹ thương hiệu</td>
                    <td className="num">12</td>
                    <td className="num">14,200</td>
                    <td className="num">4.12%</td>
                    <td>Đăng lại nguyên bản từ TikTok, chưa tách phụ đề riêng.</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>YouTube Shorts</td>
                    <td>Lưu trữ tìm kiếm dài hạn (Search Evergreen)</td>
                    <td className="num">8</td>
                    <td className="num">22,800</td>
                    <td className="num">4.50%</td>
                    <td>Thiếu liên kết dẫn về video giải thích chuyên sâu dài 5 phút.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
