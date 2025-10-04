/**
 * Electron Main Process
 * Handles application lifecycle, window management, and IPC communication
 */

import { app, BrowserWindow, Menu, dialog, shell, ipcMain } from 'electron';
import { join } from 'path';
// API service will be started via server process

export const APP_NAME = 'FileMaker DDR Explorer';
export const APP_VERSION = '1.0.0';

class ElectronApp {
  private mainWindow: BrowserWindow | null = null;
  private isDevelopment = process.env.NODE_ENV !== 'production';

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupApplicationMenu();
      this.setupAdditionalIpcHandlers();
      this.startBackendServer();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Quit when all windows are closed (except on macOS)
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });
    });
  }

  private async createMainWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: APP_NAME,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
        webSecurity: true,
      },
    });

    // Load the renderer
    if (this.isDevelopment) {
      await this.mainWindow.loadURL('http://localhost:8080');
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupApplicationMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Project',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.handleNewProject(),
          },
          {
            label: 'Open Project',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.handleOpenProject(),
          },
          { type: 'separator' },
          {
            label: 'Import DDR XML Files',
            accelerator: 'CmdOrCtrl+I',
            click: () => this.handleImportFiles(),
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => app.quit(),
          },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => this.showAboutDialog(),
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private async startBackendServer(): Promise<void> {
    try {
      // Backend server will be started separately via npm script
      // For development: npm run dev:server
      // For production: npm run start
      console.log('Backend API server should be running on port 3000');
    } catch (error) {
      console.error('Failed to connect to backend server:', error);
      dialog.showErrorBox('Startup Error', 'Failed to connect to application services');
    }
  }

  private async handleNewProject(): Promise<void> {
    this.mainWindow?.webContents.send('menu-action', { action: 'new-project' });
  }

  private async handleOpenProject(): Promise<void> {
    this.mainWindow?.webContents.send('menu-action', { action: 'open-project' });
  }

  private async handleImportFiles(): Promise<void> {
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: 'Select FileMaker DDR XML Files',
      filters: [
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      this.mainWindow?.webContents.send('import-files', { filePaths: result.filePaths });
    }
  }

  private showAboutDialog(): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'About',
      message: APP_NAME,
      detail: `Version ${APP_VERSION}\n\nA powerful FileMaker DDR XML analysis tool built with Electron and React.`,
      buttons: ['OK'],
    });
  }

  // Additional IPC handlers for frontend integration
  private setupAdditionalIpcHandlers(): void {
    // Dialog operations
    ipcMain.handle('dialog:open-file', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        title: 'Select FileMaker DDR XML File',
        filters: [
          { name: 'XML Files', extensions: ['xml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('dialog:select-directory', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        title: 'Select Directory',
        properties: ['openDirectory'],
      });
      return result.canceled ? null : result.filePaths[0];
    });

    // Project management (will delegate to backend API)
    ipcMain.handle('project:load-all', async () => {
      try {
        // Call backend API to get projects
        return [];
      } catch (error) {
        console.error('Error loading projects:', error);
        return [];
      }
    });

    ipcMain.handle(
      'project:save',
      async (_event: Electron.IpcMainInvokeEvent, _project: unknown) => {
        try {
          // Call backend API to save project
          return true;
        } catch (error) {
          console.error('Error saving project:', error);
          return false;
        }
      }
    );

    ipcMain.handle(
      'project:delete',
      async (_event: Electron.IpcMainInvokeEvent, _projectId: unknown) => {
        try {
          // Call backend API to delete project
          return true;
        } catch (error) {
          console.error('Error deleting project:', error);
          return false;
        }
      }
    );

    // File parsing
    ipcMain.handle('file:parse', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
      try {
        // Call backend API to parse file
        this.mainWindow?.webContents.send('progress-update', 0, 'Starting file parsing...');

        // Simulate progress updates
        for (let i = 0; i <= 100; i += 10) {
          this.mainWindow?.webContents.send('progress-update', i, `Parsing progress: ${i}%`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Return mock project data for now
        const mockProject = {
          id: Date.now().toString(),
          name: 'Parsed Project',
          fileName: filePath.split(/[/\\]/).pop() || 'unknown',
          filePath,
          status: 'ready',
          parsedAt: new Date(),
        };

        this.mainWindow?.webContents.send('project-parsed', mockProject);
        return mockProject;
      } catch (error) {
        console.error('Error parsing file:', error);
        this.mainWindow?.webContents.send('error', 'Failed to parse file');
        throw error;
      }
    });

    // Export operations
    ipcMain.handle(
      'export:data',
      async (_event: Electron.IpcMainInvokeEvent, _options: unknown) => {
        try {
          const result = await dialog.showSaveDialog(this.mainWindow!, {
            title: 'Export Data',
            defaultPath: `export_${Date.now()}.json`,
            filters: [
              { name: 'JSON Files', extensions: ['json'] },
              { name: 'CSV Files', extensions: ['csv'] },
              { name: 'XML Files', extensions: ['xml'] },
              { name: 'All Files', extensions: ['*'] },
            ],
          });
          return result.canceled ? null : result.filePath;
        } catch (error) {
          console.error('Error exporting data:', error);
          return null;
        }
      }
    );

    // Window operations
    ipcMain.on('window:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.on('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.on('window:close', () => {
      this.mainWindow?.close();
    });

    // App version
    ipcMain.handle('app:version', () => {
      return APP_VERSION;
    });
  }
}

// Initialize the application
new ElectronApp();

console.log(`${APP_NAME} v${APP_VERSION} - Main process initialized`);
