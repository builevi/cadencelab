"use client";
import {useEffect,useRef,useState} from "react";
import type {DesktopBridge,DesktopProvider,DesktopSettings} from "../lib/desktop";

const NAMES:Record<DesktopProvider,string>={codex_local:"Codex local · tài khoản đã đăng nhập",openai:"OpenAI",gemini:"Google Gemini",deepseek:"DeepSeek",groq:"Groq",ollama:"Ollama · chạy trên máy"};
const DESTINATIONS:Record<DesktopProvider,string>={codex_local:"Dùng kết nối Codex đã đăng nhập trên máy. Codex cần Internet và hạn mức còn khả dụng.",
  openai:"Khóa và nội dung cần phân tích được gửi trực tiếp tới api.openai.com.",gemini:"Khóa và nội dung cần phân tích được gửi trực tiếp tới generativelanguage.googleapis.com.",
  deepseek:"Khóa và nội dung cần phân tích được gửi trực tiếp tới api.deepseek.com.",groq:"Khóa và nội dung cần phân tích được gửi trực tiếp tới api.groq.com.",
  ollama:"Chỉ gọi máy này. Cần cài Ollama và tải model trước khi dùng offline. Không cần API key."};
export function DesktopSettings(){
  const [updateNotice,setUpdateNotice]=useState("");
  const [canDownload,setCanDownload]=useState(false);
  const [updateBusy,setUpdateBusy]=useState(false);
  const [bridge,setBridge]=useState<DesktopBridge>();
  const [open,setOpen]=useState(false);
  const [provider,setProvider]=useState<DesktopProvider>("codex_local");
  const [model,setModel]=useState("");
  const [baseUrl,setBaseUrl]=useState("http://127.0.0.1:11434/v1");
  const [apiKey,setApiKey]=useState("");
  const [hasKey,setHasKey]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [failed,setFailed]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const generation=useRef(0);
  useEffect(()=>{if(window.cadenceDesktop)setBridge(window.cadenceDesktop);},[]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  function apply(value:DesktopSettings){setProvider(value.provider);setModel(value.model);setBaseUrl(value.baseUrl);setHasKey(value.hasKey);setApiKey("");}
  async function load(name?:DesktopProvider){
    if(!bridge)return;const version=++generation.current;
    setBusy(true);setNotice("");setApiKey("");if(name)setProvider(name);
    try{const result=await bridge.getSettings(name);if(version===generation.current)apply(result);}
    catch(e){if(version===generation.current){setFailed(true);setNotice(e instanceof Error?e.message:"Không đọc được cài đặt.");}}
    finally{if(version===generation.current)setBusy(false);}
  }
  async function act(kind:"save"|"test"){
    if(!bridge)return;setBusy(true);setNotice("");setFailed(false);
    try{
      const input={provider,model,baseUrl,apiKey};
      if(kind==="save"){apply(await bridge.saveSettings(input));setNotice("Đã lưu trên máy. Tác vụ tiếp theo sẽ dùng cấu hình này.");}
      else{const result=await bridge.testConnection(input);setNotice(result.message);setFailed(!result.ok);}
    }catch(e){setFailed(true);setNotice(e instanceof Error?e.message:"Không hoàn tất được yêu cầu.");}
    finally{setBusy(false);}
  }
  async function checkUpdate(){
    if(!bridge)return;setUpdateBusy(true);setCanDownload(false);
    try{const r=await bridge.checkUpdates();setUpdateNotice(r.available?`Có phiên bản ${r.latest}. Đang dùng ${r.current}. ${r.downloadUrl?'Tải bộ cài mới rồi đóng app để cài cập nhật.':'Chưa có bộ cài cho máy này; xem trang phát hành.'}`:`Đang dùng ${r.current}. ${r.notes==='Chưa có bản phát hành công khai.'?r.notes:'Đã là bản mới nhất.'}`);setCanDownload(r.available);}
    catch{setUpdateNotice('Không kiểm tra được phiên bản. Kiểm tra mạng rồi thử lại.');}finally{setUpdateBusy(false);}
  }
  if(!bridge)return null;
  const cloud=!["codex_local","ollama"].includes(provider);
  return <>
    <button className="btn-ghost" type="button" onClick={()=>{setOpen(true);load();}}>⚙ Cài đặt AI</button>
    <dialog ref={dialog} className="desktop-settings" aria-labelledby="settings-title" onCancel={()=>setOpen(false)}>
      <div className="settings-top"><div><h2 id="settings-title">Cài đặt AI trên máy</h2></div><button type="button" className="btn-ghost" aria-label="Đóng cài đặt" onClick={()=>setOpen(false)}>Đóng</button></div>
      <p className="cfi-help">Chọn nơi xử lý báo cáo và kiểm tra kết nối trước khi phân tích. Cấu hình này dùng cho cả báo cáo và phần nội dung lời nói trong video.</p>
      <form onSubmit={e=>{e.preventDefault();act("save");}} className="settings-form">
        <label className="field-label" htmlFor="settings-provider">Nhà cung cấp AI</label>
        <select id="settings-provider" className="field-select" value={provider} disabled={busy} onChange={e=>load(e.target.value as DesktopProvider)}>{Object.entries(NAMES).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>
        <p className="cfi-help settings-destination">{DESTINATIONS[provider]}</p>
        {provider!=="codex_local"&&<><label className="field-label" htmlFor="settings-model">Tên model</label><input id="settings-model" className="field-input" required value={model} disabled={busy} autoComplete="off" placeholder="Tên model hỗ trợ JSON trong tài khoản / Ollama" onChange={e=>setModel(e.target.value)}/><p className="cfi-help">Nhập tên chính xác từ nhà cung cấp. Quyền truy cập và hạn mức phụ thuộc tài khoản của anh.</p></>}
        {cloud&&<><label className="field-label" htmlFor="settings-key">API key {hasKey?"· đã lưu khóa":""}</label><input id="settings-key" type="password" className="field-input" value={apiKey} disabled={busy} autoComplete="off" spellCheck={false} placeholder={hasKey?"Để trống để giữ khóa đã lưu":"Nhập khóa của nhà cung cấp đã chọn"} onChange={e=>setApiKey(e.target.value)}/></>}
        {provider==="ollama"&&<><label className="field-label" htmlFor="settings-base">Địa chỉ Ollama local</label><input id="settings-base" className="field-input" required value={baseUrl} disabled={busy} onChange={e=>setBaseUrl(e.target.value)}/></>}
        <p className="cfi-help">API key được mã hóa bằng cơ chế bảo vệ của hệ điều hành, lưu trên máy này. Không lưu khóa trong trình duyệt hoặc bộ cài. Bấm kiểm tra sẽ gửi một yêu cầu ngắn tới nhà cung cấp đã chọn và có thể dùng hạn mức của anh.</p>
        <div className="settings-actions"><button type="button" className="btn-ghost" disabled={busy} onClick={()=>act("test")}>Kiểm tra kết nối</button><button className="btn-pill" type="submit" disabled={busy}>{busy?"Đang xử lý…":"Lưu cài đặt"}</button></div>
        {notice&&<p className={failed?"error-banner":"inner-strip"} role="status">{notice}</p>}
      </form>
      <section aria-label="Cập nhật phần mềm" style={{marginTop:24,borderTop:'1px solid var(--color-rule)',paddingTop:16}}>
        <h3>Cập nhật phần mềm</h3><p className="cfi-help">Kiểm tra bản mới từ GitHub Releases. Cài bản mới giữ cấu hình và báo cáo trong thư mục dữ liệu riêng. Sao lưu dữ liệu trước khi nâng cấp lớn.</p>
        <button type="button" className="btn-ghost" disabled={updateBusy} onClick={checkUpdate}>{updateBusy?'Đang kiểm tra…':'Kiểm tra cập nhật'}</button>
        {canDownload&&<button type="button" className="btn-pill" onClick={()=>bridge.openUpdate().catch(()=>setUpdateNotice('Không mở được trang tải. Thử lại sau.'))}>Tải bản cập nhật</button>}
        {updateNotice&&<p role="status" className="cfi-help">{updateNotice}</p>}
      </section>
    </dialog>
  </>;
}
