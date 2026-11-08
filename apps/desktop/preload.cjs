const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cadenceDesktop',Object.freeze({
  getSettings:(provider)=>ipcRenderer.invoke('settings:get',provider),
  saveSettings:(settings)=>ipcRenderer.invoke('settings:save',settings),
  testConnection:(settings)=>ipcRenderer.invoke('settings:test',settings),
  checkUpdates:()=>ipcRenderer.invoke('updates:check'),
  openUpdate:()=>ipcRenderer.invoke('updates:open'),
  appInfo:()=>ipcRenderer.invoke('app:info')
}));
