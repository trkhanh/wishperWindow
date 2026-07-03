# wishperWindow - High-Level Architecture

```mermaid
---
title: wishperWindow Architecture
---
graph TB
    %% User Interaction Layer
    subgraph "User Interface Layer (Electron + React)"
        UI[Electron Main Window] --> PRELOAD[Preload Script<br/>electron/preload.js]
        PRELOAD --> IPC[IPC Bridge<br/>contextBridge]
        IPC --> REACT[React App<br/>src/App.jsx]
        REACT --> CSS[Styles<br/>src/App.css]
    end

    %% Electron Main Process
    subgraph "Electron Main Process"
        MAIN[electron/main.js] --> WIN[BrowserWindow<br/>Creation & Management]
        MAIN --> DLG[Dialog API<br/>File Selection]
        MAIN --> FW[File Write<br/>Save Transcripts]
        MAIN --> PY_SPAWN[Python Process<br/>Spawn & Management]
    end

    %% IPC Communication
    subgraph "IPC Communication Channel"
        IPC_BRIDGE[contextBridge API] --> CHANNELS{IPC Channels}
        CHANNELS --> |"select-file"| SELECT_FILE[Open File Dialog]
        CHANNELS --> |"transcribe"| TRANSCRIBE[Run Transcription]
        CHANNELS --> |"save-file"| SAVE_FILE[Save Transcript]
    end

    %% Python Backend
    subgraph "Python Whisper Backend"
        PYTHON[whisper_service.py] --> WHISPER[OpenAI Whisper Model]
        PYTHON --> TORCH[PyTorch - CUDA/MPS/CPU]
        PYTHON --> FFMPEG[ffmpeg - Audio Processing]
        PYTHON --> JSON_OUT[JSON Output<br/>Transcript + Segments]
        
        subgraph "Whisper Model Config"
            WHISPER --> |Model Size| SIZE{tiny / base / small<br/>/ medium / large}
            WHISPER --> |Computation| DEVICE{cuda / mps / cpu}
            WHISPER --> |Format| FMT{text / srt / vtt<br/>/ json / tsv}
        end

        subgraph "Audio Processing"light
            FFMPEG --> MONO[Convert to Mono 16kHz]
            MONO --> PAD[Silence Padding]
            PAD --> CHUNK[5120-sample Chunks]
        end
    end

    %% Data Flow
    subgraph "Data Flow"
        AUDIO[Audio File<br/>.mp3, .wav, .m4a, etc.] --> FFMPEG
        JSON_OUT --> MAIN
        MAIN --> FW
        FW --> TRANSCRIPT[Transcript Output File<br/>.json, .txt, etc.]
    end

    %% Relationships
    REACT -.-> |"ipcRenderer.invoke"| IPC
    IPC -.-> |"ipcMain.handle"| MAIN
    MAIN -.-> |"child_process.spawn"| PYTHON
    PYTHON -.-> |"stdout JSON"| MAIN
    MAIN -.-> |"event reply"| REACT

    %% Styling
    classDef electron fill:#6C5CE7,color:#fff,stroke:#4834d4
    classDef react fill:#61DAFB,color:#000,stroke:#2d98da
    classDef python fill:#3776AB,color:#fff,stroke:#2b5b84
    classDef model fill:#00B894,color:#fff,stroke:#00a381
    classDef audio fill:#FDCB6E,color:#000,stroke:#e17055
    classDef ipc fill:#E17055,color:#fff,stroke:#d35400

    class MAIN,PRELOAD,UI,DLG,FW,WIN,SELECT_FILE,TRANSCRIBE,SAVE_FILE electron
    class REACT,CSS react
    class PYTHON,WHISPER,TORCH,FFMPEG python
    class SIZE,DEVICE,FMT model
    class MONO,PAD,CHUNK,AUDIO,JSON_OUT,TRANSCRIPT audio
    class IPC_BRIDGE,CHANNELS,IPC ipc
```

## Component Overview

### 1. User Interface Layer (Electron + React)
- **Electron Main Window**: The desktop application window
- **Preload Script** (`electron/preload.js`): Exposes a secure API via `contextBridge` for IPC communication
- **React App** (`src/App.jsx`): The frontend UI built with React, featuring:
  - File selection button
  - Model configuration (size, device, output format)
  - Transcription results display
  - Save functionality

### 2. Electron Main Process (`electron/main.js`)
- Manages the BrowserWindow lifecycle
- Handles IPC channels:
  - `select-file`: Opens native file dialog for audio selection
  - `transcribe`: Spawns a Python child process to run Whisper
  - `save-file`: Saves transcription results to disk
- Spawns and manages the Python process

### 3. Python Whisper Backend (`python/whisper_service.py`)
- **Whisper Model**: OpenAI's Whisper automatic speech recognition model
- **PyTorch**: Deep learning framework (supports CUDA/MPS/CPU)
- **ffmpeg**: Handles audio format conversion, resampling to 16kHz mono
- **Output Formats**: JSON (with segments), text, SRT, VTT, TSV

### 4. Data Flow
1. User selects an audio file via the React UI
2. Electron opens a native file dialog
3. User configures Whisper parameters (model size, device, format)
4. Electron spawns a Python process with the selected audio file
5. Python processes the audio via ffmpeg, runs Whisper inference
6. Transcription results are returned as JSON via stdout
7. React UI displays the results
8. User can save the transcript to a file

## Technology Stack
| Component | Technology |
|-----------|------------|
| Desktop Shell | Electron |
| Frontend | React 18 + Vite |
| IPC Bridge | contextBridge (Electron) |
| ASR Model | OpenAI Whisper |
| ML Framework | PyTorch |
| Audio Processing | ffmpeg |
| Bundler | Vite |