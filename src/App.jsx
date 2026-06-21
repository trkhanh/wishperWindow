import React, { useState, useCallback, useRef } from 'react';

function App() {
  const [filePath, setFilePath] = useState(null);
  const [fileName, setFileName] = useState('');
  const [segments, setSegments] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [statusText, setStatusText] = useState('');
  const [activeTab, setActiveTab] = useState('segments'); // segments | fulltext
  const dropRef = useRef(null);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  };

  const handlePickFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (result) {
        setFilePath(result);
        setFileName(result.split(/[/\\]/).pop());
        setSegments([]);
        setStatus('idle');
        setStatusText('');
      }
    } catch (err) {
      setStatus('error');
      setStatusText('Failed to open file dialog: ' + err.message);
    }
  };

  const handleTranscribe = async () => {
    if (!filePath) return;

    setStatus('loading');
    setStatusText('Transcribing... (this may take a while on first run as it downloads the model)');
    setSegments([]);

    try {
      const result = await window.electronAPI.transcribeAudio(filePath);
      if (result.error) {
        setStatus('error');
        setStatusText(result.error);
      } else {
        setSegments(result);
        setStatus('done');
        setStatusText(`Done — ${result.length} segments`);
      }
    } catch (err) {
      setStatus('error');
      setStatusText(err.message);
    }
  };

  const handleCopy = () => {
    const text = segments.map(s => `[${formatTime(s.start)} -> ${formatTime(s.end)}] ${s.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.copy-btn');
      if (btn) {
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy all'; }, 2000);
      }
    });
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.add('dragover');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.remove('dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) dropRef.current.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const f = files[0];
      // In Electron, dropped files have a `path` property
      if (f.path) {
        setFilePath(f.path);
        setFileName(f.name);
        setSegments([]);
        setStatus('idle');
        setStatusText('');
      }
    }
  }, []);

  // Build full text from segments
  const fullText = segments.map(s => s.text).join(' ');

  const statusClass = status === 'loading' ? 'loading' : status === 'error' ? 'error' : status === 'done' ? 'done' : '';

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🎙 Whisper Desktop</h1>
        <p>Offline Vietnamese audio transcription</p>
      </div>

      {/* Drop zone or selected file */}
      {!filePath ? (
        <div
          className="drop-zone"
          ref={dropRef}
          onClick={handlePickFile}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="icon">📁</div>
          <div className="label">Click to select or drop an audio/video file</div>
          <div className="hint">Supports MP3, WAV, M4A, MP4, OGG, FLAC, AAC</div>
        </div>
      ) : (
        <div className="selected-file">
          <span className="file-icon">🎵</span>
          <div>
            <div className="file-name">{fileName}</div>
            <div className="file-path">{filePath}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => {
            setFilePath(null);
            setFileName('');
            setSegments([]);
            setStatus('idle');
            setStatusText('');
          }} style={{ marginLeft: 'auto' }}>
            ✕ Clear
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="controls">
        <button className="btn btn-primary" onClick={handlePickFile} disabled={status === 'loading'}>
          📂 Choose File
        </button>
        <button className="btn btn-primary" onClick={handleTranscribe} disabled={!filePath || status === 'loading'}>
          {status === 'loading' ? '⏳ Transcribing...' : '🤖 Transcribe'}
        </button>
      </div>

      {/* Status */}
      {statusText && (
        <div className={`status-bar ${statusClass}`}>
          {status === 'loading' ? '⏳ ' : status === 'error' ? '❌ ' : status === 'done' ? '✅ ' : ''}
          {statusText}
        </div>
      )}

      {/* Results */}
      {segments.length > 0 && (
        <>
          <div className="header-row">
            <div className="tabs">
              <button className={`tab ${activeTab === 'segments' ? 'active' : ''}`} onClick={() => setActiveTab('segments')}>
                Segments
              </button>
              <button className={`tab ${activeTab === 'fulltext' ? 'active' : ''}`} onClick={() => setActiveTab('fulltext')}>
                Full Text
              </button>
            </div>
            <button className="copy-btn" onClick={handleCopy}>📋 Copy all</button>
          </div>

          {activeTab === 'segments' ? (
            <div className="transcript-container">
              {segments.map((seg, i) => (
                <div className="transcript-segment" key={i}>
                  <span className="timestamp">{formatTime(seg.start)} → {formatTime(seg.end)}</span>
                  <span className="text">{seg.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <textarea className="full-text-area" readOnly value={fullText} />
          )}
        </>
      )}

      {segments.length === 0 && status !== 'loading' && (
        <div className="transcript-container">
          <div className="transcript-empty">
            Select an audio file and click "Transcribe" to begin
          </div>
        </div>
      )}
    </div>
  );
}

export default App;