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


def transcribe_streaming(file_path, output_file=None):
    """
    Transcribe an audio/video file using faster-whisper with:
    - Voice Activity Detection (VAD) to skip silence
    - Streaming NDJSON output: one JSON line per segment as it's ready
    - Progress messages printed to stderr

    If output_file is provided, each JSON line is also written to that file.
    Otherwise, output goes only to stdout.

    Output format (stdout, line-delimited NDJSON):
      {"start": 0.0, "end": 2.5, "text": "Xin chào"}
      {"start": 2.5, "end": 5.0, "text": "bạn khỏe không"}
      {"__done__": True, "count": 42}

    Progress/info messages are sent to stderr (visible in Electron terminal).

    NOTE: Model is cached automatically by Hugging Face Hub after first download.
    Location: C:\\Users\\<user>\\.cache\\huggingface\\hub\\
    """
    # Open output file if specified (append mode, so each run appends; or use 'w' to overwrite)
    f_out = None
    if output_file:
        f_out = open(output_file, 'w', encoding='utf-8')

    def emit(line):
        """Print to stdout AND write to file if opened."""
        print(line, flush=True)
        if f_out:
            f_out.write(line + '\n')
            f_out.flush()

    # Log to stderr so Electron can relay progress to UI
    print("[whisper] Loading model... (cached after first download)", file=sys.stderr, flush=True)

    # Use "medium" model (1.5GB, cached after first download) for good Vietnamese accuracy.
    # Larger models are more accurate for Vietnamese but slower:
    #   "tiny"   (75MB)  — fast but poor Vietnamese quality
    #   "small"  (500MB) — okay Vietnamese, moderate speed
    #   "medium" (1.5GB) — good Vietnamese, used by default
    #   "large-v3" (3GB) — best Vietnamese but slowest
    model = WhisperModel("medium", device="auto", compute_type="auto")

    print(f"[whisper] Model loaded. Transcribing {file_path} with VAD...", file=sys.stderr, flush=True)

    # Use VAD to skip silence — greatly reduces processing time for long recordings
    # with conversational speech and pauses
    segments, info = model.transcribe(
        file_path,
        language="vi",
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,   # merge pauses shorter than 500ms
            threshold=0.5,                 # VAD sensitivity (0-1, lower = more aggressive)
        )
    )

    count = 0
    for segment in segments:
        count += 1
        line = json.dumps({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip()
        }, ensure_ascii=False)
        emit(line)

    # Send completion marker with total count
    emit(json.dumps({"__done__": True, "count": count}))

    print(f"[whisper] Done - {count} segments", file=sys.stderr, flush=True)

    if f_out:
        f_out.close()
        print(f"[whisper] Output written to {output_file}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    file_path = sys.argv[1]

    # Optional second argument: output file path
    output_file = None
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]

    try:
        transcribe_streaming(file_path, output_file)
    except Exception as e:
        # Print error as JSON so Electron can parse it
        print(json.dumps({"error": str(e)}, ensure_ascii=False), flush=True)
        sys.exit(1)