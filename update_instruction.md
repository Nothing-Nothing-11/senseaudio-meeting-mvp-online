# 更新说明（Push 前必填）

本文件记录每次推送到远程仓库的变更背景、影响、验证与回滚方式。每次 Push 前，在本文件顶部按以下模板追加一条记录，并单独创建 `docs(changelog)` Commit。

> 不要在记录中填写本条记录自身的 Commit ID；仅填写已完成的业务 Commit。具体执行规则见仓库根目录的 [`AGENTS.md`](AGENTS.md)。

---

## 2026-09-03 — Nothing-Nothing-11 — Pages Actions Node 24 upgrade

- **分支**：`chore/nothing-nothing-11-20260903-02-pages-actions-node24`
- **关联业务 Commit**：
  - `9704acb chore(deploy): upgrade Pages actions to Node 24`
- **变更背景**：首次 Pages 发布成功，但 GitHub Actions 提示旧动作仍以 Node.js 20 为目标；官方最新主版本已迁移到 Node 24。
- **主要改动**：升级 `actions/checkout` 至 v7、`actions/configure-pages` 至 v6、`actions/upload-pages-artifact` 至 v5；保留 `actions/deploy-pages` v5。
- **影响范围**：仅影响 GitHub Pages CI 运行时，不改变站点内容。
- **配置、环境变量或数据结构变化**：无。
- **验证结果**：工作流 YAML 解析通过；四个 Actions 引用均为已核验的官方 Node 24 / composite 版本；`git diff --cached --check` 通过。
- **已知风险**：官方动作主版本升级可能改变内部实现；将以实际 Pages 工作流和线上 HTTP 冒烟结果作为发布门槛。
- **回滚方式**：回滚 Commit `9704acb`，恢复上一组 Actions 主版本，并删除本条更新记录。

---

## 2026-09-03 — Nothing-Nothing-11 — GitHub Pages deployment

- **分支**：`chore/nothing-nothing-11-20260903-01-github-pages`
- **关联业务 Commit**：
  - `d412b05 chore(deploy): add GitHub Pages workflow`
- **变更背景**：将原私有仓库 `main` 的当前版本复制到新的公开仓库，并使用 GitHub 官方 Pages Actions 持续发布在线演示。
- **主要改动**：
  - 新增 GitHub Pages 工作流，保留 `app/`、`src/`、模型和第三方静态资源的既有相对路径。
  - 新增站点根入口，将访问者跳转到 `app/login.html`。
- **影响范围**：仅影响新仓库的 GitHub Pages 构建和发布；不修改会议业务逻辑、API 地址或数据结构。
- **配置、环境变量或数据结构变化**：新增 Pages 工作流权限 `pages: write` 与 `id-token: write`；无运行时环境变量变化。
- **验证结果**：
  - `python` 解析 `.github/workflows/deploy-pages.yml`：通过。
  - `node --check` 检查 35 个 JavaScript / MJS 文件：通过。
  - 以真实项目子路径启动静态预览：站点根、登录页、登录模块与 ONNX 模型均返回 HTTP 200。
  - `git diff --cached --check`：通过。
- **已知风险**：GitHub Pages 仅托管静态文件，不能运行仓库中的可选 Node TTS 代理；生产使用前仍需验证浏览器权限、SenseAudio API 跨域策略和 API Key 管理方式。
- **回滚方式**：回滚 Commit `d412b05`，关闭 GitHub Pages，并删除本条更新记录。

---

## 2026-08-07 — Codex — collaboration guardrails

- **分支**：`docs/codex-20260807-01-agent-rules`
- **关联业务 Commit**：
  - `b58f219 docs(agent): add collaboration guardrails`
- **变更背景**：为项目建立轻量协作规则，优先统一分支开发、提交和 Push 前记录流程，避免过早绑定技术选型。
- **主要改动**：
  - 新增精简 `AGENTS.md`，约束分支命名、原子 Commit、敏感会议数据保护和最小验证。
  - 新增本更新说明模板，要求每次 Push 前记录变更背景、影响、验证、风险和回滚方式。
- **影响范围**：研发协作流程与仓库文档；不影响页面、音频处理、接口或运行配置。
- **配置、环境变量或数据结构变化**：无。
- **验证结果**：`git diff --cached --check` 通过；文档改动无需执行应用验证。
- **已知风险**：无。
- **回滚方式**：回滚 Commit `b58f219`，并删除本条更新记录。

---

## YYYY-MM-DD — 作者 — 简短变更标题

- **分支**：`<type>/<owner>-<task-id>-<short-description>`
- **关联业务 Commit**：
  - `<commit-id> <type>(<scope>): <description>`
- **变更背景**：
- **主要改动**：
  - （逐项填写）
- **影响范围**：
- **配置、环境变量或数据结构变化**：无 / 具体说明。
- **验证结果**：
  - `命令或手动验证步骤`：通过 / 失败（说明原因）。
- **已知风险**：无 / 具体说明。
- **回滚方式**：回滚关联业务 Commit，并删除本条更新记录。

---
