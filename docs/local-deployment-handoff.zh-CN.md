# OpenBot 本地部署交接

更新时间：2026-08-25（Asia/Shanghai）

## 目标与当前结论

目标是在当前 Mac 上运行官方 OpenBot，并用真实浏览器验收首页、主要导航和运行日志。

完整本地开发栈已经部署并通过验收：网页、API、PostgreSQL、CopilotKit Intelligence、许可证、Agent 容器、Supervisor 和按 Bot 隔离的 Computer 均已连通。内置 `knowledge` 与远程 `risk-analyst` 都在真实浏览器中产生了非空模型回复，官方 smoke journey 也验证了真实 Chromium、策略拒绝与审计链路。

CopilotKit 托管项目已创建并选中为 `openbot-local`。Runtime key、license token、登录信息和模型 key 都只能保存在本机私有配置中，不要写进本文件或提交到 Git。

## 仓库状态

- 上游仓库：`CopilotKit/OpenBot`
- 上游基线：`d293f23 Let a package say which skills each coworker gets (#227)`
- 本地分支：`main`
- 本地提交：
  - `953a95a Fix tenant package paths with spaces`
  - `b2934f3 Document local deployment handoff`
  - `4a601d8 Fix Button-as-Link semantics`
  - `f4de151 Update local deployment handoff`
  - `f0436f4 Fix watched server restart matching`
  - `8917c69 Allow the local managed agent endpoint`
- 本地提交尚未推送。
- `.env` 已由仓库规则忽略；`.copilotkit/` 已在本机 `.git/info/exclude` 中排除。

`953a95a` 只修复测试夹具在含空格仓库路径中使用 URL `pathname` 的问题，改用 Node 标准库 `fileURLToPath`。`4a601d8` 将 6 处实际渲染为链接的 Base UI Button 改成仓库已有 `buttonVariants` 样式的原生链接，并为纯图标“新建频道”链接补充可访问名称。`f0436f4` 让首次生成本机 token 时也能正确重启带 `--watch` 的开发 API；`8917c69` 仅对白名单中的默认受管 Agent 地址 `localhost:<LANGGRAPH_PORT>` 放行，没有开启全局私网访问。所有修复都复用了现有配置入口，没有增加依赖或新抽象。

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
- OpenAI 兼容模型 key 与 base URL 已由用户写入本机 `.env`；
- 网页与 API 已启动，API 使用 Docker Supervisor 为每个 Bot 隔离 Computer；
- `agent-computer`、`agent-bot`、`agent-langgraph`、`supervisor`、`migrate` 镜像均已成功预构建；
- `agent-computer`、`agent-bot`、`agent-langgraph`、`supervisor` 与 PostgreSQL 容器均已启动并健康；
- 真实浏览器已验收首页、Agents 导航、新建频道链接语义、内置 Agent 回复和远程 AG-UI Agent 回复；
- Supervisor 已为 `risk-analyst` 创建独立、健康的 Computer 容器。

## 已验证

| 检查 | 结果 |
| --- | --- |
| `bun run format:check` | 通过 |
| `bun run lint` | 通过；仅有 Biome schema 版本提示 |
| `bun run typecheck` | 通过 |
| `bun run build` | 通过；仅有现有 bundle size 等非阻塞 warning |
| `bun run test` | 独立测试数据库通过：1447 passed、10 skipped、0 failed（122 files） |
| Docker 镜像构建 | 5/5 通过 |
| PostgreSQL health / migration | 通过；临时测试库已在测试后删除 |
| `GET /health` | `status: ok` |
| `/api/capabilities` | `mode: intelligence`、durable history 已启用 |
| `/api/copilotkit/info` | license `valid`，注册 `general-assistant`、`knowledge`、`risk-analyst` |
| `bun run test:smoke` | 5 passed、0 failed；真实浏览器、截图、策略拒绝、审计与恢复均通过 |
| 浏览器首页 | `http://localhost:3010/` 正常显示新频道输入框和两个内置 Agent |
| 浏览器主要导航 | 点击 Agents 后进入 `/agents`，页面状态正确 |
| 内置模型回复 | `knowledge` 返回非空中文回复并完成运行 |
| 远程模型回复 | `risk-analyst` 经 `agent-langgraph` 返回非空中文职责说明并完成运行 |
| 浏览器控制台 | 最终全新对话无应用错误；只剩 Lit 开发模式提示 |
| 新建频道链接 | DOM 为带 `href="/channel/new"` 的 `<a>`，无伪造 button role，并有 `aria-label` |

## 当前运行状态

- `openbot-postgres-1`：运行中，`127.0.0.1:5432`，healthy；
- Vite app：运行中，`http://localhost:3010/`；
- API server：运行中，`http://localhost:3001/`；
- `INTELLIGENCE_API_KEY`：已配置；
- `COPILOTKIT_LICENSE_TOKEN`：已配置且验证有效；
- `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`：已配置；
- `openbot-agent-computer-1`：运行中，healthy；
- `openbot-agent-bot-1`：运行中，healthy；
- `openbot-agent-langgraph-1`：运行中，healthy；
- `openbot-supervisor-1`：运行中，healthy；
- `openbot-computer-risk-analyst`：由 Supervisor 创建，运行中，healthy；
- 真实模型回复、Computer gateway、策略与审计：已验证。

## 重启与后续

1. Mac 或 Colima 重启后，在仓库目录运行 `bash scripts/start.sh`。
2. 打开 `http://localhost:3010/`；远程示例 Bot 可直接打开 `/bot?agent=risk-analyst`。
3. 变更模型、Agent endpoint 或服务间 token 后重新运行 `start.sh`，让进程读取新配置。
4. 发布到局域网或生产前，必须替换示例 `KEY_ENCRYPTION_KEY`、配置真实身份提供商，并重新审查所有网络白名单。

## 安全与证据边界

- 当前是仅供本机使用的开发部署：没有配置身份提供商，所有请求都被视为本地管理员；不要直接暴露到局域网或公网。
- `KEY_ENCRYPTION_KEY` 仍是公开示例值，只适合本地开发。
- `AGENT_ENDPOINT_ALLOWED_HOSTS` 的默认放行仅覆盖 `localhost:<LANGGRAPH_PORT>`；`AGENT_COMPUTER_ALLOW_PRIVATE_HOSTS` 仍为关闭状态。
- CopilotKit Intelligence 是外部托管依赖，因此这不是完全离线部署。
- `agent-bot` 的容器健康已验证；产品默认远程 Bot 使用 `agent-langgraph`，其真实模型回复已单独验证。
- 当前网页/API 是开发进程，Mac 重启后不会自动恢复；PostgreSQL 与 Agent 服务由 Colima 中的 Docker 容器运行。

## 常用运维命令

```sh
# 查看服务
docker compose ps

# 完整启动或重启
bash scripts/start.sh

# 停止 Compose 服务
docker compose down

# 启停 Colima
colima start
colima stop
```

`start.sh` 还可能由 supervisor 创建带 `openbot.supervisor=true` 标签的 computer 容器；仅执行 `docker compose down` 不一定会删除这些运行时容器。按项目脚本最终打印的停止说明处理，不要用宽泛删除命令。
