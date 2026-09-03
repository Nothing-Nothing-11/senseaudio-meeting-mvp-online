/**
 * SenseAudio Plan 级并发压测工具
 *
 * 用途：模拟多个本地服务实例（worker）同时使用一个或多个 SenseAudio API Key
 * 调用商汤服务，评估一份 plan 在同 key / 多 key 场景下的并发支撑能力。
 *
 * 支持两种调用模式：
 *   - asr-websocket：WebSocket 实时 ASR（模拟多路实时会议）
 *   - chat-completions：HTTP 翻译/总结接口（模拟多路模型调用）
 *
 * 运行示例：
 *   export SENSEAUDIO_API_KEY="sk-xxx"
 *   node scripts/asr-plan-concurrency-benchmark.mjs --mode asr-websocket --workers 5 --connections-per-worker 5
 *
 *   export SENSEAUDIO_API_KEY="sk-a,sk-b,sk-c"
 *   node scripts/asr-plan-concurrency-benchmark.mjs --mode chat-completions --workers 10 --connections-per-worker 10 --key-strategy round-robin
 */

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_PATH = join(__dirname, "asr-plan-concurrency-benchmark.worker.mjs");

const DEFAULT_OPTIONS = {
  mode: "asr-websocket",
  workers: 4,
  connectionsPerWorker: 5,
  startWorkers: 1,
  stepWorkers: 1,
  maxWorkers: 10,
  holdMs: 5000,
  rampMs: 100,
  meetingDurationMs: 300000,
  audioChunkMs: 100,
  targetLanguage: "",
  chatModel: "senseaudio-s2",
  keyStrategy: "single",
  connectTimeoutMs: 10000,
  taskStartTimeoutMs: 10000,
  requestTimeoutMs: 30000,
  stepMode: false,
  steadyMode: false,
  steadyDurationMs: 30000,
};

function parseOptions() {
  const args = process.argv.slice(2);
  const get = (key, fallback) => {
    const index = args.findIndex((a) => a === key || a.startsWith(`${key}=`));
    if (index === -1) return fallback;
    const raw = args[index];
    if (raw.includes("=")) return raw.split("=")[1];
    return args[index + 1] ?? fallback;
  };

  const hasFlag = (key) => args.includes(key);

  const rawKeys = get("--keys", process.env.SENSEAUDIO_API_KEY || "");
  const keys = rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    console.error("[错误] 未提供 API Key。请设置 SENSEAUDIO_API_KEY 环境变量，或使用 --keys");
    process.exit(1);
  }

  const mode = get("--mode", DEFAULT_OPTIONS.mode);
  if (!["asr-websocket", "chat-completions"].includes(mode)) {
    console.error(`[错误] 不支持的 mode: ${mode}，仅支持 asr-websocket / chat-completions`);
    process.exit(1);
  }

  const keyStrategy = get("--key-strategy", DEFAULT_OPTIONS.keyStrategy);
  if (!["single", "round-robin", "random"].includes(keyStrategy)) {
    console.error(`[错误] 不支持的 key-strategy: ${keyStrategy}，仅支持 single / round-robin / random`);
    process.exit(1);
  }

  const steadyMode = hasFlag("--steady");
  const stepMode = hasFlag("--step-mode");

  return {
    mode,
    keys,
    keyStrategy,
    workers: Math.max(1, Number(get("--workers", DEFAULT_OPTIONS.workers))),
    connectionsPerWorker: Math.max(1, Number(get("--connections-per-worker", DEFAULT_OPTIONS.connectionsPerWorker))),
    startWorkers: Math.max(1, Number(get("--start-workers", DEFAULT_OPTIONS.startWorkers))),
    stepWorkers: Math.max(1, Number(get("--step-workers", DEFAULT_OPTIONS.stepWorkers))),
    maxWorkers: Math.max(1, Number(get("--max-workers", DEFAULT_OPTIONS.maxWorkers))),
    holdMs: Math.max(0, Number(get("--hold-ms", DEFAULT_OPTIONS.holdMs))),
    rampMs: Math.max(0, Number(get("--ramp-ms", DEFAULT_OPTIONS.rampMs))),
    meetingDurationMs: Math.max(1000, Number(get("--meeting-duration-ms", DEFAULT_OPTIONS.meetingDurationMs))),
    audioChunkMs: Math.max(20, Number(get("--audio-chunk-ms", DEFAULT_OPTIONS.audioChunkMs))),
    targetLanguage: get("--target-language", DEFAULT_OPTIONS.targetLanguage),
    chatModel: get("--chat-model", DEFAULT_OPTIONS.chatModel),
    connectTimeoutMs: Math.max(1000, Number(get("--connect-timeout-ms", DEFAULT_OPTIONS.connectTimeoutMs))),
    taskStartTimeoutMs: Math.max(1000, Number(get("--task-start-timeout-ms", DEFAULT_OPTIONS.taskStartTimeoutMs))),
    requestTimeoutMs: Math.max(1000, Number(get("--request-timeout-ms", DEFAULT_OPTIONS.requestTimeoutMs))),
    steadyMode,
    steadyDurationMs: Math.max(1000, Number(get("--steady-duration-ms", DEFAULT_OPTIONS.steadyDurationMs))),
    stepMode,
  };
}

function pickKey(keys, strategy, index) {
  if (keys.length === 1) return keys[0];
  if (strategy === "single") return keys[0];
  if (strategy === "round-robin") return keys[index % keys.length];
  return keys[Math.floor(Math.random() * keys.length)];
}

async function runWorkersForRound(options, workerCount, onProgress) {
  const workers = [];
  const progressState = {};

  for (let i = 0; i < workerCount; i += 1) {
    const worker = new Worker(WORKER_PATH);
    const key = pickKey(options.keys, options.keyStrategy, i);
    const config = {
      workerId: i + 1,
      mode: options.mode,
      apiKey: key,
      connectionsPerWorker: options.connectionsPerWorker,
      holdMs: options.holdMs,
      rampMs: options.rampMs,
      meetingDurationMs: options.meetingDurationMs,
      audioChunkMs: options.audioChunkMs,
      targetLanguage: options.targetLanguage,
      chatModel: options.chatModel,
      connectTimeoutMs: options.connectTimeoutMs,
      taskStartTimeoutMs: options.taskStartTimeoutMs,
      requestTimeoutMs: options.requestTimeoutMs,
    };

    const resultPromise = new Promise((resolve, reject) => {
      worker.on("message", (message) => {
        if (message.type === "fatal") {
          reject(new Error(message.error));
        } else if (message.type === "progress") {
          progressState[message.connectionId] = message;
          if (onProgress) onProgress(message);
        } else if (message.type === "done") {
          resolve(message.results);
        }
      });
      worker.once("error", reject);
      worker.once("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker 退出码 ${code}`));
      });
    });

    worker.postMessage(config);
    workers.push({ worker, resultPromise });
  }

  const progressPrinter = options.mode === "asr-websocket" ? createProgressPrinter(progressState, workerCount * options.connectionsPerWorker) : null;
  if (progressPrinter) progressPrinter.start();

  const results = await Promise.all(workers.map((w) => w.resultPromise));

  if (progressPrinter) progressPrinter.stop();

  for (const { worker } of workers) {
    await worker.terminate();
  }

  return results;
}

function createProgressPrinter(progressState, totalConnections) {
  let timer = null;

  const print = () => {
    const values = Object.values(progressState);
    if (values.length === 0) return;

    const totalResults = values.reduce((sum, v) => sum + (v.resultFinalCount ?? 0), 0);
    const totalAudio = values.reduce((sum, v) => sum + (v.audioBytesSent ?? 0), 0);
    const avgElapsed = values.length ? values.reduce((sum, v) => sum + (v.elapsedMs ?? 0), 0) / values.length : 0;

    console.log(
      `  [进度] 活跃连接 ${values.length}/${totalConnections} | 已收 result_final ${totalResults} | 已发音频 ${formatBytes(totalAudio)} | 平均运行 ${formatDuration(avgElapsed)}`
    );
  };

  return {
    start: () => {
      timer = setInterval(print, 10000);
    },
    stop: () => {
      if (timer) clearInterval(timer);
      print();
    },
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${seconds}秒`;
}

function aggregateRound(workerResults, options) {
  const totalConnections = workerResults.reduce((sum, r) => sum + r.items.length, 0);
  const successCount = workerResults.reduce((sum, r) => sum + r.successCount, 0);
  const failureCount = totalConnections - successCount;
  const allItems = workerResults.flatMap((r) => r.items);
  const avgLatency = average(allItems.filter((i) => i.ok).map((i) => i.latencyMs ?? i.taskStartMs ?? i.totalMs));
  const errors = groupBy(
    allItems.filter((i) => !i.ok),
    (i) => i.error
  );

  const asrItems = options.mode === "asr-websocket" ? allItems : [];
  const totalAudioBytesSent = asrItems.reduce((sum, i) => sum + (i.audioBytesSent ?? 0), 0);
  const totalResultFinalCount = asrItems.reduce((sum, i) => sum + (i.resultFinalCount ?? 0), 0);
  const avgResultsPerConnection = asrItems.length ? totalResultFinalCount / asrItems.length : 0;

  return {
    workerCount: workerResults.length,
    totalConnections,
    successCount,
    failureCount,
    avgLatencyMs: avgLatency,
    errors,
    totalAudioBytesSent,
    totalResultFinalCount,
    avgResultsPerConnection,
    workerResults,
  };
}

async function runSingleLongConnectionTest(options) {
  const totalConcurrency = options.workers * options.connectionsPerWorker;
  console.log(`[单次长连接测试]`);
  console.log(`Worker 数: ${options.workers} | 每 Worker 并发: ${options.connectionsPerWorker}`);
  console.log(`总并发: ${totalConcurrency} | 持续时长: ${formatDuration(options.meetingDurationMs)}`);
  console.log(`Key 策略: ${options.keyStrategy} | Keys: ${options.keys.map(maskKey).join(", ")}`);
  console.log("\n所有连接将同时启动，并持续运行到会议结束，中途不会断开。");
  console.log("注意：这会真实消耗 API 配额和音频时长额度，请确保充足。\n");

  const startedAt = Date.now();
  const workerResults = await runWorkersForRound(options, options.workers);
  const summary = aggregateRound(workerResults, options);
  const totalMs = Date.now() - startedAt;

  console.log("\n===== 单次长连接测试汇总 =====");
  console.log(`总并发: ${summary.totalConnections} | 成功: ${summary.successCount} | 失败: ${summary.failureCount}`);
  console.log(`总耗时: ${formatDuration(totalMs)}`);

  if (options.mode === "asr-websocket") {
    console.log(`已收 result_final 总数: ${summary.totalResultFinalCount}`);
    console.log(`已发音频总量: ${formatBytes(summary.totalAudioBytesSent)}`);
    console.log(`平均每路连接收到结果: ${summary.avgResultsPerConnection.toFixed(1)} 条`);
  }

  if (summary.failureCount > 0) {
    console.log("\n失败原因:");
    for (const [error, items] of Object.entries(summary.errors)) {
      console.log(`  [x${items.length}]: ${error}`);
    }
  }

  console.log("\n===== 结论 =====");
  if (summary.failureCount === 0) {
    console.log(`${summary.totalConnections} 路并发同时运行 ${formatDuration(options.meetingDurationMs)}，全部成功完成。`);
    console.log("当前 Plan 可稳定支撑该并发量。");
  } else {
    console.log(`${summary.totalConnections} 路并发中有 ${summary.failureCount} 路失败。`);
    console.log(`建议将并发控制在 ${summary.successCount} 路以内。`);
  }
}

async function runStepMode(options) {
  const rounds = [];
  let firstFailureRound = null;

  for (let workers = options.startWorkers; workers <= options.maxWorkers; workers += options.stepWorkers) {
    const roundStart = Date.now();
    console.log(`\n===== Worker 数: ${workers} | 总并发: ${workers * options.connectionsPerWorker} =====`);

    const workerResults = await runWorkersForRound(options, workers);
    const summary = aggregateRound(workerResults, options);

    console.log(`总连接: ${summary.totalConnections} | 成功: ${summary.successCount} | 失败: ${summary.failureCount}`);
    if (options.mode === "asr-websocket") {
      console.log(`已收 result_final: ${summary.totalResultFinalCount} | 已发音频: ${formatBytes(summary.totalAudioBytesSent)} | 平均每路结果: ${summary.avgResultsPerConnection.toFixed(1)}`);
    }
    if (summary.avgLatencyMs > 0) {
      console.log(`平均 latency: ${Math.round(summary.avgLatencyMs)} ms`);
    }
    if (summary.failureCount > 0) {
      for (const [error, items] of Object.entries(summary.errors)) {
        console.log(`  错误 [x${items.length}]: ${error}`);
      }
    }
    console.log(`本轮耗时: ${Date.now() - roundStart} ms`);

    rounds.push({ workers, ...summary });

    if (firstFailureRound === null && summary.failureCount > 0) {
      firstFailureRound = { workers, ...summary };
    }

    if (rounds.length >= 2) {
      const prev = rounds[rounds.length - 2];
      const curr = rounds[rounds.length - 1];
      if (prev.failureCount > 0 && curr.failureCount > 0 && curr.successCount <= prev.successCount) {
        console.log("\n[提前终止] 连续两轮失败且成功数未增长，判定已触及 Plan 并发上限。");
        break;
      }
    }

    if (workers + options.stepWorkers <= options.maxWorkers) {
      await sleep(1000);
    }
  }

  return { rounds, firstFailureRound };
}

async function runSteadyMode(options) {
  const totalConcurrency = options.workers * options.connectionsPerWorker;
  console.log(`\n===== 固定压力测试 =====`);
  console.log(`Worker 数: ${options.workers} | 每 Worker 连接: ${options.connectionsPerWorker}`);
  console.log(`总并发: ${totalConcurrency} | 持续时间: ${options.steadyDurationMs} ms`);
  console.log(`Key 策略: ${options.keyStrategy} | Keys: ${options.keys.map(maskKey).join(", ")}`);

  const startedAt = Date.now();
  let iteration = 0;
  const snapshots = [];

  while (Date.now() - startedAt < options.steadyDurationMs) {
    iteration += 1;
    const roundStart = Date.now();
    const workerResults = await runWorkersForRound(options, options.workers);
    const summary = aggregateRound(workerResults, options);
    snapshots.push({ iteration, elapsedMs: Date.now() - startedAt, ...summary });

    console.log(
      `[第 ${iteration} 轮] 成功 ${summary.successCount}/${summary.totalConnections} | 失败 ${summary.failureCount} | 耗时 ${Date.now() - roundStart} ms`
    );

    if (summary.failureCount > 0) {
      for (const [error, items] of Object.entries(summary.errors).slice(0, 3)) {
        console.log(`  错误 [x${items.length}]: ${error}`);
      }
    }

    await sleep(Math.max(1000, options.holdMs));
  }

  const totalSuccess = snapshots.reduce((sum, s) => sum + s.successCount, 0);
  const totalAttempt = snapshots.reduce((sum, s) => sum + s.totalConnections, 0);

  return { snapshots, totalSuccess, totalAttempt, iterations: iteration };
}

async function main() {
  const options = parseOptions();

  console.log("SenseAudio Plan 级并发压测");
  console.log(`模式: ${options.mode}`);
  console.log(`Keys: ${options.keys.map(maskKey).join(", ")} （策略: ${options.keyStrategy}）`);

  if (options.mode === "asr-websocket") {
    console.log(`会议时长: ${formatDuration(options.meetingDurationMs)} | 音频帧间隔: ${options.audioChunkMs} ms`);
  }

  if (options.stepMode) {
    console.log(`[阶梯模式] 从 ${options.startWorkers} -> ${options.maxWorkers}, 步长 ${options.stepWorkers}`);
    console.log(`每 Worker 并发: ${options.connectionsPerWorker}`);
    console.log(`单轮最大总并发: ${options.maxWorkers * options.connectionsPerWorker}`);
    if (options.mode === "asr-websocket") {
      console.log(`单轮最长总耗时: 约 ${formatDuration(options.meetingDurationMs)}`);
    }
    console.log("\n注意：这会真实消耗 API 配额，请确保额度充足。");

    const { rounds, firstFailureRound } = await runStepMode(options);

    console.log("\n===== 阶梯测试汇总 =====");
    console.log("Worker | 总并发 | 成功 | 失败 | 状态");
    for (const round of rounds) {
      const status = round.failureCount === 0 ? "通过" : "受限";
      console.log(
        `${String(round.workers).padStart(6)} | ${String(round.totalConnections).padStart(6)} | ${String(round.successCount).padStart(4)} | ${String(round.failureCount).padStart(4)} | ${status}`
      );
    }

    console.log("\n===== 结论 =====");
    if (firstFailureRound) {
      console.log(`首次出现失败的 Worker 数: ${firstFailureRound.workers}`);
      console.log(`该轮总并发: ${firstFailureRound.totalConnections}`);
      console.log(`该轮成功调用数: ${firstFailureRound.successCount}`);
      console.log(`建议 Plan 级并发控制在: ${firstFailureRound.successCount} 路以内`);
    } else {
      console.log(`在测试范围内（最多 ${options.maxWorkers} workers × ${options.connectionsPerWorker} = ${options.maxWorkers * options.connectionsPerWorker} 并发）全部成功，未触及上限。`);
      console.log("如需更高并发，请增大 --max-workers 参数继续测试。");
    }
  } else if (options.steadyMode) {
    const { snapshots, totalSuccess, totalAttempt, iterations } = await runSteadyMode(options);

    console.log("\n===== 固定压力测试汇总 =====");
    console.log(`总轮次: ${iterations}`);
    console.log(`总尝试: ${totalAttempt} | 总成功: ${totalSuccess} | 总失败: ${totalAttempt - totalSuccess}`);
    console.log(`成功率: ${((totalSuccess / totalAttempt) * 100).toFixed(2)}%`);

    const failureSnapshots = snapshots.filter((s) => s.failureCount > 0);
    if (failureSnapshots.length > 0) {
      console.log(`出现失败的轮次: ${failureSnapshots.length}/${iterations}`);
      console.log("建议降低并发或增加 key 数量。");
    } else {
      console.log("在测试期间未出现失败，当前压力可被 Plan 稳定承受。");
    }
  } else {
    await runSingleLongConnectionTest(options);
  }

  console.log("\n说明：");
  console.log("- 上述数值是 empirical 结果，可能受网络、服务端瞬时负载影响。");
  console.log("- 正式并发配额请以 SenseAudio 合同/控制台/官方文档为准。");
  console.log("- 不要把上限跑满，建议日常水位控制在 70% 左右。");
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskKey(key) {
  if (!key || key.length < 8) return "***";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
