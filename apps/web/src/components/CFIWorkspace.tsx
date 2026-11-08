"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CFIResponse,
  DEFAULT_CFI_PRESETS,
} from "../lib/contracts";

const PRESET_NAMES: Record<string, string> = {
  paced_reel: "Video có đoạn chùng ở giữa",
  talking_head: "Chuyên gia nói chuyện, máy quay tĩnh",
  sensory_overload: "Video nhiều hiệu ứng và âm thanh",
};
const ZONE_NAMES = { FLOW: "Nhịp ổn định", BOREDOM_VALLEY: "Ít biến đổi, nên xem lại", OVERLOAD: "Nhiều tín hiệu cùng lúc" };
const score = (value: number) => Math.round(value * 100);
const seconds = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

interface VideoResult {
  processing_status: "completed" | "partial";
  duration_seconds: number;
  audio_present: boolean;
  transcript: { status: string; words: { text: string }[] };
  semantic_analysis: { status: string };
  cfi: CFIResponse | null;
}

interface CFIWorkspaceProps {
  initialPresetKey: string;
}

export function CFIWorkspace({ initialPresetKey }: CFIWorkspaceProps) {
  const requestVersion = useRef(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [videoProgress, setVideoProgress] = useState<string>("");
  const [videoLanguage, setVideoLanguage] = useState("auto");
  const [selectedPreset, setSelectedPreset] = useState<string>(
    initialPresetKey in DEFAULT_CFI_PRESETS ? initialPresetKey : "paced_reel"
  );
  const [timeStep, setTimeStep] = useState<string>("0.5");
  const [visualInput, setVisualInput] = useState<string>(
    DEFAULT_CFI_PRESETS.paced_reel.visual_motion.join(", ")
  );
  const [acousticInput, setAcousticInput] = useState<string>(
    DEFAULT_CFI_PRESETS.paced_reel.acoustic_flux.join(", ")
  );
  const [semanticInput, setSemanticInput] = useState<string>(
    DEFAULT_CFI_PRESETS.paced_reel.semantic_density.join(", ")
  );

  const [status, setStatus] = useState<"loading" | "empty" | "error" | "full">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [data, setData] = useState<CFIResponse | null>(null);
  const [activeSliceIdx, setActiveSliceIdx] = useState<number>(0);

  useEffect(() => {
    if (initialPresetKey in DEFAULT_CFI_PRESETS) {
      applyPreset(initialPresetKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPresetKey]);

  async function runAnalyze(
    vArr: number[],
    aArr: number[],
    sArr: number[],
    stepVal: number
  ) {
    const version = ++requestVersion.current;
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/v1/cfi/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visual_motion: vArr,
          acoustic_flux: aArr,
          semantic_density: sArr,
          time_step: stepVal,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(typeof errBody.detail === "string" ? "Dữ liệu chưa hợp lệ. Kiểm tra ba dãy số trong phần nâng cao." : "Chưa phân tích được. Anh thử lại sau nhé.");
      }
      const json: CFIResponse = await res.json();
      if (version !== requestVersion.current) return;
      setData(json);
      setActiveSliceIdx(0);
      setStatus("full");
    } catch (err) {
      if (version !== requestVersion.current) return;
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Chưa kết nối được dịch vụ phân tích. Hãy thử lại sau."
      );
    }
  }

  async function runSimulate(seconds: number) {
    const version = ++requestVersion.current;
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/v1/cfi/simulate?video_seconds=${seconds}`, {
        method: "POST",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(typeof errBody.detail === "string" ? "Dữ liệu chưa hợp lệ. Kiểm tra ba dãy số trong phần nâng cao." : "Chưa phân tích được. Anh thử lại sau nhé.");
      }
      const json: CFIResponse = await res.json();
      if (version !== requestVersion.current) return;
      setData(json);
      setActiveSliceIdx(0);
      setStatus("full");
    } catch (err) {
      if (version !== requestVersion.current) return;
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Chưa tạo được ví dụ. Hãy thử lại sau."
      );
    }
  }

  function applyPreset(key: string) {
    const preset = DEFAULT_CFI_PRESETS[key];
    if (!preset) return;
    setVideoResult(null);
    setVideoProgress("");
    setSelectedPreset(key);
    setTimeStep(String(preset.time_step));
    setVisualInput(preset.visual_motion.join(", "));
    setAcousticInput(preset.acoustic_flux.join(", "));
    setSemanticInput(preset.semantic_density.join(", "));
    runAnalyze(
      preset.visual_motion,
      preset.acoustic_flux,
      preset.semantic_density,
      preset.time_step
    );
  }

  async function analyzeVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile) return;
    if (videoFile.size > 25 * 1024 * 1024) {
      setVideoProgress("File lớn quá 25 MB. Hãy xuất bản ngắn hoặc giảm dung lượng.");
      return;
    }
    const version = ++requestVersion.current;
    setSelectedPreset("uploaded");
    setVideoResult(null);
    setData(null);
    setStatus("loading");
    setErrorMessage("");
    setVideoProgress("Đang tải video lên để xử lý…");
    try {
      const form = new FormData();
      form.append("file", videoFile);
      form.append("language", videoLanguage);
      const response = await fetch("/api/v1/videos/jobs", { method: "POST", body: form });
      const created = await response.json();
      if (!response.ok) throw new Error(typeof created.detail === "string" ? created.detail : "Chưa tải được video. Hãy thử lại.");
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        if (version !== requestVersion.current) return;
        const poll = await fetch(created.status_url);
        if (!poll.ok) throw new Error("Mất kết nối tới tiến độ video. Hãy thử lại.");
        const job = await poll.json();
        if (version !== requestVersion.current) return;
        setVideoProgress(job.state === "queued" ? "Video đang chờ đến lượt xử lý…" :
          job.progress < 35 ? "Đang đọc hình ảnh và âm thanh…" :
          job.progress < 65 ? "Đang nhận dạng lời nói trên máy…" : "Đang phân tích nội dung lời nói…");
        if (job.state === "failed") throw new Error(job.error === "video_processing_failed" ? "Chưa xử lý được video. Hãy thử file MP4, MOV hoặc WebM dưới 60 giây." : job.error);
        if (job.state === "cancelled") throw new Error("Tác vụ video đã được hủy.");
        if (job.state === "completed") {
          const resultResponse = await fetch(created.result_url);
          if (!resultResponse.ok) throw new Error("Chưa lấy được kết quả video.");
          const result: VideoResult = await resultResponse.json();
          if (version !== requestVersion.current) return;
          setVideoResult(result);
          setData(result.cfi);
          setActiveSliceIdx(0);
          setStatus(result.cfi ? "full" : "empty");
          setVideoProgress("Đã đọc xong video.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw new Error("Video vẫn đang xử lý lâu hơn dự kiến. Kết quả được lưu ở máy chủ; anh có thể kiểm tra lại sau.");
    } catch (error) {
      if (version !== requestVersion.current) return;
      setStatus("error");
      setVideoProgress("");
      setErrorMessage(error instanceof Error ? error.message : "Chưa xử lý được video.");
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parseSeries = (raw: string) =>
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((n) => Number(n));

    const vArr = parseSeries(visualInput);
    const aArr = parseSeries(acousticInput);
    const sArr = parseSeries(semanticInput);
    const stepVal = Number(timeStep);

    if (vArr.length === 0 && aArr.length === 0 && sArr.length === 0) {
      setData(null);
      setStatus("empty");
      return;
    }

    const arrays = [vArr, aArr, sArr];
    if (!Number.isFinite(stepVal) || stepVal <= 0 || stepVal > 60 ||
        arrays.some((a) => a.length === 0 || a.length > 7200 || a.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) ||
        new Set(arrays.map((a) => a.length)).size !== 1) {
      ++requestVersion.current;
      setStatus("error");
      setErrorMessage("Ba dãy phải có cùng số phần tử, mỗi số từ 0 đến 1. Dùng dấu chấm cho số thập phân, dấu phẩy để ngăn cách. Khoảng đo phải lớn hơn 0 và không quá 60 giây.");
      return;
    }
    setSelectedPreset("custom");
    runAnalyze(vArr, aArr, sArr, stepVal);
  }

  const slices = data?.timeline_slices ?? [];
  const activeSlice = slices[activeSliceIdx] ?? slices[0] ?? null;
  const interval = slices.length > 1 ? slices[1].timestamp_sec - slices[0].timestamp_sec : Number(timeStep);
  const isSample = selectedPreset !== "custom" && selectedPreset !== "uploaded";
  const lowPoints = data?.summary.review_points ?? [];

  return (
    <div className="workspace-grid">
      {/* Left Column (4 cols): Dusk Ruled Tour List + Feature Input Controls */}
      <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <section className="slate-pane" aria-label="Phân tích file video">
          <h2>Đọc video của anh</h2>
          <p className="cfi-help">Tải video lên để tự đọc hình ảnh, âm thanh và lời nói. Anh không cần nhập dãy số.</p>
          <form onSubmit={analyzeVideo} style={{ display: "grid", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
            <label className="field-label" htmlFor="video-upload">Chọn video MP4, MOV hoặc WebM</label>
            <input id="video-upload" type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              className="field-input" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
            <label className="field-label" htmlFor="video-language">Ngôn ngữ lời nói</label>
            <select id="video-language" className="field-select" value={videoLanguage} onChange={(e) => setVideoLanguage(e.target.value)}>
              <option value="auto">Tự nhận diện</option><option value="vi">Tiếng Việt</option><option value="en">Tiếng Anh</option>
            </select>
            <button className="btn-pill" type="submit" disabled={!videoFile || status === "loading"}>
              {selectedPreset === "uploaded" && status === "loading" ? "Đang đọc video…" : "Phân tích video"}
            </button>
          </form>
          <p className="cfi-help">Bản thử nghiệm: tối đa 60 giây, 25 MB. File gốc được xóa sau khi xử lý. Điểm nội dung dựa trên lời nói, chưa đọc chữ hoặc ý nghĩa trong hình ảnh.</p>
          {videoProgress && <p className="cfi-help" role="status">{videoProgress}</p>}
        </section>
        <section className="slate-pane" aria-label="Chọn ví dụ để xem cách phân tích">
          <h2>Thử với một video mẫu</h2>
          <p className="brand-sub" style={{ marginTop: "var(--space-2xs)", marginBottom: "var(--space-md)" }}>
            Chọn tình huống giống video anh muốn hiểu. Kết quả sẽ hiện ngay, không cần nhập dãy số.
          </p>

          <ul className="ruled-list">
            {Object.entries(DEFAULT_CFI_PRESETS).map(([key, preset]) => {
              const isCurrent = selectedPreset === key;
              return (
                <li key={key} className="ruled-list-item">
                  <button
                    type="button"
                    className="ruled-list-btn"
                    aria-current={isCurrent}
                    onClick={() => applyPreset(key)}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                      <span
                        className={
                          isCurrent
                            ? "signal-dot signal-dot--periwinkle"
                            : "signal-dot"
                        }
                      />
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                        {PRESET_NAMES[key] ?? preset.label}
                      </span>
                    </span>
                    <span className="num brand-sub">
                      {preset.visual_motion.length * preset.time_step} giây
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="cfi-help" style={{ marginTop: "var(--space-md)" }}>
            Các mẫu dưới đây dùng dữ liệu minh họa. Để phân tích file của anh, dùng ô tải video ở trên.
          </p>
        </section>

        <section className="slate-pane" aria-label="Cách đọc chỉ số nhịp dựng">
          <h3>Các chỉ số nói lên điều gì?</h3>
          <dl className="cfi-explanations">
            <div><dt>Hình ảnh thay đổi</dt><dd>Mức chuyển động và thay đổi trong hình ảnh. Máy quay tĩnh vẫn có thể truyền tải nội dung tốt.</dd></div>
            <div><dt>Âm thanh thay đổi</dt><dd>Mức thay đổi của âm thanh theo thời gian. Đây không phải điểm chất lượng giọng nói.</dd></div>
            <div><dt>Lượng thông tin</dt><dd>Tín hiệu thể hiện mức độ thông tin ở từng đoạn, cần được đo riêng từ nội dung.</dd></div>
          </dl>
          <p className="cfi-help">Điểm giúp tìm đoạn nên xem lại khi biên tập. Điểm cao không tự động có nghĩa là video hay hoặc sẽ nhiều lượt xem.</p>
        </section>

        <section className="slate-pane" aria-label="Tùy chỉnh nâng cao">
          <details className="cfi-details">
            <summary>Tùy chỉnh nâng cao</summary>
            <p className="cfi-help">Chỉ dùng khi anh đã có dữ liệu tín hiệu. Để xem thử, chỉ cần chọn một mẫu ở trên.</p>
          <h4>Dữ liệu tín hiệu theo thời gian</h4>
          <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-md)" }}>
            Mỗi số mô tả một đoạn: 0 là thấp, 1 là cao. Ví dụ 0.78 là mức tín hiệu tương đối, không phải 78% người xem. Ba dãy cần có cùng số phần tử.
          </p>

          <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <div>
              <label className="field-label" htmlFor="cfi-timestep">
                Khoảng cách giữa hai lần đo (giây)
              </label>
              <input
                id="cfi-timestep"
                type="number"
                step="0.05"
                min="0.05"
                max="60"
                className="field-input num"
                value={timeStep}
                onChange={(e) => setTimeStep(e.target.value)}
              />
            </div>

            <p className="cfi-help">0.5 nghĩa là đo mỗi nửa giây: số đầu ở giây 0, số tiếp theo ở giây 0.5, rồi giây 1…</p>
            <div>
              <label className="field-label" htmlFor="cfi-visual">
                Mức thay đổi hình ảnh (0–1)
              </label>
              <textarea
                id="cfi-visual"
                className="field-textarea"
                value={visualInput}
                onChange={(e) => setVisualInput(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="cfi-acoustic">
                Mức thay đổi âm thanh (0–1)
              </label>
              <textarea
                id="cfi-acoustic"
                className="field-textarea"
                value={acousticInput}
                onChange={(e) => setAcousticInput(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="cfi-semantic">
                Mức thông tin (0–1)
              </label>
              <textarea
                id="cfi-semantic"
                className="field-textarea"
                value={semanticInput}
                onChange={(e) => setSemanticInput(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className={
                status === "loading" ? "btn-pill is-loading" : "btn-pill"
              }
              disabled={status === "loading"}
            >
              {status === "loading"
                ? "Đang phân tích…"
                : "Phân tích dữ liệu đã nhập"}
            </button>
          </form>
          <button type="button" className="btn-ghost" style={{ marginTop: "var(--space-sm)" }} onClick={() => {
            setSelectedPreset("sim_15s"); runSimulate(15);
          }}>Ví dụ ngẫu nhiên 15s</button>
          </details>
        </section>
      </div>

      {/* Right Column (8 cols): Smoked Glass CFI Timeline & Slice Inspector */}
      <div className="col-8" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <section className="glass-pane" aria-label="Biểu đồ chẩn đoán nhịp dựng CFI theo từng 0.5 giây">
          {videoResult && (
            <div className="inner-strip" style={{ marginBottom: "var(--space-md)" }}>
              <strong>Đã đọc video dài {seconds(videoResult.duration_seconds)} giây</strong>
              <p className="cfi-help">{videoResult.cfi ? "Đã trích hình ảnh, âm thanh và ước lượng nội dung lời nói. Các mốc lời nói có thể sai; hãy đối chiếu video trước khi chỉnh sửa." :
                videoResult.transcript.status === "asr_model_not_installed" ? "Đã đọc hình ảnh và âm thanh. Máy chủ chưa cài model nhận dạng lời nói nên chưa thể tính đủ điểm nhịp." :
                "Đã đọc hình ảnh và âm thanh nhưng chưa đủ bằng chứng lời nói hoặc AI chưa hoàn thành. Điểm tổng hợp được để trống."}</p>
              {videoResult.transcript.words.length > 0 && <details className="cfi-details"><summary>Xem lời nói đã nhận dạng</summary><p className="cfi-help">{videoResult.transcript.words.map((w) => w.text).join("")}</p></details>}
            </div>
          )}
          {status === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div className="skeleton-line" style={{ width: "45%" }} />
              <div className="skeleton-line" style={{ width: "100%", height: "160px" }} />
              <div className="skeleton-line" style={{ width: "70%" }} />
            </div>
          )}

          {status === "empty" && (
            <div className="inner-strip" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
              <h3>{videoResult ? "Chưa đủ dữ liệu để chấm nhịp tổng hợp" : "Chọn một mẫu để bắt đầu"}</h3>
              <p className="brand-sub" style={{ marginTop: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
                {videoResult ? "Video không có lời nói rõ vẫn có thể có nội dung thị giác tốt. Hệ thống cần thêm bước đọc hình ảnh trước khi đánh giá loại video này." : "Tải file video hoặc chọn một tình huống mẫu ở bên trái để bắt đầu."}
              </p>
              <button
                type="button"
                className="btn-pill"
                onClick={() => applyPreset("paced_reel")}
              >
                Xem ví dụ đầu tiên
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="error-banner" role="alert">
              <strong>Chưa phân tích được: </strong>
              <span>{errorMessage}</span>
              <div style={{ marginTop: "var(--space-sm)" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => applyPreset("paced_reel")}
                >
                  Thử lại với dữ liệu mẫu
                </button>
              </div>
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
                  <h2>Nhịp video theo thời gian</h2>
                  <p className="brand-sub" style={{ marginTop: "var(--space-3xs)" }}>
                    {isSample ? "Kết quả từ dữ liệu mẫu" : selectedPreset === "uploaded" ? "Kết quả từ video đã tải lên, phần nội dung dựa trên lời nói" : "Kết quả từ tín hiệu anh cung cấp"}, {slices.length} lần đo, cách nhau {seconds(interval)} giây
                  </p>
                </div>

                <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
                  <span className="tag tag--periwinkle">
                    Điểm nhịp: {score(data.summary.pacing_score)}/100
                  </span>
                  <span className="tag tag--apricot">
                    Đoạn cần xem lại: {data.summary.boredom_valleys_count}
                  </span>
                </div>
              </div>

              <div className="inner-strip" style={{ marginBottom: "var(--space-md)" }}>
                <strong>{lowPoints.length ? `Nên xem lại từ giây ${lowPoints.map(seconds).join("; ")}` : "Chưa thấy đoạn ít biến đổi kéo dài trong tín hiệu này"}</strong>
                <p className="cfi-help">{lowPoints.length ? "Đối chiếu những mốc này với video để xem có cần đổi cảnh, rút gọn lời hoặc thêm minh họa. Đây chưa phải bằng chứng người xem đã bỏ đi." : "Xem thêm các chấm cam nếu có để kiểm tra đoạn nhiều tín hiệu cùng lúc."}</p>
              </div>
              {/* Ruled Tally of CFI Summary */}
              <div className="ruled-tally">
                <div className="tally-item">
                  <span className="tally-label">Điểm nhịp trung bình</span>
                  <span className="tally-figure">{score(data.summary.pacing_score)}<small>/100</small></span>
                  <span className="tally-sub">Điểm tham khảo từ tín hiệu, không phải điểm chất lượng video</span>
                </div>
                <div className="tally-item">
                  <span className="tally-label">Nhịp mở đầu (3 giây đầu)</span>
                  <span className="tally-figure">
                    {data.summary.hook_strength_3s == null ? "Chưa có" : `${score(data.summary.hook_strength_3s)}/100`}
                  </span>
                  <span className="tally-sub">Mức tín hiệu ở đoạn mở đầu, chưa đo khả năng giữ người xem</span>
                </div>
                <div className="tally-item">
                  <span className="tally-label">Thời lượng ít biến đổi</span>
                  <span className="tally-figure">
                    {(data.summary.low_stimulus_fraction * 100).toFixed(1)}%
                  </span>
                  <span className="tally-sub">
                    Mốc xem lại:{" "}
                    {data.summary.review_points.length > 0
                      ? data.summary.review_points.map((t) => `${seconds(t)} giây`).join(", ")
                      : "Không có"}
                  </span>
                </div>
                <div className="tally-item">
                  <span className="tally-label">Người xem có xem hết không?</span>
                  <span className="tally-figure">Chưa xác định</span>
                  <span className="tally-sub">
                    Cần số liệu thời gian xem thực tế từ nền tảng
                  </span>
                </div>
              </div>

              {/* Interactive SVG Timeline */}
              <div className="inner-strip" style={{ marginTop: "var(--space-lg)" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: "var(--space-sm)",
                    marginBottom: "var(--space-sm)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span>
                    Chọn một điểm để xem nhịp tại thời điểm đó
                  </span>
                  <span className="num" style={{ color: "var(--color-muted)" }}>
                    Đường sáng: điểm nhịp, Đường mờ: mức tín hiệu, Chấm cam: đoạn nên xem lại
                  </span>
                </div>

                <svg
                  viewBox="0 0 680 180"
                  className="chart-svg"
                  role="img"
                  aria-label="Đồ thị CFI Score và Stimulus Load theo thời gian"
                >
                  {/* 4 Horizontal Hairlines (1.0, 0.85 overload, 0.5, 0.20 boredom, 0.0) */}
                  <line x1="36" y1="20" x2="660" y2="20" className="chart-gridline" />
                  <line x1="36" y1="39" x2="660" y2="39" className="chart-gridline" />
                  <line x1="36" y1="85" x2="660" y2="85" className="chart-gridline" />
                  <line x1="36" y1="124" x2="660" y2="124" className="chart-gridline" />
                  <line x1="36" y1="150" x2="660" y2="150" className="chart-gridline" />

                  <text x="4" y="24" className="chart-label">100</text>
                  <text x="4" y="43" className="chart-label">85</text>
                  <text x="4" y="128" className="chart-label">20</text>
                  <text x="4" y="154" className="chart-label">0</text>

                  {/* Hook Stage Shading */}
                  {slices.length > 1 && (() => {
                    const hookCount = slices.filter((s) => s.stage === "HOOK").length;
                    if (hookCount <= 0) return null;
                    const w = ((hookCount - 1) / Math.max(slices.length - 1, 1)) * 624;
                    return (
                      <g>
                        <rect
                          x="36"
                          y="20"
                          width={Math.max(w, 24)}
                          height="130"
                          className="chart-zone-hook"
                        />
                        <text x="42" y="33" className="chart-label">
                          MỞ ĐẦU
                        </text>
                      </g>
                    );
                  })()}

                  {/* Stimulus Load Polyline (Context Series) */}
                  {slices.length > 1 && (
                    <polyline
                      className="chart-series-muted"
                      points={slices
                        .map((s, idx) => {
                          const x = 36 + (idx / (slices.length - 1)) * 624;
                          const y = 150 - s.stimulus_load * 130;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(" ")}
                    />
                  )}

                  {/* CFI Score Polyline (Accent Series) */}
                  {slices.length > 1 && (
                    <polyline
                      className="chart-series-accent"
                      points={slices
                        .map((s, idx) => {
                          const x = 36 + (idx / (slices.length - 1)) * 624;
                          const y = 150 - s.cfi_score * 130;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(" ")}
                    />
                  )}

                  {/* Interactive Points */}
                  {slices.map((s, idx) => {
                    const x =
                      slices.length === 1
                        ? 348
                        : 36 + (idx / (slices.length - 1)) * 624;
                    const y = 150 - s.cfi_score * 130;
                    const isFlagged = s.zone !== "FLOW";
                    const isSelected = idx === activeSliceIdx;
                    return (
                      <g
                        key={s.timestamp_sec}
                        style={{ cursor: "pointer" }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Giây ${s.timestamp_sec}: ${ZONE_NAMES[s.zone]}, điểm nhịp ${score(s.cfi_score)}/100`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveSliceIdx(idx); }
                        }}
                        onClick={() => setActiveSliceIdx(idx)}
                      >
                        {(isFlagged || isSelected) && (
                          <circle
                            cx={x}
                            cy={y}
                            r={isSelected ? 6 : 4}
                            className={
                              isFlagged
                                ? "chart-marker-apricot"
                                : "chart-marker-accent"
                            }
                          />
                        )}
                        <circle cx={x} cy={y} r="10" fill="transparent" />
                      </g>
                    );
                  })}
                  {slices.length > 0 && [0, Math.floor((slices.length - 1) / 2), slices.length - 1]
                    .filter((idx, pos, all) => all.indexOf(idx) === pos)
                    .map((idx) => (
                      <text key={`time-${idx}`} x={slices.length === 1 ? 348 : 36 + idx / (slices.length - 1) * 624}
                        y="173" textAnchor={idx === 0 ? "start" : idx === slices.length - 1 ? "end" : "middle"} className="chart-label">
                        {seconds(slices[idx].timestamp_sec)} giây
                      </text>
                    ))}
                </svg>

                {/* Active Slice Detail Bar */}
                {activeSlice && (
                  <div
                    className={
                      activeSlice.zone === "FLOW"
                        ? "inner-strip"
                        : "apricot-strip"
                    }
                    style={{ marginTop: "var(--space-sm)" }}
                  >
                    <div className="num">
                      <strong>Tại giây {seconds(activeSlice.timestamp_sec)}</strong>{" "}
                      <span>
                        · {activeSlice.stage === "HOOK" ? "Mở đầu" : "Phần sau mở đầu"} · {ZONE_NAMES[activeSlice.zone]}
                      </span>
                    </div>
                    <div className="num" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-md)", fontSize: "var(--text-xs)" }}>
                      <span>Điểm nhịp: <strong>{score(activeSlice.cfi_score)}/100</strong></span>
                      <span>Mức tín hiệu: <strong>{score(activeSlice.stimulus_load)}/100</strong></span>
                      <span>Hình ảnh: <strong>{score(activeSlice.visual_motion)}/100</strong></span>
                      <span>Âm thanh: <strong>{score(activeSlice.acoustic_flux)}/100</strong></span>
                      <span>Thông tin: <strong>{score(activeSlice.semantic_density)}/100</strong></span>

                    </div>
                    {activeSlice.recommendation && (
                      <div style={{ width: "100%", fontSize: "var(--text-xs)" }}>
                        Khuyến nghị biên tập: {activeSlice.recommendation}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p className="cfi-help" style={{ marginTop: "var(--space-md)" }}>Thang điểm 0 đến 100 là cách hiển thị tín hiệu cho dễ đọc, không phải phần trăm người xem. Hãy kiểm tra cả nội dung trước khi quyết định chỉnh sửa.</p>
              <details className="cfi-details" style={{ marginTop: "var(--space-lg)" }}>
                <summary>Xem bảng số liệu chi tiết</summary>
              {/* Full Slice Table */}
              <div className="data-table-wrap" style={{ marginTop: "var(--space-lg)" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="num">Mốc giây</th>
                      <th>Phần video</th>
                      <th>Trạng thái</th>
                      <th className="num">Điểm nhịp /100</th>
                      <th className="num">Tín hiệu /100</th>
                      <th className="num">Hình ảnh /100</th>
                      <th className="num">Âm thanh /100</th>
                      <th className="num">Thông tin /100</th>
                      <th>Ghi chú biên tập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slices.map((s, idx) => (
                      <tr
                        key={s.timestamp_sec}
                        onClick={() => setActiveSliceIdx(idx)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="num">{s.timestamp_sec.toFixed(2)}s</td>
                        <td>
                          <span className="tag tag--neutral">{s.stage === "HOOK" ? "Mở đầu" : "Phần sau"}</span>
                        </td>
                        <td>
                          <span
                            className={
                              s.zone === "FLOW"
                                ? "tag tag--periwinkle"
                                : "tag tag--apricot"
                            }
                          >
                            {ZONE_NAMES[s.zone]}
                          </span>
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {score(s.cfi_score)}
                        </td>
                        <td className="num">{score(s.stimulus_load)}</td>
                        <td className="num">{score(s.visual_motion)}</td>
                        <td className="num">{score(s.acoustic_flux)}</td>
                        <td className="num">{score(s.semantic_density)}</td>
                        <td style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                          {s.recommendation || "Nhịp dựng ổn định"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              </details>
              <p className="brand-sub" style={{ marginTop: "var(--space-md)" }}>
                Lưu ý: {data.summary.limitations}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
