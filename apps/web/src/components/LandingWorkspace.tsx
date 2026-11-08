"use client";

import React, { useState } from "react";

type WorkspaceTab = "landing" | "reports" | "cfi" | "trend" | "gaps";
type ReportMode = "channel" | "single" | "competitor" | "merge";

interface LandingWorkspaceProps {
  onNavigateTab: (tab: WorkspaceTab, mode?: ReportMode) => void;
  onOpenCFIWithPreset: (presetKey: string) => void;
  onAnalyzeSource: (url: string) => void;
  isLoggedIn: boolean;
  isDesktop?: boolean;
  onOpenAuthModal: (contextMsg?: string) => void;
  onOpenDownloadModal: () => void;
}

interface TourEngineItem {
  id: "cfi" | "trend" | "gaps" | "reports";
  index: string;
  title: string;
  subtitle: string;
  formulaNote: string;
  badge: string;
  ctaLabel: string;
  metrics: Array<{ label: string; value: string; note: string }>;
  highlights: string[];
}

const TOUR_ENGINES: TourEngineItem[] = [
  {
    id: "cfi",
    index: "01",
    title: "Chẩn đoán nhịp dựng CFI từng 0.5 giây",
    subtitle:
      "Tách biệt giai đoạn mở đầu Hook (0s đến 3s) và thân bài Body, phát hiện chính xác giây tụt nhịp hoặc quá tải tín hiệu.",
    formulaNote:
      "Kết hợp biến thiên hình ảnh V(t), biến thiên âm thanh A(t), mật độ ngữ nghĩa S(t) và giảm trừ độ dư thừa R(t) để bảo vệ các video chuyên gia nói chuyện có mật độ thông tin cao.",
    badge: "Độ phân giải Δt = 0.5s",
    ctaLabel: "Mở trạm CFI 0.5s",
    metrics: [
      {
        label: "Điểm nhịp dựng mẫu",
        value: "0.584 (Hạng B)",
        note: "Đo trên 30 lát cắt 0.5 giây",
      },
      {
        label: "Sức mạnh Hook 3s đầu",
        value: "0.712",
        note: "Vượt ngưỡng giữ chân mở đầu",
      },
      {
        label: "Điểm cần cắt dựng lại",
        value: "4.5s, 9.0s",
        note: "Cảnh báo vùng tĩnh kéo dài",
      },
    ],
    highlights: [
      "Không phán xét cảm tính: chỉ rõ mốc giây bắt đầu của từng hố chán nản (Boredom Valley).",
      "Bảo vệ video talking-head: không phạt cảnh quay tĩnh nếu mật độ ngữ nghĩa lời thoại S(t) cao.",
      "Tích hợp trình chỉnh sửa tín hiệu trực tiếp để kiểm thử kịch bản cắt dựng trước khi xuất file.",
    ],
  },
  {
    id: "trend",
    index: "02",
    title: "Mô hình dịch tễ học lan truyền SEIR-F",
    subtitle:
      "Khớp tốc độ lây truyền (beta) và quy mô phơi nhiễm ban đầu (E0) từ chuỗi 7 đến 365 ngày quan sát thực tế.",
    formulaNote:
      "Giải hệ phương trình vi phân bậc 4 (RK4) bảo toàn tổng dân số S + E + I + R = N, có tính đến hệ số nhàm chán khán giả F(t) làm suy giảm tốc độ lan truyền.",
    badge: "RK4 + Least Squares",
    ctaLabel: "Mở dự báo SEIR-F",
    metrics: [
      {
        label: "Tốc độ lây truyền (beta)",
        value: "0.482 / ngày",
        note: "Khớp bằng hàm mất mát soft_l1",
      },
      {
        label: "Sai số huấn luyện (Log RMSE)",
        value: "0.041",
        note: "Kiểm định trên miền ln(1 + I)",
      },
      {
        label: "Pha xu hướng hiện tại",
        value: "SURGING",
        note: "Khuyến nghị tung biến thể nội dung",
      },
    ],
    highlights: [
      "Tách bạch 4 pha rõ ràng: Đang bùng nổ (SURGING), Đạt đỉnh (PLATEAU), Suy thoái (DECLINING) và Tắt dần (INACTIVE).",
      "Đo lường độ mỏi của khán giả (Audience Fatigue) để tránh đổ ngân sách quảng cáo vào xu hướng đã bão hòa.",
      "Cung cấp đầy đủ thông số chẩn đoán sai số khớp mẫu (Training MAE và Log RMSE).",
    ],
  },
  {
    id: "gaps",
    index: "03",
    title: "Truy xuất khoảng trống nội dung có dẫn chứng",
    subtitle:
      "Đối chiếu câu hỏi thật của khán giả trong bình luận với kho bài đăng đối thủ bằng vector chuẩn hóa L2.",
    formulaNote:
      "Tự động khử trùng lặp câu hỏi, loại bỏ các chủ đề đối thủ đã phủ (Cosine Similarity >= 0.80) và xếp hạng cơ hội theo lượng nhu cầu thực tế.",
    badge: "Cosine < 0.80 + URL nguồn",
    ctaLabel: "Mở trạm Khoảng trống",
    metrics: [
      {
        label: "Độ tương đồng gần nhất",
        value: "0.284",
        note: "Đối thủ chưa có bài giải đáp sâu",
      },
      {
        label: "Tín hiệu nhu cầu",
        value: "64 bình luận",
        note: "Kèm liên kết dẫn chứng gốc",
      },
      {
        label: "Điểm cơ hội thị trường",
        value: "0.546",
        note: "Ưu tiên sản xuất video mới",
      },
    ],
    highlights: [
      "Không tự bịa ý tưởng: mọi khoảng trống đều bắt buộc gắn kèm URL bình luận hoặc truy vấn gốc.",
      "Khử trùng lặp thông minh: gom các câu hỏi trùng nghĩa và lấy mức nhu cầu thực tế cao nhất.",
      "Chuyển hóa trực tiếp khoảng trống thành khung kịch bản đối trọng trong Remix Studio.",
    ],
  },
  {
    id: "reports",
    index: "04",
    title: "Hồ sơ 8 học phần và đối chiếu Cohort Leave-One-Out",
    subtitle:
      "Đánh giá công bằng từng bài đăng so với các bài cùng định dạng, cùng độ dài và cùng độ tuổi trên kênh.",
    formulaNote:
      "Mỗi nhận định định tính của AI đều bị kiểm tra chéo với văn bản gốc: bắt buộc trích dẫn đúng post_id, trường dữ liệu và câu trích dẫn nguyên văn (8 đến 400 ký tự).",
    badge: "SQLite WAL + Trích dẫn thật",
    ctaLabel: "Mở Hồ sơ 8 học phần",
    metrics: [
      {
        label: "Quy tắc phát hiện bài tụt hậu",
        value: "< 0.5x trung vị",
        note: "Tối thiểu 5 bài đồng dạng (Cohort)",
      },
      {
        label: "Kiểm chứng trích dẫn AI",
        value: "100% khớp nguồn",
        note: "Chặn hoàn toàn việc tự bịa số liệu",
      },
      {
        label: "Lưu trữ bền vững",
        value: "SQLite WAL",
        note: "Hỗ trợ nhập CSV và JSON chuẩn hóa",
      },
    ],
    highlights: [
      "4 chế độ giải phẫu: Báo cáo Kênh, Báo cáo 1 Video lẻ, Đối sánh 1-vs-1 và Gộp Đa kênh.",
      "Không biến chỉ số bị ẩn thành số 0: tách bạch rõ bài có dữ liệu và bài thiếu dữ liệu.",
      "Đặt toàn bộ báo cáo dài trên giếng giấy sáng (Bone Well) giúp đọc sâu không mỏi mắt.",
    ],
  },
];

export function LandingWorkspace({
  onNavigateTab,
  onOpenCFIWithPreset,
  onAnalyzeSource,
  isLoggedIn,
  isDesktop = false,
  onOpenAuthModal,
  onOpenDownloadModal,
}: LandingWorkspaceProps) {
  const [channelInput, setChannelInput] = useState<string>("");
  const [activeTourIdx, setActiveTourIdx] = useState<number>(0);

  const currentTour = TOUR_ENGINES[activeTourIdx] ?? TOUR_ENGINES[0];

  function safeNavigateTab(tab: WorkspaceTab, mode?: ReportMode) {
    if (!isLoggedIn && tab !== "landing") {
      onOpenAuthModal(
        "Để sử dụng các trạm phân tích trực tiếp trên bản Web, vui lòng đăng nhập bằng Google hoặc tải bản về máy."
      );
      return;
    }
    onNavigateTab(tab, mode);
  }

  function safeOpenCFI(preset: string) {
    if (!isLoggedIn) {
      onOpenAuthModal(
        "Để xem chẩn đoán sóng CFI 0.5s trực tiếp trên bản Web, vui lòng đăng nhập bằng Google hoặc tải bản về máy."
      );
      return;
    }
    onOpenCFIWithPreset(preset);
  }

  function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn) {
      onOpenAuthModal(
        "Để phân tích đường link trên bản Web, vui lòng đăng nhập bằng Google hoặc tải bản về máy."
      );
      return;
    }
    if (channelInput.trim()) onAnalyzeSource(channelInput.trim());
  }

  return (
    <div>
      {/* Section 1: Dusk Asymmetrical Stage Hero */}
      <section className="landing-hero" aria-label="Giới thiệu CadenceLab">
        <div className="workspace-grid" style={{ alignItems: "center" }}>
          {/* Left 6 Columns: Editorial Pitch & Combined Pill Command */}
          <div className="col-6">
            <div style={{ marginBottom: "var(--space-md)" }}>
              <span className="tag tag--periwinkle">
                <span className="signal-dot signal-dot--periwinkle" />
                <span>
                  CadenceLab v0.2.0: Toán học tất định kết hợp AI có kiểm chứng trích dẫn
                </span>
              </span>
            </div>

            <h1 className="landing-display">
              Giải phẫu nhịp dựng từng 0.5 giây và đối chứng chiến lược kênh bằng dữ liệu thật
            </h1>

            <p className="landing-lead">
              Thay thế các báo cáo đoán chữ cảm tính bằng 3 mô hình định lượng độc lập:
              chẩn đoán sóng chú ý đa phương thức CFI, khớp chuỗi dịch tễ học SEIR-F
              và truy xuất khoảng trống nhu cầu khán giả trên cơ sở dữ liệu SQLite Local.
            </p>

            {/* Action: Desktop Download Option */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
                alignItems: "center",
                marginBottom: "var(--space-md)",
              }}
            >
              <button
                type="button"
                className="btn-ghost"
                style={{
                  padding: "10px 18px",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  border: "var(--rule-hair) solid var(--color-rule)",
                  whiteSpace: "nowrap",
                }}
                onClick={onOpenDownloadModal}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span style={{ whiteSpace: "nowrap" }}>Tải bản về máy</span>
              </button>
            </div>

            <form onSubmit={handleHeroSubmit} className="pill-command">
              <label htmlFor="hero-channel-url" className="brand-sub" style={{ display: "none" }}>
                Link kênh hoặc video công khai
              </label>
              <input
                id="hero-channel-url"
                type="url"
                required
                className="pill-command-input"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="Dán link kênh hoặc video TikTok / YouTube…"
              />
              <button type="submit" className="btn-pill">
                Phân tích link
              </button>
            </form>

            <p className="cfi-help">Phân tích đúng link đã nhập. Nếu chưa lấy được dữ liệu, hệ thống sẽ báo rõ và không thay bằng báo cáo mẫu.</p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-xs)",
                marginTop: "var(--space-md)",
              }}
            >
              <button type="button" className="btn-ghost" onClick={() => safeNavigateTab("reports", "channel")}>Xem báo cáo mẫu</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => safeOpenCFI("paced_reel")}
              >
                Chẩn đoán sóng CFI 0.5s
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => safeNavigateTab("trend")}
              >
                Khớp chuỗi SEIR-F
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => safeNavigateTab("gaps")}
              >
                Tìm khoảng trống nhu cầu
              </button>
            </div>
          </div>

          {/* Right 6 Columns: Smoked Glass Live Product Stage */}
          <div className="col-6">
            <div className="glass-pane" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-xs)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                  <span className="signal-dot signal-dot--periwinkle" />
                  <strong style={{ fontSize: "var(--text-sm)" }}>
                    Trạm kiểm định trực tiếp: LumiDerm Vietnam
                  </strong>
                </div>
                <span className="tag tag--periwinkle num">
                  Cohort Leave-One-Out + CFI 0.5s
                </span>
              </div>

              {/* Mini 0.5s CFI Waveform Stage */}
              <div className="inner-strip">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "var(--space-xs)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span className="brand-sub">
                    Phổ nhịp dựng đa phương thức (0.0s đến 15.0s)
                  </span>
                  <span className="num" style={{ fontWeight: 600 }}>
                    Điểm CFI: 0.584 (Hạng B)
                  </span>
                </div>

                <svg
                  viewBox="0 0 460 105"
                  className="chart-svg"
                  role="img"
                  aria-label="Phổ sóng nhịp dựng CFI từng 0.5 giây"
                >
                  <rect x="0" y="8" width="92" height="76" rx="4" className="chart-zone-hook" />
                  <rect x="138" y="8" width="64" height="76" rx="4" className="chart-zone-valley" />
                  <line x1="0" y1="25" x2="460" y2="25" className="chart-gridline" />
                  <line x1="0" y1="55" x2="460" y2="55" className="chart-gridline" />
                  <line x1="0" y1="84" x2="460" y2="84" className="chart-gridline" />

                  <polyline
                    className="chart-series-accent"
                    points="8,24 38,20 68,28 98,35 128,48 158,72 188,68 218,32 248,26 278,30 308,36 338,22 368,28 398,34 428,25 452,22"
                  />
                  <circle cx="38" cy="20" r="3.5" className="chart-marker-accent" />
                  <circle cx="158" cy="72" r="4" className="chart-marker-apricot" />
                  <circle cx="338" cy="22" r="3.5" className="chart-marker-accent" />

                  <text x="12" y="99" className="chart-label">
                    0.0s (Hook)
                  </text>
                  <text x="142" y="99" className="chart-label">
                    4.5s (Tụt nhịp)
                  </text>
                  <text x="330" y="99" className="chart-label">
                    11.0s (Cao trào)
                  </text>
                </svg>
              </div>

              {/* Dusk Signature: "A run as an account list" */}
              <ul className="account-run-list" aria-label="Danh sách tác vụ phân tích mẫu">
                <li className="account-run-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span className="round-initial num">01</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>Đối chiếu Cohort 40 bài đăng</div>
                      <div className="brand-sub">Cùng định dạng short_video, dưới 30 giây</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span className="tag tag--periwinkle">
                      <span className="signal-dot signal-dot--periwinkle" />
                      <span>Hoàn tất</span>
                    </span>
                    <span className="num" style={{ fontWeight: 600 }}>
                      2.46x
                    </span>
                  </div>
                </li>

                <li className="account-run-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span className="round-initial num">02</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>Kiểm chứng trích dẫn 8 học phần</div>
                      <div className="brand-sub">Khớp chính xác quote từ caption và lời thoại</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                    <span className="tag tag--periwinkle">
                      <span className="signal-dot signal-dot--periwinkle" />
                      <span>Đã xác thực</span>
                    </span>
                    <span className="num" style={{ fontWeight: 600 }}>
                      18/18
                    </span>
                  </div>
                </li>
              </ul>

              {/* Open item closes the list as an Apricot strip with its action */}
              <div className="apricot-strip">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                  <span className="signal-dot signal-dot--apricot" />
                  <span>
                    Phát hiện vùng tĩnh kéo dài tại mốc <strong>4.5s đến 6.0s</strong> cần cắt dựng lại
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => onOpenCFIWithPreset("slump_middle")}
                >
                  Kiểm tra lát cắt
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dusk Signature: Single Ruled Tally of 4 Statement Figures */}
        <div className="ruled-tally" style={{ marginTop: "var(--space-2xl)" }}>
          <div className="tally-item">
            <span className="tally-label">Độ phân giải chẩn đoán nhịp dựng</span>
            <span className="tally-figure">0.5s</span>
            <span className="tally-sub">
              Đo đồng thời hình ảnh, âm thanh và mật độ ngữ nghĩa
            </span>
          </div>
          <div className="tally-item">
            <span className="tally-label">Kiểm thử hồi quy toán học và API</span>
            <span className="tally-figure">54/54</span>
            <span className="tally-sub">
              Bảo toàn dân số SEIR-F và bất biến thứ tự vector
            </span>
          </div>
          <div className="tally-item">
            <span className="tally-label">Hồ sơ giải phẫu chiến lược</span>
            <span className="tally-figure">8 học phần</span>
            <span className="tally-sub">
              Bắt buộc trích dẫn nguyên văn từ dữ liệu bài đăng
            </span>
          </div>
          <div className="tally-item">
            <span className="tally-label">Ngưỡng lọc trùng lặp nội dung</span>
            <span className="tally-figure">0.80</span>
            <span className="tally-sub">
              Cosine Similarity trên không gian vector chuẩn hóa L2
            </span>
          </div>
        </div>
      </section>

      {/* Section 2: Dusk Signature "A tour as a list beside one pane" */}
      <section
        className="landing-section"
        aria-label="Khám phá 4 phân hệ lõi của CadenceLab"
      >
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h2>Bốn phân hệ lõi trong một trạm làm việc duy nhất</h2>
          <p className="brand-sub" style={{ marginTop: "var(--space-2xs)" }}>
            Chọn từng phân hệ bên trái để xem cơ chế toán học và mở trực tiếp công cụ tương ứng
          </p>
        </div>

        <div className="workspace-grid" style={{ alignItems: "start" }}>
          {/* Left 5 Columns: Ruled List with Periwinkle Dot */}
          <div className="col-5">
            <ul className="ruled-list" role="tablist" aria-label="Danh sách 4 phân hệ lõi">
              {TOUR_ENGINES.map((item, idx) => {
                const isSelected = idx === activeTourIdx;
                return (
                  <li key={item.id} className="ruled-list-item">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-current={isSelected}
                      className="ruled-list-btn"
                      onClick={() => setActiveTourIdx(idx)}
                      style={{
                        flexDirection: "column",
                        alignItems: "stretch",
                        gap: "var(--space-xs)",
                        padding: "var(--space-md) var(--space-xs)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "var(--space-sm)",
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-xs)",
                          }}
                        >
                          <span
                            className={
                              isSelected
                                ? "signal-dot signal-dot--periwinkle"
                                : "signal-dot"
                            }
                          />
                          <span className="num brand-sub">{item.index}</span>
                          <strong style={{ fontSize: "var(--text-sm)", color: "var(--color-ink)" }}>
                            {item.title}
                          </strong>
                        </span>
                        <span className="tag tag--periwinkle num">{item.badge}</span>
                      </div>
                      {isSelected && (
                        <p
                          className="brand-sub"
                          style={{
                            margin: 0,
                            paddingLeft: "var(--space-md)",
                            lineHeight: 1.55,
                          }}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right 7 Columns: One Smoked Glass Pane that changes with the chosen item */}
          <div className="col-7">
            <div className="glass-pane" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "var(--space-sm)",
                }}
              >
                <div>
                  <h3>
                    {currentTour.index}. {currentTour.title}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn-pill"
                  onClick={() => safeNavigateTab(currentTour.id)}
                >
                  {currentTour.ctaLabel}
                </button>
              </div>

              <div className="inner-strip">
                <div className="field-label">Cơ chế vận hành và bảo chứng toán học</div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-2)", lineHeight: 1.6 }}>
                  {currentTour.formulaNote}
                </p>
              </div>

              <div className="ruled-tally">
                {currentTour.metrics.map((m) => (
                  <div key={m.label} className="tally-item">
                    <span className="tally-label">{m.label}</span>
                    <span
                      className="tally-figure"
                      style={{ fontSize: "var(--text-lg)" }}
                    >
                      {m.value}
                    </span>
                    <span className="tally-sub">{m.note}</span>
                  </div>
                ))}
              </div>

              <div className="inner-strip">
                <div className="field-label">Giá trị thực chiến cho đội ngũ nội dung</div>
                <ul
                  style={{
                    margin: "var(--space-xs) 0 0 var(--space-md)",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-xs)",
                    fontSize: "var(--text-sm)",
                    color: "var(--color-ink-2)",
                  }}
                >
                  {currentTour.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Dusk Signature "A hand-off in a Bone Well" */}
      <section
        className="bone-well landing-section"
        style={{ marginTop: "var(--space-2xl)" }}
        aria-label="Đối chứng chuẩn mực phân tích trên nền giấy sáng Bone Well"
      >
        <div className="workspace-grid">
          <div className="col-6">
            <div className="bone-sheet">
              <h2
                style={{
                  color: "var(--color-well-ink)",
                  marginBottom: "var(--space-xs)",
                }}
              >
                Vì sao CadenceLab loại bỏ hoàn toàn kiểu báo cáo đoán chữ cảm tính?
              </h2>
              <p
                className="bone-muted"
                style={{
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Các công cụ bọc prompt thông thường tự suy diễn nguyên nhân video ít lượt xem mà không có mốc chuẩn. CadenceLab tách biệt rõ phép đo thống kê và nhận định ngữ nghĩa có trích dẫn.
              </p>

              <div className="data-table-wrap">
                <table className="data-table bone-table">
                  <thead>
                    <tr>
                      <th>Tiêu chí kiểm định</th>
                      <th>Công cụ Prompt truyền thống</th>
                      <th>CadenceLab (v0.2.0)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Đánh giá video kém hiệu quả</td>
                      <td>LLM tự đoán do mở đầu yếu dù không xem video</td>
                      <td>
                        So sánh Leave-One-Out với tối thiểu 5 bài cùng định dạng và độ tuổi
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Phân tích nhịp dựng Reel</td>
                      <td>Chỉ đọc văn bản phụ đề rồi nhận xét chung chung</td>
                      <td>
                        Đo biến thiên hình ảnh, âm thanh và ngữ nghĩa từng 0.5 giây
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Trích dẫn bằng chứng</td>
                      <td>Không kiểm tra câu trích dẫn có tồn tại thật hay không</td>
                      <td>
                        Bắt buộc khớp nguyên văn quote (8 đến 400 ký tự) trong bài đăng gốc
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Xử lý chỉ số bị khuyết</td>
                      <td>Tự gán bằng 0 làm sai lệch tỷ lệ tương tác ER</td>
                      <td>
                        Giữ nguyên trạng thái khuyết và báo cáo số bài đủ dữ liệu
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-6">
            <div
              className="bone-sheet"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "var(--space-md)",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "var(--space-sm)",
                  }}
                >
                  <span className="tag tag--bone-apricot">
                    Mẫu phiếu bàn giao chiến lược (Bone Well Specimen)
                  </span>
                  <span className="num bone-muted" style={{ fontSize: "var(--text-xs)" }}>
                    schema_version: 1.0
                  </span>
                </div>

                <h3
                  style={{
                    color: "var(--color-well-ink)",
                    marginTop: "var(--space-sm)",
                  }}
                >
                  Học phần 07: Giải phẫu Cấu trúc Video và Lời thoại Có Trích dẫn
                </h3>
                <p
                  className="bone-muted"
                  style={{
                    fontSize: "var(--text-xs)",
                    marginTop: "var(--space-3xs)",
                  }}
                >
                  Mọi nhận định xuất ra từ pipeline đều đi kèm mã bài đăng và đoạn trích nguyên văn đã được kiểm tra tự động
                </p>

                <div
                  style={{
                    marginTop: "var(--space-md)",
                    padding: "var(--space-md)",
                    background: "var(--color-well)",
                    borderRadius: "var(--radius-inner)",
                    fontSize: "var(--text-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-xs)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    Nhận định: Mở đầu bằng thao tác kiểm định trực quan giúp giữ nhịp chú ý cao trong 3 giây đầu.
                  </div>
                  <div className="bone-muted" style={{ fontSize: "var(--text-xs)" }}>
                    Dẫn chứng nguyên văn từ <strong className="num">post_06</strong> (trường <strong className="num">transcript</strong>):
                  </div>
                  <blockquote
                    style={{
                      margin: 0,
                      paddingLeft: "var(--space-sm)",
                      borderLeft: "2px solid var(--color-well-ink)",
                      fontStyle: "italic",
                    }}
                  >
                    &ldquo;0s-3s: Kiểm tra độ thẩm thấu của tinh chất LumiDerm mẫu 6 trên giấy thử chuyên dụng.&rdquo;
                  </blockquote>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-sm)",
                  paddingTop: "var(--space-sm)",
                  borderTop: "var(--rule-hair) solid var(--color-well-rule)",
                }}
              >
                <span className="bone-muted" style={{ fontSize: "var(--text-xs)" }}>
                  Hỗ trợ xuất báo cáo Markdown (.md) hoặc lưu trữ trong SQLite Local
                </span>
                <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                  <button
                    type="button"
                    className="btn-bone"
                    onClick={() => safeNavigateTab("reports", "single")}
                  >
                    Xem mẫu 1 Video
                  </button>
                  <button
                    type="button"
                    className="btn-bone"
                    onClick={() => safeNavigateTab("reports", "competitor")}
                  >
                    Xem đối sánh 1-vs-1
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: 3-Step Workflow & Closing Command Bar */}
      <section
        className="landing-section"
        aria-label="Quy trình vận hành 3 bước trên CadenceLab"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--space-md)",
            marginBottom: "var(--space-lg)",
          }}
        >
          <div>
            <h2>Quy trình 3 bước từ dữ liệu thô đến kịch bản hành động</h2>
            <p className="brand-sub" style={{ marginTop: "var(--space-2xs)" }}>
              Chạy độc lập trên máy trạm với cơ sở dữ liệu SQLite WAL và FastAPI Engine v0.2.0
            </p>
          </div>
          <button
            type="button"
            className="btn-pill"
            onClick={() => safeNavigateTab("reports", "channel")}
          >
            Bắt đầu phân tích ngay
          </button>
        </div>

        <div className="workspace-grid">
          <div className="col-4 slate-pane">
            <h3>
              01. Nạp Snapshot CSV hoặc JSON chuẩn hóa
            </h3>
            <p
              className="brand-sub"
              style={{ marginTop: "var(--space-xs)", lineHeight: 1.6 }}
            >
              Hệ thống kiểm tra chặt chẽ lược đồ dữ liệu (Pydantic Strict Mode), khử trùng lặp ID bài đăng, kiểm tra múi giờ và lưu vết Idempotency-Key vào SQLite.
            </p>
          </div>

          <div className="col-4 slate-pane">
            <h3>
              02. Chạy Cohort Baseline và 3 Engine Định lượng
            </h3>
            <p
              className="brand-sub"
              style={{ marginTop: "var(--space-xs)", lineHeight: 1.6 }}
            >
              Tính toán tỷ lệ lượt xem tương đối so với trung vị nhóm đồng dạng (Leave-One-Out), kết hợp phân tích sóng CFI 0.5s, quỹ đạo SEIR-F và khoảng trống Cosine.
            </p>
          </div>

          <div className="col-4 slate-pane">
            <h3>
              03. Đối chứng Ngữ nghĩa 8 Học phần và Remix
            </h3>
            <p
              className="brand-sub"
              style={{ marginTop: "var(--space-xs)", lineHeight: 1.6 }}
            >
              Tổng hợp hồ sơ chiến lược 8 học phần có kiểm chứng trích dẫn nguyên văn, lập ma trận hành động và chuyển hóa thành kịch bản quay trong Remix Studio.
            </p>
          </div>
        </div>

        <footer className="landing-footer">
          <div>
            <strong>CadenceLab (v0.2.0)</strong>: Phòng thí nghiệm nhịp dựng và giải mã chiến lược nội dung chuẩn Hallmark Dusk.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => safeNavigateTab("reports", "channel")}
            >
              Hồ sơ 8 học phần
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => safeNavigateTab("cfi")}
            >
              Chẩn đoán CFI
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => safeNavigateTab("trend")}
            >
              Dự báo SEIR-F
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => safeNavigateTab("gaps")}
            >
              Khoảng trống nhu cầu
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
