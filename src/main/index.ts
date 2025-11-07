/**
 * Electron Main Process
 * Handles window management, IPC communication, and system integration
 */

import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { createReadStream, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 3000;

/**
 * Create the main application window
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    icon: join(__dirname, '../assets/icon.png'), // Add app icon if available
    show: false, // Don't show until ready-to-show
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Load the React application
  // Always load from localhost since the server serves the static files
  mainWindow.loadURL(`http://localhost:${PORT}`);
  
  // Always open DevTools to debug loading issues
  mainWindow.webContents.openDevTools();

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links and prevent new windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * Start the Express server in development or production
 */
function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('startServer called, isDev:', isDev);
    
    if (isDev) {
      // In development, assume server is already running
      console.log('Development mode - skipping server start');
      resolve();
      return;
    }

    console.log('Production mode - starting server...');
    // In production, start the server process
    const serverPath = join(__dirname, '../server/server/index.js');
    console.log('Server path:', serverPath);
    
    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: PORT.toString() },
      stdio: 'pipe',
    });

    serverProcess.stdout?.on('data', data => {
      console.log(`Server: ${data}`);
    });

    serverProcess.stderr?.on('data', data => {
      console.error(`Server Error: ${data}`);
    });

    serverProcess.on('error', error => {
      console.error('Failed to start server process:', error);
      reject(error);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`Server process exited with code ${code}, signal ${signal}`);
    });

    // Give server time to start
    console.log('Waiting 2 seconds for server to start...');
    setTimeout(() => {
      console.log('Server should be ready now');
      resolve();
    }, 2000);
  });
}

/**
 * Create application menu
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-project');
          },
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openFile'],
              filters: [
                { name: 'XML Files', extensions: ['xml'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('menu-open-file', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as Excel',
              click: () => {
                mainWindow?.webContents.send('menu-export', 'xlsx');
              },
            },
            {
              label: 'Export as CSV',
              click: () => {
                mainWindow?.webContents.send('menu-export', 'csv');
              },
            },
            {
              label: 'Export as PDF',
              click: () => {
                mainWindow?.webContents.send('menu-export', 'pdf');
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.send('menu-navigate', 'dashboard');
          },
        },
        {
          label: 'Upload Files',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.send('menu-navigate', 'upload');
          },
        },
        {
          label: 'Search',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow?.webContents.send('menu-navigate', 'search');
          },
        },
        {
          label: 'Graph View',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow?.webContents.send('menu-navigate', 'graph');
          },
        },
        {
          label: 'Export',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            mainWindow?.webContents.send('menu-navigate', 'export');
          },
        },
        { type: 'separator' },
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
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About YADA',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About YADA',
              message: 'YADA - Yet Another Database Analyzer',
              detail:
                'A FileMaker Database Design Report (DDR) analysis tool\n\nVersion 1.0.0\nBuilt with Electron, React, and Node.js',
            });
          },
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/your-org/yada/docs');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/your-org/yada/issues');
          },
        },
      ],
    },
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });

    // Window menu
    template[4].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' },
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Setup IPC handlers
 */
function setupIPC(): void {
  // Handle file selection
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Handle save file dialog
  ipcMain.handle('save-file', async (event, defaultPath?: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath,
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!result.canceled) {
      return result.filePath;
    }
    return null;
  });

  // Handle showing item in folder
  ipcMain.handle('show-item-in-folder', async (event, path: string) => {
    shell.showItemInFolder(path);
  });

  // Handle opening external links
  ipcMain.handle('open-external', async (event, url: string) => {
    await shell.openExternal(url);
  });

  // Handle app info
  ipcMain.handle('get-app-info', async () => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
    };
  });

  // Handle writing temp file
  ipcMain.handle('write-temp-file', async (event, fileName: string, content: string) => {
    try {
      const tempPath = join(tmpdir(), fileName);
      writeFileSync(tempPath, content);
      console.log('Main: Wrote temp file:', tempPath);
      return tempPath;
    } catch (error) {
      console.error('Main: Error writing temp file:', error);
      throw error;
    }
  });

  // Handle file parsing
  ipcMain.handle('parse-file', async (event, filePath: string) => {
    try {
      console.log('Main: Starting to parse file:', filePath);
      
      // Send progress update
      if (mainWindow) {
        mainWindow.webContents.send('parse-progress', 0, 'Starting parse...');
      }

      // Call the server API to parse the file
      const form = new FormData();
      form.append('file', createReadStream(filePath));

      const response = await fetch(`http://localhost:${PORT}/api/parse`, {
        method: 'POST',
        body: form as any,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('Main: Parse completed successfully', result);
      
      // Extract the project from the API response
      // Server returns: { success: true, data: ParseResult }
      // ParseResult has: { project, statistics, parseTime, errors }
      const parseResult = result.data || result;
      const project = parseResult.project || parseResult;
      
      // Send parsed project to renderer
      if (mainWindow) {
        mainWindow.webContents.send('project-parsed', project);
      }

      return project;
    } catch (error) {
      console.error('Main: Parse error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Send error to renderer
      if (mainWindow) {
        mainWindow.webContents.send('parse-error', errorMessage);
      }

      throw error;
    }
  });
}

/**
 * App event handlers
 */
app.whenReady().then(async () => {
  try {
    // Start the server
    await startServer();

    // Create the main window
    createMainWindow();

    // Create application menu
    createMenu();

    // Setup IPC communication
    setupIPC();

    console.log('YADA application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Security: Prevent new window creation from renderer
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

export { mainWindow };
