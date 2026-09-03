# SenseAudio Meeting MVP

AI 会议翻译系统。

## 启动方式

### 方式一：本地直接打开

用浏览器打开 `app/index.html` 即可。

> 注意：声纹识别功能需要加载 ONNX 模型，直接用 `file://` 协议打开可能无法加载模型，建议使用方式二。

### 方式二：启动本地服务器（推荐）

```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js
npx serve app
```

然后浏览器访问 `http://localhost:8080`。

### 方式三：部署到 Vercel

项目已包含 `vercel.json` 配置，可直接导入 Vercel 部署。

## 使用前准备

1. 在会议页面顶部输入框填入 SenseAudio API Key
2. 选择源语言和目标语言
3. 点击开始会议即可

## TTS 代理（可选）

如果浏览器直接访问 `api.senseaudio.cn` 出现 CORS 拦截，可启动本地代理：

```bash
node tts-proxy.js
```

然后在测试页勾选「使用本地代理」。
