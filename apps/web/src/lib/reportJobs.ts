export type ReportJobState = "submitting" | "queued" | "running" | "completed" | "failed" | "cancelled" | "disconnected";
export interface ReportJob {
  id: string; state: ReportJobState; progress: number; created: number; updated: number;
  error: string | null; source_url?: string;
}
export function formatElapsed(milliseconds: number): string {
  const tenths = Math.floor(Math.max(0, milliseconds) / 100);
  const sec = Math.floor(tenths / 10) % 60;
  const min = Math.floor(tenths / 600) % 60;
  const hours = Math.floor(tenths / 36000);
  return `${hours ? `${String(hours).padStart(2,"0")}:` : ""}${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}.${tenths % 10}`;
}
export const REPORT_STEPS = ["Kiểm tra đường link", "Lấy bài đăng công khai", "Tổng hợp số liệu", "Phân tích nội dung", "Hoàn tất báo cáo"];
export function reportStep(progress: number, state: ReportJobState) {
  if (state === "completed") return 4;
  return progress >= 95 ? 4 : progress >= 30 ? 3 : progress >= 25 ? 2 : progress >= 10 ? 1 : 0;
}
export function normalizeSourceUrl(raw: string): string {
  const u=new URL(raw);
  if (u.hostname === "tiktok.com" || u.hostname === "www.tiktok.com") return `https://www.tiktok.com${u.pathname.replace(/\/$/,"")}`;
  if (u.hostname === "vm.tiktok.com" || u.hostname === "vt.tiktok.com") return `https://${u.hostname}${u.pathname.replace(/\/$/,"")}/`;
  if (["youtube.com","www.youtube.com","youtu.be"].includes(u.hostname)) {
    const id=u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") ? u.pathname.split("/").pop() : null);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
    return `https://www.youtube.com${u.pathname.replace(/\/$/,"").replace(/\/videos$/,"")}/videos`;
  }
  return u.href;
}
