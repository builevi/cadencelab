"use client";
import { useEffect, useState } from "react";
import { formatElapsed, reportStep, REPORT_STEPS, ReportJobState } from "../lib/reportJobs";

export function ReportProgress({ state, progress, startedAt, finishedAt }: {
  state: ReportJobState; progress: number; startedAt: number; finishedAt?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const active = ["submitting","queued","running"].includes(state);
  useEffect(() => {
    const base = Math.max(0, (finishedAt ?? Date.now()) - startedAt);
    const anchor = performance.now();
    setElapsed(base);
    if (!active) return;
    const clock = window.setInterval(() => setElapsed(base + performance.now() - anchor), 100);
    return () => window.clearInterval(clock);
  }, [active, startedAt, finishedAt]);
  const step = reportStep(progress, state);
  const title = state === "completed" ? "Báo cáo đã sẵn sàng" : state === "failed" ? "Chưa tạo được báo cáo" :
    state === "cancelled" ? "Đã hủy tác vụ" : state === "disconnected" ? "Đang mất kết nối tới tác vụ" :
    state === "queued" ? "Đang chờ đến lượt" : state === "submitting" ? "Đang gửi yêu cầu" : REPORT_STEPS[step];
  return <section className="report-progress slate-pane" data-running={active} aria-label="Tiến độ tạo báo cáo">
    <div className="report-progress-heading"><div><span className="report-eyebrow"><span className="report-live-dot"/> {active ? "Đang xử lý link của anh" : "Trạng thái tác vụ"}</span><h2 aria-live="polite">{title}</h2></div>
      <div className="report-clock"><span className="report-eyebrow">{active ? "Thời gian đã chạy" : "Thời gian ghi nhận"}</span>
        <div role="timer" aria-live="off" aria-label="Thời gian tạo báo cáo" className="report-clock-value">{formatElapsed(elapsed)}</div></div></div>
    <ol className="report-stages">{REPORT_STEPS.map((label, index) => <li key={label} data-state={state === "completed" || index < step ? "done" : index === step ? "current" : "waiting"} aria-current={active && index === step ? "step" : undefined}>
      <span className="report-stage-number">{state === "completed" || index < step ? "✓" : String(index + 1).padStart(2,"0")}</span><span>{label}</span></li>)}</ol>
    <p className="brand-sub">{state === "completed" ? "Kết quả bên dưới chỉ lấy từ nguồn được ghi trong báo cáo." : "Thời gian được đo thực tế. Các bước chỉ cập nhật khi backend xử lý, không phải ước lượng thời gian còn lại."}</p>
  </section>;
}
