const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDbPath: (currentPath) => ipcRenderer.invoke('select-db-path', currentPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDbUrl: () => ipcRenderer.invoke('get-db-url'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
});
