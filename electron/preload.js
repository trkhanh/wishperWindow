const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  transcribeAudio: (filePath) => ipcRenderer.invoke('transcribe-audio', filePath),
});