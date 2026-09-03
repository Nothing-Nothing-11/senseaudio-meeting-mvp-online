# SenseAudio Meeting MVP — Agent 协作规则

1. 先阅读相关代码和 README；保留并避开与当前任务无关的改动。
2. 禁止直接在 `main` 上提交或 Push。每个任务从最新 `main` 创建短生命周期分支，并通过 Pull Request 合并回 `main`。
3. 分支名为：`<type>/<owner>-<task-id>-<short-description>`。
   - `type` 仅可用 `feat`、`fix`、`refactor`、`docs`、`chore`。
   - `task-id` 使用任务看板编号；未建看板时使用 `yyyymmdd-序号`，例如 `20260807-01`。
4. 一个分支只处理一个目标；不要顺带重构、升级依赖或修改无关文件。
5. Commit 使用：`<type>(<scope>): <description>`；禁止 `update`、`fix bug`、`wip` 等模糊说明。
6. 每次 Push 前，在 [`update_instruction.md`](update_instruction.md) 顶部记录关联业务 Commit、背景、改动、影响、验证、风险和回滚方式；该记录单独提交为 `docs(changelog): record <scope> update`。
7. Push 前检查暂存内容与待推送 Commit。不得提交真实会议数据、个人信息、API Key、Token、`.env`、日志、浏览器数据或构建产物；示例数据必须脱敏。
8. 改动后执行最小相关验证；失败须如实写入更新记录和 PR。
9. 禁止 force push、改写共享分支历史、删除远程分支或绕过审核，除非仓库负责人明确授权。
