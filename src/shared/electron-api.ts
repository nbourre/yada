/**
 * Shape of the API exposed on `window.electronAPI` by the preload script.
 * Shared between the main process (implementation) and the renderer
 * process (consumer) so the two can't drift apart.
 */
export interface ElectronAPI {
  // File operations
  selectFile: () => Promise<string | null>;
  saveFile: (defaultPath?: string) => Promise<string | null>;
  showItemInFolder: (path: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  parseFile: (filePath: string) => Promise<any>;
  parseSolution: (summaryPath: string) => Promise<any>;
  isSummaryFile: (base64Content: string) => Promise<boolean>;
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

  // Solution events
  onSolutionDiscovered: (callback: (solution: any) => void) => void;
  onSolutionFileStatus: (callback: (update: any) => void) => void;
  onSolutionParsed: (callback: (solution: any) => void) => void;

  // Menu events
  onMenuEvent: (callback: (event: string, data?: any) => void) => void;
  removeMenuListeners: () => void;
}
