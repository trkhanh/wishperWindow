import sys
import json
import os
import io

# Force stdout/stderr to use UTF-8 (critical for Vietnamese characters when spawned from Node.js)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Disable symlink warning on Windows
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from faster_whisper import WhisperModel

def transcribe(file_path):
    """
    Transcribe an audio/video file using faster-whisper.
    Returns a list of segments with start, end, and text.
    """
    # Log to stderr so Electron can relay progress to UI
    print("[whisper] Loading model... (first run downloads ~500MB)", file=sys.stderr, flush=True)

    # Use "tiny" model for fast startup (75MB, already cached)
    # To upgrade: change to "small" (500MB) or "medium" (1.5GB)
    model = WhisperModel("tiny", device="auto", compute_type="auto")

    print(f"[whisper] Model loaded. Transcribing {file_path}...", file=sys.stderr, flush=True)

    segments, info = model.transcribe(file_path, language="vi", beam_size=5)

    result = []
    for segment in segments:
        result.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip()
        })

    print(f"[whisper] Done - {len(result)} segments", file=sys.stderr, flush=True)
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        output = transcribe(file_path)
        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
