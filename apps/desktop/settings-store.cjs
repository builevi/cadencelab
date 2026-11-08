const fs = require('node:fs/promises');
const path = require('node:path');
const PROVIDERS = new Set(['codex_local','openai','gemini','deepseek','groq','ollama']);
function validate(input) {
  if (!input || !PROVIDERS.has(input.provider)) throw new Error('Nhà cung cấp không hợp lệ.');
  const model=typeof input.model==='string' ? input.model.trim() : '';
  const apiKey=typeof input.apiKey==='string' ? input.apiKey.trim() : '';
  const baseUrl=typeof input.baseUrl==='string' ? input.baseUrl.trim() : 'http://127.0.0.1:11434/v1';
  if (model.length>200 || apiKey.length>4096 || baseUrl.length>500) throw new Error('Cấu hình quá dài.');
  if (input.provider!=='codex_local' && !model) throw new Error('Nhập tên model muốn dùng.');
  if (input.provider==='ollama') {
    let u;try{u=new URL(baseUrl);}catch{throw new Error('Địa chỉ Ollama không hợp lệ.');}
    if(u.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(u.hostname) || !u.port || u.username || u.password || u.search || u.hash || u.pathname.replace(/\/$/,'')!=='/v1')throw new Error('Ollama chỉ được kết nối tới máy này, cổng rõ ràng và đường dẫn /v1.');
  }
  return {provider:input.provider,model:input.provider==='codex_local' ? '' : model,baseUrl,apiKey,removeKey:input.removeKey===true};
}
class SettingsStore {
  constructor(directory,cipher){this.directory=directory;this.cipher=cipher;this.file=path.join(directory,'ai-settings.json');this.document=null;}
  async load(){
    if(this.document)return this.document;
    let stored;try{stored=JSON.parse(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('Không đọc được cài đặt đã lưu; dữ liệu cũ vẫn được giữ.');}
    if(!stored)return this.document={selected:'codex_local',profiles:{}};
    try{
      if(stored.encrypted){
        if(!await this.cipher.isAsyncEncryptionAvailable())throw Error();
        const decoded=await this.cipher.decryptStringAsync(Buffer.from(stored.payload,'base64'));
        this.document=JSON.parse(decoded.result);
      }else{
        // Unencrypted config may contain local provider preferences only, never API keys.
        const doc=stored.payload;
        if(Object.values(doc.profiles||{}).some(p=>p.apiKey))throw Error();
        this.document=doc;
      }
      if(!PROVIDERS.has(this.document.selected))throw Error();
      return this.document;
    }catch{throw new Error('Không mở được cài đặt mã hóa. Hãy kiểm tra quyền Keychain của CadenceLab.');}
  }
  async metadata(provider){
    const doc=await this.load();const name=provider||doc.selected;
    if(!PROVIDERS.has(name))throw new Error('Nhà cung cấp không hợp lệ.');
    const profile=doc.profiles[name]||{};
    return {provider:name,selectedProvider:doc.selected,model:profile.model||'',baseUrl:profile.baseUrl||'http://127.0.0.1:11434/v1',hasKey:!!profile.apiKey};
  }
  async candidate(input){
    const clean=validate(input);const doc=await this.load();const previous=doc.profiles[clean.provider]||{};
    const apiKey=clean.removeKey ? '' : clean.apiKey || previous.apiKey || '';
    if(!['codex_local','ollama'].includes(clean.provider)&&!apiKey)throw new Error('Nhập API key của nhà cung cấp đã chọn.');
    return {provider:clean.provider,model:clean.model,baseUrl:clean.baseUrl,apiKey};
  }
  async current(){const doc=await this.load();return {provider:doc.selected,model:'',baseUrl:'http://127.0.0.1:11434/v1',apiKey:'',...(doc.profiles[doc.selected]||{})};}
  async save(config){
    const prior=await this.load();const next=structuredClone(prior);
    next.selected=config.provider;next.profiles[config.provider]=config;
    let envelope;
    if(Object.values(next.profiles).some(p=>p.apiKey)){
      if(!await this.cipher.isAsyncEncryptionAvailable())throw new Error('Keychain chưa sẵn sàng. Không lưu API key dạng chữ thường.');
      envelope={version:1,encrypted:true,payload:(await this.cipher.encryptStringAsync(JSON.stringify(next))).toString('base64')};
    }else envelope={version:1,encrypted:false,payload:next};
    await fs.mkdir(this.directory,{recursive:true});
    const temp=this.file+'.tmp';await fs.writeFile(temp,JSON.stringify(envelope),{mode:0o600});await fs.rename(temp,this.file);
    this.document=next;return this.metadata();
  }
}
module.exports={SettingsStore,validate,PROVIDERS};
