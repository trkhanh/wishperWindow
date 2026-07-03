const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  transcribeAudio: (filePath) => ipcRenderer.invoke('transcribe-audio', filePath),

  // Listen for streaming transcription progress
  onTranscribeProgress: (callback) => {
    const handler = (_event, segment) => callback(segment);
    ipcRenderer.on('transcribe-progress', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('transcribe-progress', handler);
  },

  // Listen for stderr messages (model loading, etc.)
  onTranscribeStderr: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on('transcribe-stderr', handler);
    return () => ipcRenderer.removeListener('transcribe-stderr', handler);
  },
});