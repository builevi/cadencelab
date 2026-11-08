const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {SettingsStore,validate}=require('../settings-store.cjs');
const cipher={isAsyncEncryptionAvailable:async()=>true,
  encryptStringAsync:async text=>Buffer.from(text.split('').reverse().join('')),
  decryptStringAsync:async bytes=>({result:bytes.toString().split('').reverse().join(''),shouldReEncrypt:false})};
async function temp(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cadencelab-settings-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('local default does not need or persist a secret',()=>temp(async dir=>{
  const store=new SettingsStore(dir,cipher);assert.equal((await store.metadata()).provider,'codex_local');
  const config=await store.candidate({provider:'ollama',model:'fixture-model',baseUrl:'http://127.0.0.1:11434/v1'});
  await store.save(config);assert.equal((await new SettingsStore(dir,cipher).metadata()).provider,'ollama');
}));
test('secrets encrypted at rest, never returned in metadata, profile keys preserved',()=>temp(async dir=>{
  const store=new SettingsStore(dir,cipher);
  await store.save(await store.candidate({provider:'gemini',model:'fixture',apiKey:'fake-private-test-key'}));
  assert.equal((await store.metadata()).hasKey,true);
  assert.ok(!JSON.stringify(await store.metadata()).includes('fake-private-test-key'));
  assert.ok(!(await fs.readFile(store.file,'utf8')).includes('fake-private-test-key'));
  assert.equal((await store.candidate({provider:'gemini',model:'fixture-new'})).apiKey,'fake-private-test-key');
  const reload=new SettingsStore(dir,cipher);assert.equal((await reload.current()).apiKey,'fake-private-test-key');
  if(process.platform!=='win32')assert.equal((await fs.stat(store.file)).mode&0o777,0o600);
}));
test('unavailable encryption fails closed',()=>temp(async dir=>{
  const store=new SettingsStore(dir,{...cipher,isAsyncEncryptionAvailable:async()=>false});
  const config=await store.candidate({provider:'deepseek',model:'fixture',apiKey:'fake-secret'});
  await assert.rejects(store.save(config),/Keychain/);
  assert.equal((await store.metadata()).provider,'codex_local');
  await assert.rejects(fs.access(store.file));
}));
test('ollama cannot direct keys/content to an arbitrary remote endpoint',()=>{
  for(const baseUrl of ['https://evil.example/v1','http://127.0.0.1:11434/v1?x=1','http://user:pass@localhost:11434/v1','file:///tmp/a','http://localhost/v1'])
    assert.throws(()=>validate({provider:'ollama',model:'fixture',baseUrl}));
  assert.throws(()=>validate({provider:'__proto__',model:'x'}));
});
test('corrupted saved configuration is preserved, not silently overwritten',()=>temp(async dir=>{
  const file=path.join(dir,'ai-settings.json');await fs.writeFile(file,'corrupt');
  await assert.rejects(new SettingsStore(dir,cipher).metadata());assert.equal(await fs.readFile(file,'utf8'),'corrupt');
}));
