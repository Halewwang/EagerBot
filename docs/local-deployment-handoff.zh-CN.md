# OpenBot 本地部署交接

更新时间：2026-08-25（Asia/Shanghai）

## 目标与当前结论

目标是在当前 Mac 上运行官方 OpenBot，并用真实浏览器验收首页、主要导航和运行日志。

本地核心开发栈已经可用：网页、API、PostgreSQL、CopilotKit Intelligence 和许可证均已连通，官方 Docker 镜像也已预构建。现在只缺模型凭据：`.env` 中的 `OPENAI_API_KEY` 仍为空，因此没有启动 `agent-bot`，也没有把“页面可用”误报成“真实 Bot 对话已通过”。

CopilotKit 托管项目已创建并选中为 `openbot-local`。Runtime key、license token、登录信息和模型 key 都只能保存在本机私有配置中，不要写进本文件或提交到 Git。

## 仓库状态

- 上游仓库：`CopilotKit/OpenBot`
- 上游基线：`d293f23 Let a package say which skills each coworker gets (#227)`
- 本地分支：`main`
- 本地提交：
  - `953a95a Fix tenant package paths with spaces`
  - `b2934f3 Document local deployment handoff`
  - `4a601d8 Fix Button-as-Link semantics`
- 本地提交尚未推送。
- `.env` 已由仓库规则忽略；`.copilotkit/` 已在本机 `.git/info/exclude` 中排除。

`953a95a` 只修复测试夹具在含空格仓库路径中使用 URL `pathname` 的问题，改用 Node 标准库 `fileURLToPath`。`4a601d8` 将 6 处实际渲染为链接的 Base UI Button 改成仓库已有 `buttonVariants` 样式的原生链接，并为纯图标“新建频道”链接补充可访问名称；没有增加依赖或新抽象。

## 架构摘要

| 服务 | 默认端口 | 职责 |
| --- | ---: | --- |
| React/Vite app | 3010 | 用户界面；开发时将 `/api` 和 WebSocket 代理到 API |
| Hono server | 3001 | 认证、CopilotKit runtime、策略、审计、凭据、插件、组件与 channels |
| PostgreSQL + pgvector | 5432 | 产品数据、审计、策略、凭据与元数据 |
| agent-computer | 4100 | 每个 Bot 的 Chromium、文件与 shell 工具 |
| agent-bot | 4200 | OpenAI 兼容的 AG-UI 示例 Bot |
| agent-langgraph | 4201 | LangGraph AG-UI 示例 Bot |
| supervisor | 4500 | 通过 Docker 为 Bot 管理独立 computer 容器 |
| CopilotKit Intelligence | 外部服务 | 持久线程、记忆与 realtime gateway；仓库没有无 Intelligence 的降级模式 |

## 已完成

- 仓库克隆到 `/Users/adler/Documents/ChatGPT/Open BOt`；
- Bun 校准为仓库 CI 使用的 `1.3.14`；
- 根目录及 `agent-bot`、`agent-langgraph` 的锁定依赖均已安装；
- 安装 Docker CLI、Docker Compose 与 Colima；
- Colima 以 6 CPU、10 GiB 内存、50 GiB 磁盘运行 Docker；
- PostgreSQL/pgvector 容器已启动并健康，数据库迁移已应用；
- CopilotKit CLI 已登录，项目 `openbot-local` 已创建并选中；
- Intelligence runtime key 与有效许可证已写入本机 `.env`；
- `bun run dev` 已同时启动网页和 API；
- `agent-computer`、`agent-bot`、`agent-langgraph`、`supervisor`、`migrate` 镜像均已成功预构建；
- 真实浏览器已验收首页、Agents 导航和新建频道链接语义。

## 已验证

| 检查 | 结果 |
| --- | --- |
| `bun run format:check` | 通过 |
| `bun run lint` | 通过；仅有 Biome schema 版本提示 |
| `bun run typecheck` | 通过 |
| `bun run build` | 通过；仅有现有 bundle size 等非阻塞 warning |
| `bun run test` | 通过：1445 passed、10 skipped、0 failed（122 files） |
| Docker 镜像构建 | 5/5 通过 |
| PostgreSQL health / migration | 通过 |
| `GET /health` | `status: ok` |
| `/api/capabilities` | `mode: intelligence`、durable history 已启用 |
| `/api/copilotkit/info` | license `valid`，注册 `general-assistant` 与 `knowledge` |
| 浏览器首页 | `http://localhost:3010/` 正常显示新频道输入框和两个内置 Agent |
| 浏览器主要导航 | 点击 Agents 后进入 `/agents`，页面状态正确 |
| 浏览器控制台 | 无应用错误；只剩 Vite/React/Lit 开发模式提示 |
| 新建频道链接 | DOM 为带 `href="/channel/new"` 的 `<a>`，无伪造 button role，并有 `aria-label` |

## 当前运行状态

- `openbot-postgres-1`：运行中，`127.0.0.1:5432`，healthy；
- Vite app：运行中，`http://localhost:3010/`；
- API server：运行中，`http://localhost:3001/`；
- `INTELLIGENCE_API_KEY`：已配置；
- `COPILOTKIT_LICENSE_TOKEN`：已配置且验证有效；
- `OPENAI_API_KEY`：未配置；
- Agent 与 supervisor 镜像：已构建但容器未启动；
- 真实模型回复、computer 工具调用与 `test:smoke`：等待模型凭据后验证。

当前网页/API 是开发进程，Mac 重启后不会自动恢复；PostgreSQL 由 Colima 中的 Docker 容器运行。

## 继续步骤

1. 用户直接在本机 `.env` 填写 `OPENAI_API_KEY`；如果使用 OpenAI 兼容网关，同时填写 `OPENAI_BASE_URL`。不要把 key 发到聊天或提交到 Git。
2. 运行 `bash scripts/start.sh`。脚本会生成本机 Bot 间认证 token、启动 Agent 与 supervisor 容器，并复用或校正当前网页/API 进程。
3. 再次验证 `/health`、`/api/capabilities`、`/api/copilotkit/info` 与所有容器 health。
4. 在 `/bot` 发送一条真实消息，验证流式回复、computer 工具和审计记录。
5. 运行 `bun run test:smoke`。普通构建与静态页面不能替代真实 Bot journey。

## 常用运维命令

```sh
# 查看服务
docker compose ps

# 完整启动（模型凭据完成后）
bash scripts/start.sh

# 停止 Compose 服务
docker compose down

# 启停 Colima
colima start
colima stop
```

`start.sh` 还可能由 supervisor 创建带 `openbot.supervisor=true` 标签的 computer 容器；仅执行 `docker compose down` 不一定会删除这些运行时容器。按项目脚本最终打印的停止说明处理，不要用宽泛删除命令。
