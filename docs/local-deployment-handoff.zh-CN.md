# OpenBot 本地部署交接

更新时间：2026-08-25（Asia/Shanghai）

## 目标与当前结论

目标是在当前 Mac 上运行官方 OpenBot 完整开发栈，并用真实浏览器验收首页与主要交互。

本地基础设施已经就绪，但完整产品尚未启动。当前还需要两项用户决定或输入：

1. 是否在 CopilotKit Intelligence 中创建一个托管项目，以及项目名称；
2. 在本地 `.env` 中提供 OpenAI 或 OpenAI 兼容模型凭据。完整官方 Compose 栈包含只支持 OpenAI 兼容接口的 `agent-bot`，因此默认流程需要 `OPENAI_API_KEY`。

不要把 API key、license token、运行时 key 或登录信息写进本文件或提交到 Git。

## 仓库状态

- 上游仓库：`CopilotKit/OpenBot`
- 上游基线：`d293f23 Let a package say which skills each coworker gets (#227)`
- 本地分支：`main`
- 本地新增提交：`953a95a Fix tenant package paths with spaces`
- 本地 `.env` 已创建并被 `.gitignore` 排除；Intelligence 与模型凭据仍为空。

`953a95a` 只修复测试夹具在含空格仓库路径中使用 URL `pathname` 的问题，改用 Node 标准库 `fileURLToPath`。运行时代码不受这个问题影响。

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
- 根目录依赖按 `bun.lock` 安装；
- 按官方 CI 另行安装 `agent-bot` 与 `agent-langgraph` 的独立锁定依赖；
- 安装 Docker CLI、Docker Compose 与 Colima；
- Colima 以 6 CPU、10 GiB 内存、50 GiB 磁盘运行 Docker；
- PostgreSQL/pgvector 容器已启动并健康；
- 数据库迁移已成功应用；
- CopilotKit CLI 登录已成功；
- Vite 前端已在 `http://127.0.0.1:3010/` 启动；
- 已确认 API 未启动时前端显示 `Could not load the current user (500)`，没有把 Vite 外壳误判为可用部署。

## 已验证

| 检查 | 结果 |
| --- | --- |
| `bun run format:check` | 通过 |
| `bun run lint` | 通过；仅有 Biome schema 版本提示 |
| `bun run typecheck` | 通过 |
| `bun run build` | 通过；仅有 bundle size 等非阻塞 warning |
| `bun run test` | 通过：1445 passed、10 skipped、0 failed |
| PostgreSQL health | 通过 |
| 数据库迁移 | 通过 |
| 浏览器基线 | 3010 可达；因 3001 未启动而显示预期错误态 |

## 当前运行状态

- `openbot-postgres-1`：运行中，`127.0.0.1:5432`，healthy；
- Vite app：运行中，`127.0.0.1:3010`；
- API server：未启动；
- agent-computer、agent-bot、agent-langgraph、supervisor：未启动；
- `INTELLIGENCE_API_KEY`：未配置；
- `COPILOTKIT_LICENSE_TOKEN`：未配置；
- `OPENAI_API_KEY`：未配置。

## 继续步骤

获得用户确认后：

1. 运行 `npx --yes copilotkit@latest project select`，创建或选择托管项目；
2. 将 CLI 给出的 `cpk-...` runtime key 写入本地 `.env` 的 `INTELLIGENCE_API_KEY`，不要提交；
3. 运行 `npx --yes copilotkit@latest license --write`，让 CLI 将 license 写入本地 `.env`；
4. 由用户直接在本地 `.env` 中填写 `OPENAI_API_KEY`，需要兼容网关时同时填写 `OPENAI_BASE_URL`；
5. 停止当前单独启动的 Vite 进程，运行 `bash scripts/start.sh`；
6. 验证 `/health`、`/api/capabilities`、`/api/copilotkit/info` 与 3010 首页；
7. 在真实浏览器中完成首页、导航或主要控制、控制台、截图与至少一个交互检查；
8. 具备有效模型凭据后再运行 `bun run test:smoke`，不要用普通构建代替真实 Bot journey。

## 常用运维命令

```sh
# 查看服务
docker compose ps

# 完整启动（凭据完成后）
bash scripts/start.sh

# 停止 Compose 服务
docker compose down

# 启停 Colima
colima start
colima stop
```

`start.sh` 还可能由 supervisor 创建带 `openbot.supervisor=true` 标签的 computer 容器；仅执行 `docker compose down` 不一定会删除这些运行时容器。按项目脚本最终打印的停止说明处理，不要用宽泛删除命令。
