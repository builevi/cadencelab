"use client";
import React,{useEffect,useState} from "react";
const REPO="builevi/cadencelab";
type Asset={name:string;browser_download_url:string};
export function DownloadModal({isOpen,onClose,onOpenAuthModal}:{isOpen:boolean;onClose:()=>void;onOpenAuthModal:()=>void}){
 const [assets,setAssets]=useState<Asset[]>([]);const [status,setStatus]=useState("");
 useEffect(()=>{if(!isOpen)return;const controller=new AbortController();setAssets([]);setStatus("Đang tìm bộ cài…");
 fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{signal:controller.signal}).then(async r=>{if(r.status===404){setStatus("Chưa có bản phát hành công khai.");return;}if(!r.ok)throw Error();const d=await r.json();setAssets(Array.isArray(d.assets)?d.assets:[]);setStatus("");}).catch(()=>{if(!controller.signal.aborted)setStatus("Chưa lấy được danh sách bộ cài. Mở GitHub Releases bên dưới để tải.");});return()=>controller.abort();},[isOpen]);
 if(!isOpen)return null;
 function option(label:string,suffix:string){const asset=assets.find(a=>a.name.endsWith(suffix)&&a.browser_download_url.startsWith(`https://github.com/${REPO}/releases/`));return <div className="inner-strip" key={suffix} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><span>{label}</span>{asset?<a className="btn-pill" href={asset.browser_download_url} rel="noreferrer">Tải {suffix.endsWith('.dmg')?'.dmg':'.exe'}</a>:<span className="cfi-help">Chưa phát hành</span>}</div>;}
 return <div role="dialog" aria-modal="true" aria-labelledby="download-modal-title" style={{position:'fixed',inset:0,zIndex:100,background:'var(--color-shade)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
 <div className="glass-pane" style={{maxWidth:600,width:'100%',padding:28,background:'var(--color-paper)',borderRadius:24}}>
 <button type="button" className="btn-ghost" style={{float:'right'}} aria-label="Đóng cửa sổ tải về" onClick={onClose}>Đóng</button><h2 id="download-modal-title">Tải CadenceLab Desktop</h2>
 <p className="cfi-help">Chọn hệ điều hành của máy. Backend và nhận dạng lời nói chạy trên máy; AI cloud vẫn cần Internet và tài khoản riêng.</p>
 {status&&<p role="status">{status}</p>}
 {option('macOS · Apple Silicon (M1 trở lên)','-mac-arm64.dmg')}
 {option('Windows · 64-bit','-win-x64.exe')}
 <p className="cfi-help">Mac: mở DMG, kéo app vào Applications. Windows: mở EXE để cài. Bản thử nghiệm chưa có chứng thực phát hành nên hệ điều hành có thể cảnh báo.</p>
 <p><a href={`https://github.com/${REPO}/releases`} target="_blank" rel="noreferrer">Các phiên bản và ghi chú cập nhật</a> · <a href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer">Mã nguồn và hướng dẫn</a></p>
 <button className="btn-ghost" onClick={()=>{onClose();onOpenAuthModal();}}>Dùng bản Web</button>
 </div></div>;
}
