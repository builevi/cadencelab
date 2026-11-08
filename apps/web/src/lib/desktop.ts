export type DesktopProvider = "codex_local" | "openai" | "gemini" | "deepseek" | "groq" | "ollama";
export interface DesktopSettings { provider:DesktopProvider; selectedProvider:DesktopProvider; model:string; baseUrl:string; hasKey:boolean }
export interface SettingsInput { provider:DesktopProvider; model:string; baseUrl:string; apiKey:string; removeKey?:boolean }
export interface DesktopBridge {
  getSettings:(provider?:DesktopProvider)=>Promise<DesktopSettings>;
  saveSettings:(settings:SettingsInput)=>Promise<DesktopSettings>;
  testConnection:(settings:SettingsInput)=>Promise<{ok:boolean;message:string;provider:string;model:string}>;
  checkUpdates:()=>Promise<{current:string;latest:string;available:boolean;downloadUrl:string|null;releaseUrl:string;notes:string}>;
  openUpdate:()=>Promise<void>;
  appInfo:()=>Promise<{version:string;platform:string;arch:string;packaged:boolean}>;
}
declare global { interface Window { cadenceDesktop?:DesktopBridge } }
