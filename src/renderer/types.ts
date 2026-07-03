/**
 * Type definitions for renderer process
 */

import { ElectronAPI } from '../shared/electron-api';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
