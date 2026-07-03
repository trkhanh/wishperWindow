const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load from built files (run `npm run build` first, or use `npm run electron:dev` for hot reload)
  if (process.env.VITE_DEV_SERVER === 'true') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: Open file dialog
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Audio/Video Files', extensions: ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'flac', 'aac', 'wma'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// IPC: Transcribe audio file with streaming output
ipcMain.handle('transcribe-audio', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    // Use the venv Python
    const pythonPath = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe');
    const servicePath = path.join(__dirname, '..', 'python', 'whisper_service.py');

    // Include bundled ffmpeg in PATH so faster-whisper can find it
    const ffmpegDir = path.dirname(require.resolve('ffmpeg-static'));
    const env = Object.assign({}, process.env, {
      PATH: `${ffmpegDir};${process.env.PATH}`,
      PYTHONUNBUFFERED: '1', // critical: disable stdout buffering
    });

    const py = spawn(pythonPath, [servicePath, filePath], {
      cwd: path.join(__dirname, '..'),
      env,
      windowsHide: false,
    });

    let resolved = false; // guard against double resolve/reject
    let errorData = '';
    const allSegments = [];

    // Read stdout line by line for streaming NDJSON
    const rl = readline.createInterface({ input: py.stdout, crlfDelay: Infinity });

    rl.on('line', (line) => {
      // stdout is closed now, ignore leftover lines after __done__
      if (resolved) return;

      try {
        const parsed = JSON.parse(line);

        // Check for the done marker
        if (parsed.__done__) {
          resolved = true;
          resolve(allSegments);
          return;
        }

        // Check for error
        if (parsed.error) {
          resolved = true;
          reject(new Error(parsed.error));
          return;
        }

        // It's a regular segment — push to array and notify renderer
        allSegments.push(parsed);
        event.sender.send('transcribe-progress', parsed);
      } catch (parseErr) {
        // Ignore non-JSON lines (shouldn't happen, but be safe)
        console.error(`Failed to parse line: ${line}`);
      }
    });

    py.stderr.on('data', (chunk) => {
      errorData += chunk.toString('utf-8');
      // Forward stderr to renderer for progress info (model loading, etc.)
      event.sender.send('transcribe-stderr', chunk.toString('utf-8'));
    });

    py.on('close', (code) => {
      // Only reject if we haven't already resolved
      if (!resolved) {
        resolved = true;
        reject(new Error(`Python process exited with code ${code}: ${errorData}`));
      }
    });

    py.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Failed to start Python process: ${err.message}`));
      }
    });
  });
});