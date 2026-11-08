"use client";

import React, { useEffect, useState } from "react";
import {
  DEFAULT_TREND_PRESETS,
  TrendForecastResponse,
} from "../lib/contracts";

export function TrendWorkspace() {
  const [selectedPreset, setSelectedPreset] = useState<string>("surging_format");
  const [keyword, setKeyword] = useState<string>(
    DEFAULT_TREND_PRESETS.surging_format.keyword
  );
  const [spreadersInput, setSpreadersInput] = useState<string>(
    DEFAULT_TREND_PRESETS.surging_format.daily_active_spreaders.join(", ")
  );
  const [daysInput, setDaysInput] = useState<string>("10");
  const [populationInput, setPopulationInput] = useState<string>("1000000");

  const [status, setStatus] = useState<"loading" | "empty" | "error" | "full">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [data, setData] = useState<TrendForecastResponse | null>(null);

  useEffect(() => {
    applyPreset("surging_format");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runForecast(
    kw: string,
    obs: number[],
    days: number,
    pop: number
  ) {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/v1/trend/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trend_keyword: kw,
          daily_active_spreaders: obs,
          days,
          population_size: pop,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }
      const json: TrendForecastResponse = await res.json();
      setData(json);
      setStatus("full");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Không thể khớp tham số SEIR-F."
      );
    }
  }

  async function runSimulate(days: number) {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/v1/trend/simulate?days=${days}`, {
        method: "POST",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `HTTP ${res.status}`);
      }
      const json: TrendForecastResponse = await res.json();
      setData(json);
      setStatus("full");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Lỗi gọi mô phỏng SEIR-F."
      );
    }
  }

  function applyPreset(key: string) {
    const p = DEFAULT_TREND_PRESETS[key];
    if (!p) return;
    setSelectedPreset(key);
    setKeyword(p.keyword);
    setSpreadersInput(p.daily_active_spreaders.join(", "));
    setDaysInput(String(p.days));
    setPopulationInput(String(p.population_size));
    runForecast(p.keyword, p.daily_active_spreaders, p.days, p.population_size);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const obs = spreadersInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => Number(n));
    if (obs.length === 0) {
      setData(null);
      setStatus("empty");
      return;
    }
    runForecast(
      keyword,
      obs,
      Math.round(Number(daysInput)),
      Number(populationInput)
    );
  }

  const trajectory = data?.trajectory ?? [];
  const maxSpreaders = Math.max(
    ...trajectory.map((t) => t.active_spreaders),
    1
  );
  const maxFatigue = Math.max(...trajectory.map((t) => t.audience_fatigue), 1e-6);

  return (
    <div className="workspace-grid">
      {/* Left Column (4 cols): Presets & Observation Input */}
      <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <section className="slate-pane" aria-label="Danh sách chuỗi quan sát SEIR-F">
          <h2>Chuỗi Quan sát Lan truyền</h2>
          <p className="brand-sub" style={{ marginTop: "var(--space-2xs)", marginBottom: "var(--space-md)" }}>
            Khớp tốc độ lây truyền (beta) và phơi nhiễm ban đầu từ chuỗi 7 đến 365 ngày quan sát
          </p>

          <ul className="ruled-list">
            {Object.entries(DEFAULT_TREND_PRESETS).map(([key, preset]) => {
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
                        {preset.keyword}
                      </span>
                    </span>
                    <span className="num brand-sub">
                      {preset.daily_active_spreaders.length} ngày
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", marginTop: "var(--space-md)" }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSelectedPreset("sim_21");
                runSimulate(21);
              }}
            >
              Mô phỏng 21 ngày
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSpreadersInput("");
                setData(null);
                setStatus("empty");
              }}
            >
              Xóa chuỗi
            </button>
          </div>
        </section>

        <section className="slate-pane" aria-label="Bộ nhập dữ liệu quan sát SEIR-F">
          <h3>Tham số Đầu vào (/trend/forecast)</h3>
          <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-md)" }}>
            Nhập số lượng tài khoản đang tích cực lan truyền theo ngày (không nhập tổng lượt xem cộng dồn)
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <div>
              <label className="field-label" htmlFor="trend-kw">
                Nhãn xu hướng hoặc định dạng (trend_keyword)
              </label>
              <input
                id="trend-kw"
                type="text"
                className="field-input"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="trend-obs">
                Chuỗi quan sát theo ngày (daily_active_spreaders, tối thiểu 7 ngày)
              </label>
              <textarea
                id="trend-obs"
                className="field-textarea"
                value={spreadersInput}
                onChange={(e) => setSpreadersInput(e.target.value)}
              />
            </div>

            <div className="workspace-grid">
              <div className="col-6">
                <label className="field-label" htmlFor="trend-days">
                  Số ngày dự báo (1 - 90)
                </label>
                <input
                  id="trend-days"
                  type="number"
                  className="field-input num"
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                />
              </div>
              <div className="col-6">
                <label className="field-label" htmlFor="trend-pop">
                  Quy mô dân số (N)
                </label>
                <input
                  id="trend-pop"
                  type="number"
                  className="field-input num"
                  value={populationInput}
                  onChange={(e) => setPopulationInput(e.target.value)}
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
              {status === "loading"
                ? "Đang giải hệ phương trình vi phân SEIR-F..."
                : "Khớp tham số và dự báo (/trend/forecast)"}
            </button>
          </form>
        </section>
      </div>

      {/* Right Column (8 cols): Smoked Glass Trajectory & Fit Diagnostics */}
      <div className="col-8" style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <section className="glass-pane" aria-label="Kết quả khớp mô hình dịch tễ học SEIR-F">
          {status === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              <div className="skeleton-line" style={{ width: "50%" }} />
              <div className="skeleton-line" style={{ width: "100%", height: "160px" }} />
              <div className="skeleton-line" style={{ width: "80%" }} />
            </div>
          )}

          {status === "empty" && (
            <div className="inner-strip" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
              <h3>Chưa có chuỗi quan sát theo ngày</h3>
              <p className="brand-sub" style={{ marginTop: "var(--space-xs)", marginBottom: "var(--space-md)" }}>
                Cung cấp tối thiểu 7 ngày quan sát liên tiếp số lượng tài khoản lan truyền để khớp mô hình SEIR-F.
              </p>
              <button
                type="button"
                className="btn-pill"
                onClick={() => applyPreset("surging_format")}
              >
                Nạp chuỗi mẫu
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="error-banner" role="alert">
              <strong>Lỗi kiểm tra dữ liệu SEIR-F (HTTP 422 / Solver): </strong>
              <span>{errorMessage}</span>
              <div style={{ marginTop: "var(--space-sm)" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => applyPreset("surging_format")}
                >
                  Khôi phục chuỗi
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
                  <h2>
                    {data.trend_keyword || "Kịch bản mô phỏng SEIR-F chuẩn hóa"}
                  </h2>
                  <p className="brand-sub" style={{ marginTop: "var(--space-3xs)" }}>
                    Chế độ: {data.mode}, bất định dự báo: {data.uncertainty_status}
                  </p>
                </div>

                {trajectory[0] && (
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <span
                      className={
                        trajectory[0].trend_phase === "SURGING"
                          ? "tag tag--periwinkle"
                          : "tag tag--apricot"
                      }
                    >
                      Pha ngày +1: {trajectory[0].trend_phase}
                    </span>
                  </div>
                )}
              </div>

              {/* Fit Diagnostics Tally if available */}
              {data.fit && (
                <div className="ruled-tally">
                  <div className="tally-item">
                    <span className="tally-label">Hệ số lây truyền khớp (beta)</span>
                    <span className="tally-figure">
                      {data.fit.transmission_rate.toFixed(4)}
                    </span>
                    <span className="tally-sub">
                      Trên {data.fit.observations} ngày quan sát
                    </span>
                  </div>
                  <div className="tally-item">
                    <span className="tally-label">Phơi nhiễm ban đầu ước lượng (E0)</span>
                    <span className="tally-figure">
                      {Math.round(data.fit.initial_exposed).toLocaleString("en-US")}
                    </span>
                    <span className="tally-sub">
                      Dân số cố định N = {data.fit.fixed_priors.population.toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="tally-item">
                    <span className="tally-label">Sai số tuyệt đối trong mẫu (MAE)</span>
                    <span className="tally-figure">
                      {data.fit.training_mae.toFixed(2)}
                    </span>
                    <span className="tally-sub">
                      Log RMSE: {data.fit.training_log_rmse.toFixed(4)}
                    </span>
                  </div>
                  <div className="tally-item">
                    <span className="tally-label">Kiểm tra biên tham số</span>
                    <span className="tally-figure">
                      {data.fit.at_parameter_boundary ? "Chạm biên" : "Nội miền"}
                    </span>
                    <span className="tally-sub">
                      sigma={data.fit.fixed_priors.exposure_rate}, gamma={data.fit.fixed_priors.recovery_rate}
                    </span>
                  </div>
                </div>
              )}

              {data.fit?.at_parameter_boundary && (
                <div className="apricot-strip" style={{ marginTop: "var(--space-md)" }}>
                  <strong>Cảnh báo chạm biên tham số:</strong>
                  <span>
                    Nghiệm tối ưu chạm biên ràng buộc; cần kiểm tra lại quy mô dân số N hoặc giả định trạng thái ban đầu.
                  </span>
                </div>
              )}

              {/* Two Small-Multiple Charts (Single Y-Axis each per Hallmark data-viz.md) */}
              <div className="workspace-grid" style={{ marginTop: "var(--space-lg)" }}>
                <div className="col-6 inner-strip">
                  <h3>Số lượng người lan truyền tích cực (active_spreaders)</h3>
                  <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-sm)" }}>
                    Đơn vị: số tài khoản đang hoạt động tại các ngày tương lai 1..{trajectory.length}
                  </p>
                  <svg viewBox="0 0 320 130" className="chart-svg" role="img" aria-label="Đồ thị active spreaders">
                    <line x1="0" y1="20" x2="320" y2="20" className="chart-gridline" />
                    <line x1="0" y1="65" x2="320" y2="65" className="chart-gridline" />
                    <line x1="0" y1="110" x2="320" y2="110" className="chart-gridline" />
                    {trajectory.length > 1 && (
                      <polyline
                        className="chart-series-accent"
                        points={trajectory
                          .map((pt, idx) => {
                            const x = 12 + (idx / (trajectory.length - 1)) * 296;
                            const y = 110 - (pt.active_spreaders / maxSpreaders) * 85;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(" ")}
                      />
                    )}
                    {trajectory.map((pt, idx) => {
                      const x =
                        trajectory.length === 1
                          ? 160
                          : 12 + (idx / (trajectory.length - 1)) * 296;
                      const y = 110 - (pt.active_spreaders / maxSpreaders) * 85;
                      return (
                        <circle
                          key={pt.day}
                          cx={x}
                          cy={y}
                          r="3"
                          className="chart-marker-accent"
                        />
                      );
                    })}
                    <text x="4" y="16" className="chart-label">
                      Đỉnh cửa sổ: {Math.round(maxSpreaders).toLocaleString("en-US")}
                    </text>
                  </svg>
                </div>

                <div className="col-6 inner-strip">
                  <h3>Tích lũy hoạt động chuẩn hóa (audience_fatigue = F/N)</h3>
                  <p className="brand-sub" style={{ marginTop: "var(--space-3xs)", marginBottom: "var(--space-sm)" }}>
                    Đơn vị: active-spreader-days chia cho quy mô dân số N (không phải xác suất)
                  </p>
                  <svg viewBox="0 0 320 130" className="chart-svg" role="img" aria-label="Đồ thị audience fatigue">
                    <line x1="0" y1="20" x2="320" y2="20" className="chart-gridline" />
                    <line x1="0" y1="65" x2="320" y2="65" className="chart-gridline" />
                    <line x1="0" y1="110" x2="320" y2="110" className="chart-gridline" />
                    {trajectory.length > 1 && (
                      <polyline
                        className="chart-series-apricot"
                        points={trajectory
                          .map((pt, idx) => {
                            const x = 12 + (idx / (trajectory.length - 1)) * 296;
                            const y = 110 - (pt.audience_fatigue / maxFatigue) * 85;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(" ")}
                      />
                    )}
                    {trajectory.map((pt, idx) => {
                      const x =
                        trajectory.length === 1
                          ? 160
                          : 12 + (idx / (trajectory.length - 1)) * 296;
                      const y = 110 - (pt.audience_fatigue / maxFatigue) * 85;
                      return (
                        <circle
                          key={pt.day}
                          cx={x}
                          cy={y}
                          r="3"
                          className="chart-marker-apricot"
                        />
                      );
                    })}
                    <text x="4" y="16" className="chart-label">
                      Mức tối đa: {maxFatigue.toFixed(5)}
                    </text>
                  </svg>
                </div>
              </div>

              {/* Trajectory Table */}
              <div className="data-table-wrap" style={{ marginTop: "var(--space-lg)" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="num">Ngày tương lai</th>
                      <th>Pha xu hướng</th>
                      <th className="num">Số người lan truyền (I)</th>
                      <th className="num">Tốc độ tăng trưởng</th>
                      <th className="num">Tỷ lệ I / N</th>
                      <th className="num">Tích lũy F / N</th>
                      <th>Khuyến nghị điều kiện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trajectory.map((pt) => (
                      <tr key={pt.day}>
                        <td className="num">Ngày +{pt.day}</td>
                        <td>
                          <span
                            className={
                              pt.trend_phase === "SURGING"
                                ? "tag tag--periwinkle"
                                : "tag tag--apricot"
                            }
                          >
                            {pt.trend_phase}
                          </span>
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {pt.active_spreaders.toFixed(1)}
                        </td>
                        <td className="num">
                          {(pt.growth_rate * 100).toFixed(2)}%/ngày
                        </td>
                        <td className="num">{pt.active_virality.toFixed(6)}</td>
                        <td className="num">{pt.audience_fatigue.toFixed(6)}</td>
                        <td style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
                          {pt.actionable_advice}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.limitations && (
                <p className="brand-sub" style={{ marginTop: "var(--space-md)" }}>
                  Giới hạn kỹ thuật: {data.limitations}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
