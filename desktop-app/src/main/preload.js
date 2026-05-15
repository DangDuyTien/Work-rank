const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggle: () => ipcRenderer.invoke('toggle'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getPrivacyInfo: () => ipcRenderer.invoke('get-privacy-info'),
  openAccessibilitySettings: () => ipcRenderer.invoke('open-accessibility-settings'),
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close'),
  logout: () => ipcRenderer.send('logout'),
  onStatus: (cb) => ipcRenderer.on('status', (e, d) => cb(d)),
  onPing: (cb) => ipcRenderer.on('ping-result', (e, d) => cb(d)),
});
