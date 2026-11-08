"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeSourceUrl, ReportJob, ReportJobState } from "../lib/reportJobs";
import { ReportProgress } from "./ReportProgress";

type Metric = { known_total: number | null; observed_posts: number; missing_posts: number };
type Finding = { text: string; evidence: { post_id: string; field: string; quote: string }[] };
type Module = { id: string; status: string; summary?: string; findings: Finding[] | object; missing: string[]; error?: string };
type Channel = { channel_id: string; platform: string; name: string; corpus_size: number;
  totals: Record<string, Metric>; source_urls: string[]; snapshot_range: { from: string; to: string };
  performance: { post_id: string; url: string; views: number | null; relative_views: number | null; status: string }[];
  qualitative_modules: Module[]; semantic_analysis?: { modules: Module[] } };
interface SourceReport { data_source: string; source: { requested_url: string; resolved_url: string; collected_posts: number; skipped_posts: number };
  channels: Channel[]; semantic_status: string; limitations: string[] }
const MODULE_NAMES: Record<string,string> = { brand_positioning:"Định vị thương hiệu",tone_of_voice:"Giọng nói nội dung",target_audience_clues:"Dấu hiệu về khán giả",posting_and_trends:"Hoạt động đăng bài",content_pillars:"Tuyến nội dung",content_structure_analysis:"Cách triển khai nội dung",transcript_analysis:"Lời thoại video",ad_strategy:"Hoạt động quảng cáo" };
const fmt=(n:number|null|undefined) => n == null ? "Chưa có dữ liệu" : n.toLocaleString("vi-VN");

export function SourceReportWorkspace({ sourceUrl, requestKey, initialJobId, onJobCreated, onResubmit, onViewDemo }: {
  sourceUrl: string; requestKey: string; initialJobId?: string;
  onJobCreated: (id:string)=>void; onResubmit: (url:string)=>void; onViewDemo: ()=>void;
}) {
  const [input,setInput]=useState(sourceUrl);
  const [job,setJob]=useState<ReportJob|null>(null);
  const [state,setState]=useState<ReportJobState>("submitting");
  const [report,setReport]=useState<SourceReport|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const [startedAt,setStartedAt]=useState(Date.now());
  const [finishedAt,setFinishedAt]=useState<number|undefined>();
  const jobId=useRef(initialJobId);
  const notify=useRef(onJobCreated); notify.current=onJobCreated;
  useEffect(() => {
    const controller=new AbortController();
    let abandoned=false;
    const headers={"Content-Type":"application/json","Idempotency-Key":requestKey};
    const read = async (url:string, init?:RequestInit) => {
      const response=await fetch(url,{...init,signal:controller.signal});
      const body=await response.json().catch(()=>null);
      if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : response.status === 422 ? "Link chưa hợp lệ hoặc chưa được hỗ trợ. Hãy dùng link TikTok/YouTube công khai." : "Chưa kết nối được dịch vụ báo cáo. Hãy thử lại.");
      return body;
    };
    async function run() {
      setReport(null);setError("");setFinishedAt(undefined);setState(jobId.current ? "running" : "submitting");
      try {
        if (!jobId.current) {
          const created=await read("/api/v1/reports/from-url",{method:"POST",headers,body:JSON.stringify({source_url:sourceUrl,analysis_mode:"semantic",language:"vi",post_limit:12})});
          if (abandoned) return;
          jobId.current=created.id;
          notify.current(created.id);
        }
        const id=jobId.current!;
        const deadline=Date.now()+10*60*1000;
        while(!abandoned && Date.now()<deadline) {
          const current:ReportJob=await read(`/api/v1/reports/jobs/${encodeURIComponent(id)}`);
          if (abandoned) return;
          if (!current.source_url || normalizeSourceUrl(current.source_url)!==normalizeSourceUrl(sourceUrl)) throw new Error("Tác vụ này không thuộc link anh đã gửi. Kết quả được giữ trống để tránh nhầm báo cáo.");
          setJob(current);setStartedAt(current.created*1000);setState(current.state);
          if (["failed","cancelled"].includes(current.state)) {
            setFinishedAt(current.updated*1000);
            setError(current.state === "cancelled" ? "Tác vụ đã được hủy." : current.error === "report_computation_failed" ? "Chưa tạo được báo cáo từ nguồn này. Hãy thử lại hoặc nhập dữ liệu CSV." : current.error || "Không lấy được dữ liệu nguồn.");
            return;
          }
          if (current.state === "completed") {
            const result:SourceReport=await read(`/api/v1/reports/jobs/${encodeURIComponent(id)}/result`);
            if (abandoned) return;
            if (result.data_source!=="collected_public_snapshot" || result.source?.requested_url!==current.source_url || !result.channels?.length) throw new Error("Báo cáo trả về không khớp nguồn đã yêu cầu. Hệ thống không hiển thị dữ liệu mẫu thay thế.");
            setReport(result);setFinishedAt(current.updated*1000);return;
          }
          await new Promise(resolve=>setTimeout(resolve,1000));
        }
        if (!abandoned) throw new Error("Tác vụ mất nhiều thời gian hơn dự kiến. Anh có thể kết nối lại để kiểm tra, không cần gửi yêu cầu mới.");
      } catch(e) {
        if (abandoned || controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Chưa tạo được báo cáo.");
        setState(jobId.current ? "disconnected" : "failed");setFinishedAt(Date.now());
      }
    }
    run();
    return()=>{abandoned=true;controller.abort();};
  },[sourceUrl,requestKey,retry]);
  const active=["submitting","queued","running"].includes(state);
  async function cancel() {
    if(!jobId.current)return;
    try { const response=await fetch(`/api/v1/reports/jobs/${jobId.current}/cancel`,{method:"POST"});if(!response.ok)throw Error(); }
    catch {setError("Chưa gửi được yêu cầu hủy. Tác vụ có thể vẫn đang chạy.");}
  }
  return <div className="source-workspace">
    <section className="glass-pane" aria-label="Nguồn báo cáo đang phân tích">
      <div className="report-source-heading"><div><h2>Báo cáo từ đường link: Nguồn yêu cầu</h2></div><span className="tag tag--periwinkle">Dữ liệu công khai, không dùng mẫu thay thế</span></div>
      <p className="report-source-url">{sourceUrl}</p>
      <form className="source-report-form" onSubmit={e=>{e.preventDefault();onResubmit(input.trim());}}><label className="field-label" htmlFor="report-source-url">Đổi link phân tích</label>
        <div><input id="report-source-url" type="url" required value={input} onChange={e=>setInput(e.target.value)} className="field-input"/><button className="btn-pill" disabled={active} type="submit">Phân tích link</button></div></form>
    </section>
    <ReportProgress state={state} progress={job?.progress??0} startedAt={startedAt} finishedAt={finishedAt}/>
    {error && <section className="error-banner" role="alert"><strong>{state === "failed" ? "Chưa có báo cáo cho link này" : "Thông báo tác vụ"}</strong><p>{error}</p>
      {state === "disconnected" && <button type="button" className="btn-ghost" onClick={()=>setRetry(v=>v+1)}>Kết nối lại tác vụ</button>}
      {!active && state !== "disconnected" && <button type="button" className="btn-ghost" onClick={()=>onResubmit(sourceUrl)}>Thử lại với link này</button>}
      <p className="brand-sub">Anh có thể dùng dữ liệu CSV hoặc tải file ở mục Chẩn đoán CFI nếu nền tảng không cho đọc link.</p></section>}
    {active && jobId.current && <button type="button" className="btn-ghost report-cancel" onClick={cancel}>Hủy tác vụ</button>}
    {report?.channels.map(channel=><section className="slate-pane" aria-label="Kết quả từ nguồn đã thu thập" key={channel.channel_id}>
      <h2>{channel.name} ({channel.platform}, {fmt(channel.corpus_size)} bài)</h2>
      <p className="brand-sub">Chụp số liệu lúc {new Date(channel.snapshot_range.to).toLocaleString("vi-VN")}. Đây là mẫu bài thu thập được, không phải toàn bộ lịch sử kênh.</p>
      <div className="ruled-tally" style={{marginTop:"var(--space-lg)"}}>{[["views","Lượt xem ghi nhận"],["likes","Lượt thích ghi nhận"],["comments","Bình luận ghi nhận"],["shares","Lượt chia sẻ ghi nhận"]].map(([key,label])=><div className="tally-item" key={key}><span className="tally-label">{label}</span><span className="tally-figure">{fmt(channel.totals[key]?.known_total)}</span><span className="tally-sub">{fmt(channel.totals[key]?.observed_posts)} bài có số liệu · {fmt(channel.totals[key]?.missing_posts)} bài chưa có</span></div>)}</div>
      <h3 style={{marginTop:"var(--space-lg)"}}>Hiệu suất các bài đã đọc</h3><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Bài đăng gốc</th><th>Lượt xem</th><th>So với bài tương đồng</th></tr></thead><tbody>{channel.performance.map(post=><tr key={post.post_id}><td><a href={post.url} target="_blank" rel="noreferrer">{post.post_id}</a></td><td>{fmt(post.views)}</td><td>{post.relative_views == null ? "Chưa đủ bài để so sánh" : `${post.relative_views.toFixed(2)} lần trung vị`}</td></tr>)}</tbody></table></div>
      <h3 style={{marginTop:"var(--space-lg)"}}>Phân tích nội dung từ nguồn</h3><p className="brand-sub">Nhận xét AI là diễn giải, cần đối chiếu dẫn chứng. Không có dữ liệu quảng cáo hoặc lời thoại thì các mục đó được để thiếu.</p>
      <div className="source-modules">{(channel.semantic_analysis?.modules??channel.qualitative_modules).map(module=><details key={module.id} className="source-module"><summary><span>{MODULE_NAMES[module.id]??module.id}</span><span className="tag tag--neutral">{module.status === "analyzed" ? "Có dẫn chứng" : module.status === "descriptive_only" ? "Thống kê" : "Chưa đủ dữ liệu"}</span></summary>
        {module.summary&&<p>{module.summary}</p>}{Array.isArray(module.findings)&&module.findings.map((finding:Finding,index:number)=><div key={index}><p>{finding.text}</p>{finding.evidence?.map((e,i)=><blockquote key={i}><p>“{e.quote}”</p><cite>Bài {e.post_id}</cite></blockquote>)}</div>)}{module.missing?.length>0&&<p className="brand-sub">Cần thêm: {module.missing.join(" · ")}</p>}{module.status === "unavailable"&&<p className="brand-sub">AI chưa trả được kết quả hợp lệ cho mục này. Số liệu thu thập được vẫn được giữ.</p>}</details>)}</div>
    </section>)}
    {report&&<details className="slate-pane cfi-details"><summary>Nguồn và giới hạn báo cáo</summary><p className="report-source-url">{report.source.resolved_url}</p><ul>{report.limitations.map((text,index)=><li key={index}>{text}</li>)}</ul></details>}
    <button type="button" className="btn-ghost report-cancel" onClick={onViewDemo}>Xem riêng báo cáo mẫu</button>
  </div>;
}
