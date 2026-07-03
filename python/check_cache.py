"""Check if medium model is already cached."""
import os, glob

cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
model_dir = os.path.join(cache_dir, "models--Systran--faster-whisper-medium")

if os.path.exists(model_dir):
    blobs = os.path.join(model_dir, "blobs")
    if os.path.exists(blobs):
        files = os.listdir(blobs)
        total_size = sum(os.path.getsize(os.path.join(blobs, f)) for f in files if os.path.isfile(os.path.join(blobs, f)))
        print(f"Found {len(files)} files, {total_size / 1_000_000:.1f} MB total")
    else:
        print("Model dir exists but no blobs yet (still downloading?)")
else:
    print("Model not cached yet")