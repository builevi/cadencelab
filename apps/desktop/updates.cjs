const REPO='builevi/cadencelab';
function newer(next,current){
 const parse=v=>/^v?(\d+)\.(\d+)\.(\d+)$/.exec(v)?.slice(1).map(Number);
 const a=parse(next),b=parse(current);if(!a||!b)return false;
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;
}
function releaseInfo(release,current,platform,arch){
 const suffix=platform==='darwin'?`mac-${arch}.dmg`:platform==='win32'?`win-${arch}.exe`:null;
 const asset=suffix&&(release.assets||[]).find(a=>a.name.endsWith('-'+suffix));
 const allowed=url=>typeof url==='string'&&url.startsWith(`https://github.com/${REPO}/releases/`);
 return {current,latest:release.tag_name||'',available:!release.draft&&!release.prerelease&&newer(release.tag_name,current),downloadUrl:asset&&allowed(asset.browser_download_url)?asset.browser_download_url:null,releaseUrl:`https://github.com/${REPO}/releases/latest`,notes:(release.body||'').slice(0,12000)};
}
async function checkUpdates(current,platform,arch){
 const response=await fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 if(response.status===404)return {current,latest:current,available:false,downloadUrl:null,releaseUrl:`https://github.com/${REPO}/releases`,notes:'Chưa có bản phát hành công khai.'};
 if(!response.ok)throw new Error('Chưa kiểm tra được GitHub Releases. Thử lại sau.');
 return releaseInfo(await response.json(),current,platform,arch);
}
module.exports={checkUpdates,releaseInfo,newer};
