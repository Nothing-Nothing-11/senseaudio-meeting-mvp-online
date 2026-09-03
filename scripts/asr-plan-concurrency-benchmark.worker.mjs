/**
 * Plan 级并发压测 Worker
 *
 * 由 asr-plan-concurrency-benchmark.mjs 启动，每个 worker 模拟一个本地服务实例，
 * 内部同时维持多个并发调用（连接/请求）到 SenseAudio。
 */

import { parentPort } from "node:worker_threads";

const WS_URL = "wss://api.senseaudio.cn/ws/v1/audio/transcriptions";
const CHAT_URL = "https://api.senseaudio.cn/v1/chat/completions";
const ASR_MODEL_NAME = "senseaudio-asr-deepthink-1.5-260319";

let WebSocketCtor = globalThis.WebSocket;
if (!WebSocketCtor) {
  try {
    const wsModule = await import("ws");
    WebSocketCtor = wsModule.WebSocket ?? wsModule.default;
  } catch {
    parentPort.postMessage({ type: "fatal", error: "缺少 ws 包，请执行 npm install ws" });
    process.exit(1);
  }
}

let currentWorkerId = 0;

parentPort.on("message", async (config) => {
  currentWorkerId = config.workerId;
  const results = await runWorker(config);
  parentPort.postMessage({ type: "done", workerId: config.workerId, results });
});

async function runWorker(config) {
  const {
    workerId,
    mode,
    apiKey,
    connectionsPerWorker,
    holdMs,
    rampMs,
    meetingDurationMs,
    audioChunkMs,
    targetLanguage,
    chatModel,
    connectTimeoutMs,
    taskStartTimeoutMs,
    requestTimeoutMs,
  } = config;

  const startedAt = Date.now();
  const promises = [];

  for (let i = 0; i < connectionsPerWorker; i += 1) {
    const connectionId = `${workerId}-${i + 1}`;
    promises.push(
      sleep(i * rampMs).then(() =>
        mode === "chat-completions"
          ? runChatCompletion(connectionId, apiKey, chatModel, requestTimeoutMs)
          : runAsrWebSocket(
              connectionId,
              apiKey,
              targetLanguage,
              meetingDurationMs,
              connectTimeoutMs,
              taskStartTimeoutMs,
              audioChunkMs
            )
      )
    );
  }

  const items = await Promise.all(promises);
  const successCount = items.filter((item) => item.ok).length;
  const failureCount = items.length - successCount;

  return {
    workerId,
    mode,
    apiKeyPrefix: maskKey(apiKey),
    totalMs: Date.now() - startedAt,
    successCount,
    failureCount,
    items,
  };
}

async function runAsrWebSocket(
  connectionId,
  apiKey,
  targetLanguage,
  meetingDurationMs,
  connectTimeoutMs,
  taskStartTimeoutMs,
  audioChunkMs
) {
  const startedAt = Date.now();
  const result = {
    connectionId,
    ok: false,
    phase: "init",
    error: "",
    sessionId: "",
    traceId: "",
    connectMs: 0,
    taskStartMs: 0,
    totalMs: 0,
    audioBytesSent: 0,
    resultFinalCount: 0,
    lastResultAt: 0,
  };

  const wsUrl = `${WS_URL}?token=${encodeURIComponent(apiKey)}`;
  let socket = null;
  let audioInterval = null;
  let progressInterval = null;
  let messageHandler = null;

  try {
    socket = new WebSocketCtor(wsUrl);
    socket.binaryType = "arraybuffer";

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("连接超时")), connectTimeoutMs);
      const onOpen = () => {
        clearTimeout(timer);
        socket.removeEventListener("open", onOpen);
        resolve();
      };
      const onError = () => {
        clearTimeout(timer);
        socket.removeEventListener("error", onError);
        reject(new Error("WebSocket 连接失败"));
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });

    result.connectMs = Date.now() - startedAt;
    result.phase = "connected";

    const connectedPayload = await waitForMessage(socket, "connected_success", connectTimeoutMs);
    result.sessionId = connectedPayload?.session_id ?? "";
    result.traceId = connectedPayload?.trace_id ?? "";
    result.phase = "connected_success";

    const taskStartPayload = buildAsrTaskStart(targetLanguage);
    socket.send(JSON.stringify(taskStartPayload));
    const taskStartedPayload = await waitForMessage(socket, "task_started", taskStartTimeoutMs);
    result.sessionId = taskStartedPayload?.session_id ?? result.sessionId;
    result.traceId = taskStartedPayload?.trace_id ?? result.traceId;
    result.taskStartMs = Date.now() - startedAt;
    result.phase = "task_started";

    // 监听识别结果
    messageHandler = (event) => {
      const payload = safeJsonParse(event.data);
      if (payload?.event === "result_final") {
        result.resultFinalCount += 1;
        result.lastResultAt = Date.now();
      }
    };
    socket.addEventListener("message", messageHandler);

    // 持续发送模拟音频（100ms 一帧，16kHz PCM）
    const samplesPerChunk = Math.floor((16000 * audioChunkMs) / 1000);
    audioInterval = setInterval(() => {
      if (socket.readyState === 1) {
        const chunk = generateAudioChunk(samplesPerChunk, 440);
        socket.send(chunk);
        result.audioBytesSent += chunk.length;
      }
    }, audioChunkMs);

    // 定期向主进程汇报进度
    progressInterval = setInterval(() => {
      parentPort.postMessage({
        type: "progress",
        workerId: currentWorkerId,
        connectionId,
        resultFinalCount: result.resultFinalCount,
        audioBytesSent: result.audioBytesSent,
        elapsedMs: Date.now() - startedAt,
      });
    }, 5000);

    // 模拟整场会议时长
    await sleep(meetingDurationMs);

    clearInterval(audioInterval);
    clearInterval(progressInterval);

    await finishAsrTask(socket);
    result.phase = "finished";
    result.ok = true;
  } catch (error) {
    result.error = `${result.phase}: ${error.message}`;
    result.ok = false;
  } finally {
    if (audioInterval) clearInterval(audioInterval);
    if (progressInterval) clearInterval(progressInterval);
    if (messageHandler && socket) socket.removeEventListener("message", messageHandler);
    if (socket && socket.readyState !== 3) {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
    result.totalMs = Date.now() - startedAt;
  }

  return result;
}

function generateAudioChunk(sampleCount, frequency = 440) {
  const buffer = Buffer.alloc(sampleCount * 2);
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / 16000;
    const value = Math.sin(2 * Math.PI * frequency * t) * 30000;
    buffer.writeInt16LE(Math.round(value), i * 2);
  }
  return buffer;
}

function safeJsonParse(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildAsrTaskStart(targetLanguage) {
  const payload = {
    event: "task_start",
    model: ASR_MODEL_NAME,
    audio_setting: { sample_rate: 16000, format: "pcm", channel: 1 },
    vad_setting: { silence_duration: 500, min_speech_duration: 300 },
  };
  if (targetLanguage) {
    payload.transcription_setting = { target_language: targetLanguage, recognize_mode: "record_only" };
  }
  return payload;
}

function waitForMessage(socket, targetEvent, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`等待 ${targetEvent} 超时`));
    }, timeoutMs);

    const onMessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.event === targetEvent) {
        clearTimeout(timer);
        cleanup();
        resolve(payload);
      } else if (payload.event === "task_failed") {
        clearTimeout(timer);
        cleanup();
        reject(new Error(payload.base_resp?.status_msg || "task_failed"));
      }
    };

    const onClose = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("连接在收到响应前关闭"));
    };

    const onError = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("WebSocket 错误"));
    };

    const cleanup = () => {
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);
  });
}

function finishAsrTask(socket) {
  return new Promise((resolve, reject) => {
    if (socket.readyState !== 1) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待 task_finished 超时"));
    }, 10000);

    const onMessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload.event === "task_finished") {
        clearTimeout(timer);
        cleanup();
        resolve(payload);
      }
    };

    const cleanup = () => socket.removeEventListener("message", onMessage);
    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ event: "task_finish" }));
  });
}

async function runChatCompletion(connectionId, apiKey, model, requestTimeoutMs) {
  const startedAt = Date.now();
  const result = {
    connectionId,
    ok: false,
    phase: "request",
    error: "",
    latencyMs: 0,
    totalMs: 0,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "你是一个会议实时翻译器。仅输出译文，不解释。" },
          { role: "user", content: "text: 这个 API 先走 websocket，后面再补 token 的鉴权层。\nsource_language: zh\ntarget_language: ja" },
        ],
      }),
    });

    clearTimeout(timer);
    result.latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
    }

    await response.json();
    result.ok = true;
    result.phase = "success";
  } catch (error) {
    result.error = `${result.phase}: ${error.message}`;
    result.ok = false;
  } finally {
    clearTimeout(timer);
    result.totalMs = Date.now() - startedAt;
  }

  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskKey(key) {
  if (!key || key.length < 8) return "***";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
