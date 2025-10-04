/**
 * Type definitions for renderer process
 */

interface ElectronAPI {
  // File operations
  openFileDialog: () => Promise<string | null>;
  selectDirectoryDialog: () => Promise<string | null>;

  // Project management
  loadProjects: () => Promise<any[]>;
  saveProject: (project: any) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;

  // File parsing
  parseFile: (filePath: string) => Promise<any>;

  // Export operations
  exportData: (options: any) => Promise<string>;

  // Window operations
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;

  // App metadata
  getAppVersion: () => Promise<string>;

  // Event listeners
  onProgress: (callback: (progress: number, message: string) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onProjectParsed: (callback: (project: any) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
