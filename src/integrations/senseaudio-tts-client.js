const TTS_URL = "https://api.senseaudio.cn/v1/t2a_v2";
const VOICES_URL = "https://api.senseaudio.cn/v1/get_voice";
const MODEL_NAME = "senseaudio-tts-1.5-260319";
const DEFAULT_VOICE_ID = "male_0004_a";

function hexToBytes(hex) {
  const len = hex.length >> 1;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.substr(i << 1, 2), 16);
  }
  return out;
}

function mimeFor(format) {
  switch (format) {
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "flac": return "audio/flac";
    case "pcm": return "audio/L16";
    default: return "application/octet-stream";
  }
}

export class SenseAudioTtsClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? "";
    this.url = options.url ?? TTS_URL;
    this.model = options.model ?? MODEL_NAME;
    this.voiceId = options.voiceId ?? DEFAULT_VOICE_ID;
    this.format = options.format ?? "mp3";
    this.sampleRate = options.sampleRate ?? 32000;
    this.bitrate = options.bitrate ?? 128000;
    this.speed = options.speed ?? 1;
    this.vol = options.vol ?? 1;
    this.pitch = options.pitch ?? 0;

    this.audio = null;
    this.objectUrl = null;
    this.onProgress = null;
    this.onEnded = null;
    this._synthesisSeq = 0;
  }

  buildPayload(text) {
    return {
      model: this.model,
      text,
      stream: false,
      voice_setting: {
        voice_id: this.voiceId,
        speed: this.speed,
        vol: this.vol,
        pitch: this.pitch,
      },
      audio_setting: {
        format: this.format,
        sample_rate: this.sampleRate,
        bitrate: this.bitrate,
        channel: 2,
      },
    };
  }

  async synthesize(text) {
    if (!this.apiKey) throw new Error("Missing SenseAudio API key.");
    if (!text || !text.trim()) throw new Error("Empty text.");

    const t0 = performance.now();
    const resp = await fetch(this.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildPayload(text)),
    });
    const tHeaders = performance.now();

    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      try {
        const e = await resp.json();
        msg = (e.base_resp && e.base_resp.status_msg) || e.message || msg;
      } catch {}
      throw new Error(msg);
    }

    const payload = await resp.json();
    const tBody = performance.now();

    if (payload.base_resp && payload.base_resp.status_code !== 0) {
      throw new Error(payload.base_resp.status_msg || "TTS synthesis failed.");
    }
    const hex = payload.data && payload.data.audio;
    if (!hex) throw new Error("No audio data received.");

    const bytes = hexToBytes(hex);
    const info = payload.extra_info || {};
    console.info(
      `[TTS] chars=${text.length} ttfb=${Math.round(tHeaders - t0)}ms ` +
      `body=${Math.round(tBody - tHeaders)}ms total=${Math.round(tBody - t0)}ms ` +
      `audio=${bytes.length}B len=${info.audio_length ?? "?"}ms`
    );

    return new Blob([bytes], { type: mimeFor(this.format) });
  }

  async speak(text) {
    this.stop();

    const seq = ++this._synthesisSeq;
    const blob = await this.synthesize(text);

    // Race condition check: if stop() was called during synthesis, discard result
    if (seq !== this._synthesisSeq) return null;

    this.objectUrl = URL.createObjectURL(blob);
    this.audio = new Audio(this.objectUrl);

    this.audio.addEventListener("ended", () => {
      if (typeof this.onEnded === "function") this.onEnded();
      this.stop();
    });

    if (typeof this.onProgress === "function") {
      this.audio.addEventListener("timeupdate", () => {
        if (typeof this.onProgress === "function" && this.audio) {
          this.onProgress(this.audio.currentTime, this.audio.duration);
        }
      });
    }

    await this.audio.play();
    return this.audio;
  }

  pause() {
    if (this.audio && !this.audio.paused) this.audio.pause();
  }

  async resume() {
    if (this.audio && this.audio.paused) await this.audio.play();
  }

  stop() {
    this._synthesisSeq++;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  seek(time) {
    if (this.audio && Number.isFinite(time)) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || 0));
    }
  }

  setPlaybackRate(rate) {
    if (this.audio) {
      this.audio.playbackRate = Math.max(0.5, Math.min(4, Number(rate) || 1));
    }
  }

  setVoice(voiceId) {
    this.voiceId = voiceId || DEFAULT_VOICE_ID;
  }

  get currentTime() {
    return this.audio ? this.audio.currentTime : 0;
  }

  get duration() {
    return this.audio ? this.audio.duration : 0;
  }

  get hasAudio() {
    return !!this.audio;
  }

  get isPlaying() {
    return !!(this.audio && !this.audio.paused);
  }

  get isPaused() {
    return !!(this.audio && this.audio.paused);
  }

  static async fetchVoices(apiKey) {
    const resp = await fetch(VOICES_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ voice_type: "all" }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const payload = await resp.json();
    if (payload.base_resp && payload.base_resp.status_code !== 0) {
      throw new Error(payload.base_resp.status_msg || "Failed to fetch voices.");
    }
    const groups = [
      ["系统音色", payload.system_voice],
      ["克隆音色", payload.voice_cloning],
      ["文生音色", payload.voice_generation],
    ];
    const voices = [];
    for (const [group, arr] of groups) {
      if (!Array.isArray(arr)) continue;
      for (const v of arr) {
        const desc = Array.isArray(v.description) ? v.description.join(" / ") : "";
        voices.push({
          voice_id: v.voice_id || "",
          voice_name: v.voice_name || v.voice_id || "",
          description: desc,
          group,
        });
      }
    }
    return voices;
  }
}
