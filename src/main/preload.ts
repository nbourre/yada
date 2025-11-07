/**
 * Electron Preload Script
 * Exposes secure APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface for TypeScript
export interface ElectronAPI {
  // File operations
  selectFile: () => Promise<string | null>;
  saveFile: (defaultPath?: string) => Promise<string | null>;
  showItemInFolder: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  parseFile: (filePath: string) => Promise<any>;
  writeTempFile: (fileName: string, content: string) => Promise<string>;

  // App info
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    platform: string;
    arch: string;
  }>;

  // Parsing events
  onProgress: (callback: (progress: number, message: string) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onProjectParsed: (callback: (project: any) => void) => void;

  // Menu events
  onMenuEvent: (callback: (event: string, data?: any) => void) => void;
  removeMenuListeners: () => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (defaultPath?: string) => ipcRenderer.invoke('save-file', defaultPath),
  showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  parseFile: (filePath: string) => ipcRenderer.invoke('parse-file', filePath),
  writeTempFile: (fileName: string, content: string) => ipcRenderer.invoke('write-temp-file', fileName, content),

  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Parsing events
  onProgress: (callback: (progress: number, message: string) => void) => {
    ipcRenderer.on('parse-progress', (_, progress, message) => callback(progress, message));
  },
  onError: (callback: (error: string) => void) => {
    ipcRenderer.on('parse-error', (_, error) => callback(error));
  },
  onProjectParsed: (callback: (project: any) => void) => {
    ipcRenderer.on('project-parsed', (_, project) => callback(project));
  },

  // Menu events
  onMenuEvent: (callback: (event: string, data?: any) => void) => {
    const menuHandlers = ['menu-new-project', 'menu-open-file', 'menu-export', 'menu-navigate'];

    menuHandlers.forEach(event => {
      ipcRenderer.on(event, (_, data) => callback(event, data));
    });
  },

  removeMenuListeners: () => {
    const menuHandlers = ['menu-new-project', 'menu-open-file', 'menu-export', 'menu-navigate'];

    menuHandlers.forEach(event => {
      ipcRenderer.removeAllListeners(event);
    });
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } catch (error) {
    console.error('Failed to expose electronAPI:', error);
  }
} else {
  // Fallback for when context isolation is disabled
  (window as any).electronAPI = electronAPI;
}

// Type declaration for the global window object
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
