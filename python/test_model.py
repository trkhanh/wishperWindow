"""Quick test to check if medium model can be loaded (Vietnamese transcription)."""
from faster_whisper import WhisperModel

print("Loading medium model... (1.5GB download on first run, cached after)")
m = WhisperModel("medium", device="auto", compute_type="auto")
print("medium model loaded OK - it's cached for future use")