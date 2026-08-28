# EMKE Bot 本地开发交接

更新时间：2026-08-28（Asia/Shanghai）

## 目标与当前结论

目标是在当前 Mac 上基于 `Halewwang/EagerBot` fork 开发 EMKE Bot，并用真实浏览器验收品牌、中文界面、主要导航和运行日志。

## 2026-08-28 上游同步

- 上游远端：`https://github.com/CopilotKit/OpenBot.git`（`upstream`）；已执行 `git fetch upstream --prune`，并清理已删除的远端分支。
- 上游基线：从 `1a7b60a3839c4cc833953c4036891c05587fdb69` 更新至 `e725f1885da99c02164a1f1cbf284638eb8b807a`，纳入 6 个上游提交。主要包括例行任务（routines）及定时运行、智能体之间的工作转交与人工升级、Computer 会话与温池保护、部署截图清理、Responses API 模型选项，以及对应的 Kubernetes 任务配置。
- 合并提交：`9c9b3914df3819c2d4fa9e75f1d3083cb3143b87`，采用 `--no-ff` merge；以上游功能为主，并保留 EMKE Bot 品牌和全局简体中文。
- 冲突处理：共 9 个冲突文件。侧栏、页面壳、智能体页、技能页、插件详情和 `server/src/plugins/routes.ts` 保留上游组件/API、例行任务入口、Bot 授权和运行时校验，并将用户可见标签与拒绝提示恢复为中文；上游删除的 `app/src/lib/attention/*`、待处理事项路由及其服务端实现按上游删除，已检查 `routeTree` 和源码无悬空 attention 引用。
- 中文化补齐：新增例行任务列表、删除对话框、工作转交/升级状态和内置插件连接提示已翻译为简体中文；协议标记、数据库值、路由、环境变量和机器可读错误边界保持兼容值不变。插件路由测试断言同步为中文文案。
- 数据库边界：未修改 `.env`，未重置或删除本地数据。已在本地开发 PostgreSQL 中仅应用加法迁移 `0021_routines.sql` 与 `0023_routines_owner_index.sql`，并验证 `routines`、`routine_runs` 及 `routines_by_owner_idx` 存在；上游 `0022_drop_attention_resolutions.sql` 会删除旧的 `attention_resolutions` 表，按“只做加法迁移”要求暂缓，旧表继续保留。后续正式部署前须明确是否接受该破坏性迁移，再按上游顺序处理。
- 验证结果：`git diff --check`、`bun run format:check`、`bun run typecheck`、`bun run build` 通过；定向插件路由测试 15 pass、0 fail；完整 `bun test` 通过 2027 项、跳过 10 项、失败 0 项（166 个文件）。构建仅输出已有的浏览器 Node 模块 externalize 与大 chunk warning。
- 运行边界：同步开始前 Vite/API 进程已不在运行；验收期间未修改 `.env`，按当前代码重新启动了 PostgreSQL、Agent 容器、API、Vite 和例行任务 worker。网页、API 与各 Agent 健康检查均通过。启动脚本的页面身份探针已兼容 `OpenBot` 与 `EMKE Bot` 标题，避免品牌改名后把正常网页误报为未就绪。

## 2026-08-27 上游同步

- 上游远端：`https://github.com/CopilotKit/OpenBot.git`（`upstream`）；已执行 `git fetch upstream --prune`。
- 上游基线：从 `88078a412c52d5e86ee009e4ed1690ecd6c30562` 更新至 `1a7b60a3839c4cc833953c4036891c05587fdb69`，共纳入 17 个提交、85 个文件的变更。主要包括待处理事项收件箱、频道已读标记、边界策略预演、Computer 权限与 Kubernetes 网络策略、插件凭据绑定、路由未决原因、迁移和格式化配置等上游功能。
- 合并提交：`ef028360f8698fa2afca3ec99daa9b4365a8a067`，使用 `--no-ff` 合并；保留 EMKE Bot 品牌与现有简体中文文案，并以上游实现为主解决冲突。
- 冲突处理：共 4 个文件：`server/src/computer/policy.ts`、`server/src/plugins/store.ts`、`server/src/routing/classify.ts`、`server/src/routing/routes.ts`。保留上游的空 MCP 上下文识别、凭据归属与地址保护、路由未决原因记录等行为；将新增用户可见提示恢复为中文。
- 中文化补齐：上游新增的待处理事项页面、边界规则预演、频道已读和请求失败提示已翻译为简体中文；协议字段、数据库值、路由和审计枚举保持上游兼容值不变。
- 验证结果：`git diff --check`、`bun run format:check`、`bun run typecheck`、`bun run build` 通过；完整 `bun run test` 通过 1704 项、跳过 10 项、失败 0 项（145 个文件），其中上游新增功能及相关中文化定向测试为 174 pass、0 fail（14 个文件）。构建仅输出已有的大包体积及浏览器兼容性 warning。
- 数据库边界：本次未修改 `.env`、未删除或重置本地数据；已在本地开发 PostgreSQL 应用上游新增的 `0019_channel_read_marker.sql` 与 `0020_attention_resolutions.sql` 加法迁移，并通过注意事项与频道活动集成测试 19 pass。完整测试套件也已在迁移后复核通过。

## 2026-08-26 上游同步

- 上游远端：`https://github.com/CopilotKit/OpenBot.git`（`upstream`）。
- 上游基线：从 `d293f2331bd5ff9ba4ad17af6ac94570a157d26d` 更新至 `88078a412c52d5e86ee009e4ed1690ecd6c30562`（`upstream/main`）。本次纳入上游的 Kubernetes 部署、频道置顶/软删除、Notion hosted MCP、持久化工作及 Computer 页面帧等改动。
- 合并提交：`e38394346d7516ba30e8c1bd9ad03a6a1e6a5750`，采用普通 `--no-ff` merge；保留已有 EMKE Bot 品牌与中文化提交，并以中文文案解决 10 个冲突文件。
- 冲突处理：上游新增功能优先；保留频道置顶与软删除、动态 OAuth、批量工具授权、Computer 页面帧等上游行为，并将冲突处用户可见提示恢复为简体中文。未修改 `.env`，未停止本地预览服务。
- 验证结果：`git diff --check`、`bun run format:check`、`bun run typecheck`、`bun run build` 均通过；应用上游 0016–0018 加法迁移并同步中文测试断言后，`bun run test` 通过 1612 项、跳过 10 项、失败 0 项（135 个文件），频道路由、插件存储和插件连接专项测试也全部通过。
- 风险提示：本次上游更新较大（135 个文件，约 2.2 万行新增），包含数据库迁移、Kubernetes chart 和 Computer sandbox；本地预览继续使用现有运行进程，重启或部署前应先按新的迁移与配置说明复核。

## 2026-08-25 界面品牌与中文化

- 已将产品名、浏览器标题和全局用户可见品牌从 `OpenBot` 改为 `EMKE Bot`。品牌继续复用现有链路：`examples/fintech/brand.yaml` → `generate-app-config.ts` → `appConfig.brand.productName`。
- 已将应用侧栏、首页、登录、频道、智能体、技能、设置、管理后台、组件画廊及服务端返回给用户的提示统一为简体中文；默认智能体、频道和技能示例也已中文化。
- `openbot-*` 存储键、环境变量、HTTP 头、数据库标识、路由、协议值和模型工具说明保持不变，避免破坏兼容性。历史频道名称、用户自建智能体名称及第三方或模型生成内容属于业务数据，不强制改写。
- 真实浏览器已验收 1440×900 桌面布局和 390×844 移动布局：首页、智能体、个人菜单、设置和管理页面均显示中文；页面标题为 `EMKE Bot`，用户可见页面中没有 `OpenBot`，移动端无横向页面溢出。

完整本地开发栈已经部署并通过验收：网页、API、PostgreSQL、CopilotKit Intelligence、许可证、Agent 容器、Supervisor 和按 Bot 隔离的 Computer 均已连通。内置 `knowledge` 与远程 `risk-analyst` 都在真实浏览器中产生了非空模型回复，官方 smoke journey 也验证了真实 Chromium、策略拒绝与审计链路。

CopilotKit 托管项目已创建并选中为 `openbot-local`。Runtime key、license token、登录信息和模型 key 都只能保存在本机私有配置中，不要写进本文件或提交到 Git。

## 仓库状态

- fork（`origin`）：`Halewwang/EagerBot`
- 原始上游（`upstream`）：`CopilotKit/OpenBot`
- 上游基线：`1a7b60a Pin the formatter, and stop format-gating generated migrations (#267)`
- 本地分支：`main`
- 本地部署提交：
  - `953a95a Fix tenant package paths with spaces`
  - `b2934f3 Document local deployment handoff`
  - `4a601d8 Fix Button-as-Link semantics`
  - `f4de151 Update local deployment handoff`
  - `f0436f4 Fix watched server restart matching`
  - `8917c69 Allow the local managed agent endpoint`
  - `43c85c8 Record completed local deployment`
- 本次品牌与中文化提交：
  - `112a249 Brand the default tenant as EMKE Bot`
  - `fd37310 Localize the EMKE Bot interface in Chinese`
- 上游同步与交接提交：
  - `e383943 Merge upstream OpenBot main into EMKE Bot fork`
  - `69cd188 Document upstream sync handoff`
  - `0fde78d Align Chinese expectations after upstream sync`
  - `ef02836 Merge upstream OpenBot main into EMKE Bot`
  - `ab83050 Translate upstream attention UI and document sync`
  - `279e3d6 Update upstream sync verification`
  - `c450b54 Document applied upstream migrations`
  - `e966ddf Align localized route test expectations`
  - `dc194a6 Record full upstream test verification`
  - `6e72f65 Format localized route assertion`
- 上述提交已推送至 fork 的 `origin/main`；发布到线上环境仍需单独执行部署流程并验收正式地址。
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
- 真实浏览器已验收首页、“智能体”导航、新建频道链接语义、内置智能体回复和远程 AG-UI 智能体回复；
- Supervisor 已为 `risk-analyst` 创建独立、健康的 Computer 容器。

## 已验证

| 检查 | 结果 |
| --- | --- |
| `bun run format:check` | 通过 |
| `bun run lint` | 通过；仅有 Biome schema 版本提示 |
| `bun run typecheck` | 通过 |
| `bun run build` | 通过；仅有现有 bundle size 等非阻塞 warning |
| `bun run test` | 1612 passed、10 skipped、0 failed（135 files）；已应用上游 0016–0018 迁移 |
| Docker 镜像构建 | 5/5 通过 |
| PostgreSQL health / migration | 通过；临时测试库已在测试后删除 |
| `GET /health` | `status: ok` |
| `/api/capabilities` | `mode: intelligence`、durable history 已启用 |
| `/api/copilotkit/info` | license `valid`，注册 `general-assistant`、`knowledge`、`risk-analyst` |
| `bun run test:smoke` | 5 passed、0 failed；真实浏览器、截图、策略拒绝、审计与恢复均通过 |
| 浏览器品牌与中文首页 | `http://localhost:3010/` 标题和可见品牌均为 `EMKE Bot`，默认内容为中文，未出现用户可见 `OpenBot` |
| 浏览器主要导航 | 点击“智能体”进入 `/agents`；个人菜单、“设置”和“管理”页面均显示中文 |
| 移动端布局 | 390×844 下首页无页面级横向溢出，主要内容与智能体卡片正常显示 |
| 内置模型回复 | `knowledge` 返回非空中文回复并完成运行 |
| 远程模型回复 | `risk-analyst` 经 `agent-langgraph` 返回非空中文职责说明并完成运行 |
| 浏览器控制台 | 首页、智能体、设置和管理页面无应用错误；只剩 Lit 开发模式提示 |
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
- 例行任务 worker：运行中，连接本地 API 与 PostgreSQL；
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
