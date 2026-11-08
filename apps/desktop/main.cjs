const {app,BrowserWindow,ipcMain,safeStorage,shell,dialog,Menu}=require('electron');
const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const readline=require('node:readline');
const {SettingsStore}=require('./settings-store.cjs');
const {checkUpdates}=require('./updates.cjs');
app.setName('CadenceLab');
let window,child,origin,store,quitting=false;
const token=crypto.randomBytes(32).toString('hex');
const instance=crypto.randomBytes(16).toString('hex');
if(process.env.CADENCELAB_USER_DATA)app.setPath('userData',path.resolve(process.env.CADENCELAB_USER_DATA));
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
function resource(name){return path.join(app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../build/desktop'),!app.isPackaged&&name==='backend'?'cadencelab-backend':name);}
async function callBackend(route,data,method='POST'){
  const response=await fetch(origin+route,{method,headers:{'X-CadenceLab-Token':token,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(200000)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.message||body.detail||'Backend chưa nhận được cấu hình.');
  return body;
}
function validateSender(event){
  if(!window || event.sender!==window.webContents || !event.senderFrame || new URL(event.senderFrame.url).origin!==origin)throw new Error('Không cho phép truy cập cài đặt.');
}
async function startBackend(){
  const backend=path.join(resource('backend'),process.platform==='win32'?'cadencelab-backend.exe':'cadencelab-backend');
  const data=path.join(app.getPath('userData'),'data');await fs.mkdir(data,{recursive:true});
  const env={...process.env,
    PATH:[path.join(os.homedir(),'.local/bin'),'/opt/homebrew/bin','/usr/local/bin',process.env.PATH||''].join(path.delimiter),
    CADENCELAB_DATA_DIR:data,CADENCELAB_FRONTEND:resource('frontend'),
    SOCIALLENS_MODELS_DIR:app.isPackaged?resource('models'):path.resolve(__dirname,'../../.sociallens/models'),
    SOCIALLENS_DESKTOP_TOKEN:token,CADENCELAB_INSTANCE:instance};
  // Never inherit a project API key into the distributed backend.
  for(const name of ['OPENAI_API_KEY','GITHUB_MODELS_TOKEN','GEMINI_API_KEY','DEEPSEEK_API_KEY','GROQ_API_KEY'])delete env[name];
  child=spawn(backend,[],{cwd:data,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  if(process.env.CADENCELAB_SMOKE)child.stderr.on('data',chunk=>fs.appendFile(path.join(app.getPath('userData'),'backend-smoke.log'),chunk).catch(()=>{}));
  const port=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Backend khởi động quá lâu.')),60000);
    child.once('error',()=>{clearTimeout(timer);reject(new Error('Không khởi động được backend đã đóng gói.'));});
    child.once('exit',()=>{clearTimeout(timer);reject(new Error('Backend đã dừng khi khởi động.'));});
    const rl=readline.createInterface({input:child.stdout});
    rl.on('line',line=>{try{const value=JSON.parse(line);if(value.event==='ready' && Number.isInteger(value.port)&&value.port>0){clearTimeout(timer);rl.close();resolve(value.port);}}catch{}});
  });
  child.stderr.on('data',()=>{});
  origin=`http://127.0.0.1:${port}`;
  for(let tries=0;tries<100;tries++){
    try{const value=await callBackend('/internal/health',undefined,'GET');if(value.instance===instance)return;}
    catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('Backend chưa sẵn sàng.');
}
async function smokeStage(stage){if(process.env.CADENCELAB_SMOKE)await fs.appendFile(path.join(app.getPath('userData'),'desktop-smoke.log'),stage+'\n');}
async function boot(){
  await smokeStage('starting backend');
  await startBackend();
  await smokeStage('backend ready');
  store=new SettingsStore(app.getPath('userData'),safeStorage);
  await callBackend('/internal/provider',await store.current(),'PUT');
  ipcMain.handle('settings:get',async(event,provider)=>{validateSender(event);return store.metadata(provider);});
  ipcMain.handle('settings:save',async(event,input)=>{
    validateSender(event);const config=await store.candidate(input);
    // Validate with backend before committing; never reflect the secret to the renderer.
    await callBackend('/internal/provider',config,'PUT');
    try{return await store.save(config);}catch(e){await callBackend('/internal/provider',await store.current(),'PUT');throw e;}
  });
  ipcMain.handle('settings:test',async(event,input)=>{validateSender(event);return callBackend('/internal/provider/test',await store.candidate(input));});
  ipcMain.handle('updates:check',event=>{validateSender(event);return checkUpdates(app.getVersion(),process.platform,process.arch);});
  ipcMain.handle('updates:open',async(event)=>{validateSender(event);const result=await checkUpdates(app.getVersion(),process.platform,process.arch);await shell.openExternal(result.downloadUrl||result.releaseUrl);});
  ipcMain.handle('app:info',event=>{validateSender(event);return {version:app.getVersion(),platform:process.platform,arch:process.arch,packaged:app.isPackaged};});
  window=new BrowserWindow({width:1440,height:980,minWidth:880,minHeight:640,title:'CadenceLab',backgroundColor:'#111319',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.session.webRequest.onBeforeSendHeaders({urls:[origin+'/*']},(details,callback)=>callback({requestHeaders:{...details.requestHeaders,'X-CadenceLab-Token':token}}));
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  function external(url){try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password)shell.openExternal(u.href);}catch{}}
  window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();external(url);}});
  child.on('exit',()=>{if(!quitting){dialog.showErrorBox('CadenceLab','Backend đã dừng. Đóng và mở lại app để tiếp tục; dữ liệu báo cáo đã lưu được giữ trên máy.');app.quit();}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{label:'CadenceLab',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]}]:[]),
    {label:'Chỉnh sửa',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'Hiển thị',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
  ]));
  await smokeStage('loading window');
  await window.loadURL(origin);
  await smokeStage('window loaded');
  if(process.env.CADENCELAB_SMOKE){
    const result={packaged:app.isPackaged,version:app.getVersion(),backendReady:true,uiTitle:await window.webContents.getTitle(),
      settings:(await store.metadata()).provider};
    await fs.writeFile(path.join(app.getPath('userData'),'smoke-result.json'),JSON.stringify(result));
    app.quit();
  }
}
app.whenReady().then(boot).catch(async error=>{
  if(process.env.CADENCELAB_SMOKE){
    await fs.writeFile(path.join(app.getPath('userData'),'smoke-error.json'),JSON.stringify({error:error.message}));
    if(child&&!child.killed)child.kill();app.exit(1);return;
  }
  dialog.showErrorBox('CadenceLab chưa mở được',error.message||'Lỗi khởi động.');app.quit();
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{quitting=true;if(child&&!child.killed)child.kill();});
