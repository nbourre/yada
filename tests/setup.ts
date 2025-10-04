// Jest setup file
// Global test configuration and mocks go here

// Mock Electron APIs for testing
(global as any).mockElectron = {
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  app: {
    getPath: jest.fn(() => '/mock/path'),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn(),
};

// Mock sql.js for testing
jest.mock('sql.js', () => ({
  default: jest.fn().mockImplementation(() =>
    Promise.resolve({
      Database: jest.fn().mockImplementation(() => ({
        run: jest.fn(),
        exec: jest.fn(),
        prepare: jest.fn().mockReturnValue({
          step: jest.fn(),
          get: jest.fn(),
          getAsObject: jest.fn(() => ({})),
          free: jest.fn(),
        }),
        close: jest.fn(),
      })),
    })
  ),
}));

// Mock saxes parser for testing
jest.mock('saxes', () => ({
  SaxesParser: jest.fn().mockImplementation(() => ({
    write: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  })),
}));
