// SenseAudio TTS 测试页的 CORS 代理（零依赖，仅 Node 内置模块）
// 用途：浏览器直连 api.senseaudio.cn 若被 CORS 拦截，用它转发。
// 运行：node tts-proxy.js  然后在测试页勾选“使用本地代理”。
// 它原样透传 Authorization 头与请求体，不存储任何 key。

const http = require('http');
const https = require('https');

const PORT = 8787;
const UPSTREAM = 'api.senseaudio.cn';
const ALLOW_PATHS = new Set(['/v1/t2a_v2', '/v1/get_voice']);

const server = http.createServer((req, res) => {
  // CORS 预检
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || !ALLOW_PATHS.has(req.url)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found: ' + req.method + ' ' + req.url }));
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const upReq = https.request({
      hostname: UPSTREAM,
      path: req.url,
      method: 'POST',
      headers: {
        'Authorization': req.headers['authorization'] || '',
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }, (upRes) => {
      // 透传上游状态与内容类型（SSE 流会原样流回浏览器）
      res.writeHead(upRes.statusCode, {
        'Content-Type': upRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      upRes.pipe(res);
    });

    upReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream error: ' + err.message }));
    });

    upReq.write(body);
    upReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`TTS 代理已启动: http://localhost:${PORT}`);
  console.log(`转发到 https://${UPSTREAM}，允许路径: ${[...ALLOW_PATHS].join(', ')}`);
  console.log('在测试页勾选“使用本地代理”后即可使用。Ctrl+C 停止。');
});
