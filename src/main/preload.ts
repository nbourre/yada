/**
 * Electron Preload Script
 * Exposes secure APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../shared/electron-api';

export type { ElectronAPI };

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (defaultPath?: string) => ipcRenderer.invoke('save-file', defaultPath),
  showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  parseFile: (filePath: string) => ipcRenderer.invoke('parse-file', filePath),
  parseSolution: (summaryPath: string) => ipcRenderer.invoke('parse-solution', summaryPath),
  isSummaryFile: (base64Content: string) => ipcRenderer.invoke('is-summary-file', base64Content),
  writeTempFile: (fileName: string, content: string) =>
    ipcRenderer.invoke('write-temp-file', fileName, content),

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

  // Solution events
  onSolutionDiscovered: (callback: (solution: any) => void) => {
    ipcRenderer.on('solution-discovered', (_, solution) => callback(solution));
  },
  onSolutionFileStatus: (callback: (update: any) => void) => {
    ipcRenderer.on('solution-file-status', (_, update) => callback(update));
  },
  onSolutionParsed: (callback: (solution: any) => void) => {
    ipcRenderer.on('solution-parsed', (_, solution) => callback(solution));
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
