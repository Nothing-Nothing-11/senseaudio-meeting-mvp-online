/**
 * ASR WebSocket 并发能力测试脚本
 *
 * 用途：测试同一个 SenseAudio API Key 最多能同时建立多少个
 * 活跃的 WebSocket ASR 任务（connect + task_start 成功）。
 *
 * 运行方式：
 *   node scripts/asr-concurrency-benchmark.mjs
 *   node scripts/asr-concurrency-benchmark.mjs --max 100 --step 5 --hold-ms 8000
 *
 * 依赖：
 *   - Node.js 22+（内置 WebSocket）
 *   - 或 Node.js 18/20 + `npm install ws` 后运行
 *
 * 环境变量：
 *   SENSEAUDIO_API_KEY  必填，SenseAudio API Key
 */

const WS_URL = "wss://api.senseaudio.cn/ws/v1/audio/transcriptions";
const MODEL_NAME = "senseaudio-asr-deepthink-1.5-260319";

const API_KEY = process.env.SENSEAUDIO_API_KEY;
if (!API_KEY) {
  console.error("[错误] 缺少环境变量 SENSEAUDIO_API_KEY");
  console.error("        示例：$env:SENSEAUDIO_API_KEY='your-key'; node scripts/asr-concurrency-benchmark.mjs");
  process.exit(1);
}

let WebSocketCtor = globalThis.WebSocket;
if (!WebSocketCtor) {
  try {
    const wsModule = await import("ws");
    WebSocketCtor = wsModule.WebSocket ?? wsModule.default;
  } catch {
    console.error("[错误] 当前 Node.js 版本没有全局 WebSocket，且未安装 ws 包。");
    console.error("        请执行：npm install ws");
    console.error("        或升级到 Node.js 22+。");
    process.exit(1);
  }
}

const options = parseOptions();

function parseOptions() {
  const args = process.argv.slice(2);
  const get = (key, fallback) => {
    const index = args.findIndex((a) => a === key || a.startsWith(`${key}=`));
    if (index === -1) return fallback;
    const raw = args[index];
    if (raw.includes("=")) return raw.split("=")[1];
    return args[index + 1] ?? fallback;
  };

  return {
    start: Math.max(1, Number(get("--start", "1"))),
    step: Math.max(1, Number(get("--step", "1"))),
    max: Math.max(1, Number(get("--max", "30"))),
    holdMs: Math.max(0, Number(get("--hold-ms", "5000"))),
    rampMs: Math.max(0, Number(get("--ramp-ms", "200"))),
    targetLanguage: get("--target-language", ""),
    connectTimeoutMs: Math.max(1000, Number(get("--connect-timeout-ms", "10000"))),
    taskStartTimeoutMs: Math.max(1000, Number(get("--task-start-timeout-ms", "10000"))),
  };
}

function buildTaskStartPayload() {
  const payload = {
    event: "task_start",
    model: MODEL_NAME,
    audio_setting: {
      sample_rate: 16000,
      format: "pcm",
      channel: 1,
    },
    vad_setting: {
      silence_duration: 500,
      min_speech_duration: 300,
    },
  };

  if (options.targetLanguage) {
    payload.transcription_setting = {
      target_language: options.targetLanguage,
      recognize_mode: "record_only",
    };
  }

  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSingleUser(userId) {
  const startedAt = Date.now();
  const result = {
    userId,
    ok: false,
    phase: "init",
    error: "",
    sessionId: "",
    traceId: "",
    connectMs: 0,
    taskStartMs: 0,
    totalMs: 0,
  };

  const wsUrl = `${WS_URL}?token=${encodeURIComponent(API_KEY)}`;
  let socket = null;

  try {
    socket = new WebSocketCtor(wsUrl);

    const openPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("连接超时"));
      }, options.connectTimeoutMs);

      const onOpen = () => {
        clearTimeout(timer);
        socket.removeEventListener("open", onOpen);
        resolve();
      };

      const onError = (event) => {
        clearTimeout(timer);
        socket.removeEventListener("error", onError);
        reject(new Error(event?.message || "WebSocket 连接失败"));
      };

      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });

    await openPromise;
    result.connectMs = Date.now() - startedAt;
    result.phase = "connected";

    const connectedPayload = await waitForMessage(socket, "connected_success", options.connectTimeoutMs);
    result.sessionId = connectedPayload?.session_id ?? "";
    result.traceId = connectedPayload?.trace_id ?? "";
    result.phase = "connected_success";

    socket.send(JSON.stringify(buildTaskStartPayload()));
    const taskStartedPayload = await waitForMessage(socket, "task_started", options.taskStartTimeoutMs);
    result.sessionId = taskStartedPayload?.session_id ?? result.sessionId;
    result.traceId = taskStartedPayload?.trace_id ?? result.traceId;
    result.taskStartMs = Date.now() - startedAt;
    result.phase = "task_started";

    // 保持连接活跃，模拟真实用户持续占用任务
    if (options.holdMs > 0) {
      await sleep(options.holdMs);
    }

    // 优雅结束任务
    await finishTask(socket);
    result.phase = "finished";
    result.ok = true;
  } catch (error) {
    result.error = `${result.phase}: ${error.message}`;
    result.ok = false;
  } finally {
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
        return;
      }

      if (payload.event === "task_failed") {
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

function finishTask(socket) {
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

    const cleanup = () => {
      socket.removeEventListener("message", onMessage);
    };

    socket.addEventListener("message", onMessage);
    socket.send(JSON.stringify({ event: "task_finish" }));
  });
}

async function runRound(concurrency) {
  console.log(`\n===== 并发数: ${concurrency} =====`);

  const promises = [];
  for (let i = 0; i < concurrency; i += 1) {
    promises.push(
      sleep(i * options.rampMs).then(() => runSingleUser(i + 1))
    );
  }

  const results = await Promise.all(promises);
  const successCount = results.filter((r) => r.ok).length;
  const failureCount = concurrency - successCount;

  const avgConnectMs = average(results.map((r) => r.connectMs));
  const avgTaskStartMs = average(
    results.filter((r) => r.taskStartMs > 0).map((r) => r.taskStartMs)
  );

  console.log(`成功: ${successCount}/${concurrency} | 失败: ${failureCount}`);
  if (avgConnectMs > 0) {
    console.log(`平均连接耗时: ${Math.round(avgConnectMs)} ms`);
  }
  if (avgTaskStartMs > 0) {
    console.log(`平均 task_start 耗时: ${Math.round(avgTaskStartMs)} ms`);
  }

  if (failureCount > 0) {
    const errors = groupBy(
      results.filter((r) => !r.ok),
      (r) => r.error
    );
    for (const [error, items] of Object.entries(errors)) {
      console.log(`  错误样例 [x${items.length}]: ${error}`);
    }
  }

  return { concurrency, successCount, failureCount, results };
}

async function main() {
  console.log("ASR WebSocket 并发测试");
  console.log(`URL: ${WS_URL}`);
  console.log(`模型: ${MODEL_NAME}`);
  console.log(`目标语言: ${options.targetLanguage || "无（仅转写）"}`);
  console.log(`测试范围: ${options.start} -> ${options.max}, 步长 ${options.step}`);
  console.log(`每轮保持: ${options.holdMs} ms, 连接间隔: ${options.rampMs} ms`);
  console.log("\n注意：这会真实消耗 API 配额，请确保你有足够余额/额度。");

  const rounds = [];
  let lastSuccessCount = 0;
  let firstFailureRound = null;

  for (let concurrency = options.start; concurrency <= options.max; concurrency += options.step) {
    const round = await runRound(concurrency);
    rounds.push(round);
    lastSuccessCount = round.successCount;

    if (firstFailureRound === null && round.failureCount > 0) {
      firstFailureRound = round;
    }

    // 如果已经连续两轮失败，提前结束，避免浪费额度
    if (rounds.length >= 2) {
      const prev = rounds[rounds.length - 2];
      const curr = rounds[rounds.length - 1];
      if (prev.failureCount > 0 && curr.failureCount > 0 && curr.successCount <= prev.successCount) {
        console.log("\n[提前终止] 已连续两轮失败且成功数未增长，判定已触及并发上限。");
        break;
      }
    }

    // 每轮之间稍作冷却
    if (concurrency + options.step <= options.max) {
      await sleep(1000);
    }
  }

  console.log("\n===== 测试汇总 =====");
  console.log("并发数 | 成功 | 失败 | 状态");
  for (const round of rounds) {
    const status = round.failureCount === 0 ? "通过" : "受限";
    console.log(
      `${String(round.concurrency).padStart(6)} | ${String(round.successCount).padStart(4)} | ${String(round.failureCount).padStart(4)} | ${status}`
    );
  }

  console.log("\n===== 结论 =====");
  if (firstFailureRound) {
    console.log(`首次出现失败的并发数: ${firstFailureRound.concurrency}`);
    console.log(`该轮成功建立的任务数: ${firstFailureRound.successCount}`);
    console.log(`建议将并发上限控制在: ${firstFailureRound.successCount} 路以内`);
  } else {
    console.log(`在测试范围内（最多 ${options.max} 并发）全部成功，未触及上限。`);
    console.log(`如需更高并发，请增大 --max 参数继续测试。`);
  }

  console.log("\n说明：");
  console.log("- 上述数值是 empirical 结果，可能受网络抖动、服务端瞬时负载影响。");
  console.log("- 正式商用并发配额请以 SenseAudio 合同/控制台/官方文档为准。");
  console.log("- 测试结束后请检查 SenseAudio 控制台，确认无异常账单或告警。");
}

function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function groupBy(array, keyFn) {
  const groups = {};
  for (const item of array) {
    const key = keyFn(item);
    groups[key] = groups[key] ?? [];
    groups[key].push(item);
  }
  return groups;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
