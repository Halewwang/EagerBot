import { IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  PageEmpty,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { useBotNames } from "@/lib/agents/bot-names";
import { auditEventsQueryOptions } from "@/lib/audit/queries";
import { silenceOf } from "@/lib/audit/silence";

/**
 * Read surface for policy, computer, component, MCP, and credential audit events.
 */
export const Route = createFileRoute("/_authed/admin/audit")({
  component: AuditPage,
});

/** One row as the API returns it. */
type AuditEvent = {
  id: string;
  actorUserId: string | null;
  eventType: string;
  targetType: string;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

const FILTERS = [
  { label: "全部", search: "" },
  { label: "计算机操作", search: "?eventType=computer.action_allowed" },
  {
    label: "已阻止",
    /*
     * Include every refusal family, not only browser policy refusals.
     *
     * `mcp.callback_refused` is here because it is a refusal, even though nothing about a Bot was
     * judged: a caller could not prove which Bot it was. Somebody filtering for what this deployment
     * turned away wants that in the list, and it is the one refusal with no policy behind it, so
     * leaving it out would hide the only evidence that anything was attempted.
     *
     * `routines.dispatch_refused` is the same shape one boundary over: the worker, not a Bot, and a
     * stale or missing secret rather than a policy decision. The same reasoning that put
     * `mcp.callback_refused` here applies unchanged — nobody was judged, something was still turned
     * away, and the saved view a person clicks for "what did this deployment block" should show it.
     */
    search:
      "?eventType=computer.action_refused,mcp.call_rejected,mcp.callback_refused,component.refused,component.function_refused,routines.dispatch_refused",
  },
  {
    label: "未执行",
    // A stalled stream belongs here. It is the same complaint as an action that was allowed and then
    // did not take: nothing was refused, and nothing came of it either.
    search: "?eventType=computer.action_failed,agent.stream_stalled",
  },
] as const;

function AuditPage() {
  const [search, setSearch] = useState<string>(FILTERS[0].search);
  const events = useQuery(auditEventsQueryOptions(search));
  const rows = (events.data?.events ?? []) as AuditEvent[];
  const nameFor = useBotNames();

  return (
    /*
     * THE ONE WIDE PAGE IN ADMIN, and the one that keeps a table. Five columns of short values is
     * what a log is; rows of prose would make every entry a paragraph and the scanning this page
     * exists for impossible. It takes the same header and the same type scale as everything else,
     * and differs only where the content forces it to.
     */
    <PageShell
      action={
        <Button onClick={() => events.refetch()} size="sm" variant="ghost">
          <IconRefresh />
          刷新
        </Button>
      }
      description="每个智能体执行的操作，以及此部署策略拒绝的操作。"
      title="审计"
      width="wide"
    >
      <PageSection>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter.label}
              onClick={() => setSearch(filter.search)}
              size="sm"
              type="button"
              /* The fill is the state, as on every other set of switches in the app. */
              variant={search === filter.search ? "default" : "outline"}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {events.isPending ? null : events.isError ? (
          <p className="mt-4 text-destructive text-sm" role="alert">
            审计记录加载失败。
          </p>
        ) : rows.length === 0 ? (
          <PageEmpty>暂无匹配此筛选条件的事件。</PageEmpty>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr className="border-border border-b">
                  <th className="px-4 py-2 font-medium">时间</th>
                  <th className="px-4 py-2 font-medium">操作</th>
                  <th className="px-4 py-2 font-medium">对象</th>
                  <th className="px-4 py-2 font-medium">智能体</th>
                  <th className="px-4 py-2 font-medium">决定</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => (
                  <Row event={event} key={event.id} nameFor={nameFor} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}

function Row({
  event,
  nameFor,
}: {
  event: AuditEvent;
  nameFor: (botId: string) => string;
}) {
  const payload = event.payload ?? {};
  const decision = (payload.decision ?? {}) as {
    allowed?: boolean;
    mode?: string;
    rule?: string | null;
    carriedOut?: boolean;
  };
  const element = payload.element as
    | { role?: string; name?: string }
    | string
    | undefined;
  const refused =
    event.eventType === "computer.action_refused" ||
    event.eventType === "component.refused" ||
    event.eventType === "component.function_refused" ||
    event.eventType === "mcp.call_rejected" ||
    /*
     * A caller that could not prove which Bot it was. Refused like the others, and it has to read
     * that way here: the fallback below calls anything it does not recognise "Allowed", which for a
     * refusal is the one wrong answer. A trail that is confidently wrong is worse than a silent one.
     */
    event.eventType === "mcp.callback_refused" ||
    // The worker turned away at the door, same reasoning as the caller above.
    event.eventType === "routines.dispatch_refused";
  const stalled = event.eventType === "agent.stream_stalled";
  /*
   * Three different things, and the difference is what somebody comes to this row to find out.
   *
   * A person naming a coworker, the router matching one, and the router giving up and using the
   * default are not the same event, and one label covering all three would make the row worth less
   * than the reason line under it. Nothing here is a refusal, so none of them take the refusal
   * colour.
   */
  const routed =
    event.eventType === "channel.routed"
      ? payload.viaMention === true
        ? "用户选择了该协作者"
        : payload.fallback === true
          ? "已发送给默认协作者"
          : "已发送给指定协作者"
      : null;
  // Allowed by policy but not carried out. A stalled turn belongs in the same family: the Bot was
  // asked and the answer never arrived. Colour is how this table is read, and a row left in the
  // muted foreground reads as "Allowed", which a turn nobody ever got an answer to was not.
  const failed = event.eventType === "computer.action_failed" || stalled;
  const silence = stalled ? silenceOf(payload) : null;

  return (
    <tr className="border-border border-t align-top">
      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
        {new Date(event.createdAt).toLocaleTimeString("zh-CN")}
      </td>
      <td className="px-4 py-2 font-medium">
        {/* Strip the internal computer tool namespace for display. */}
        {typeof payload.action === "string"
          ? payload.action.replace("computer_", "")
          : event.eventType}
      </td>
      <td className="px-4 py-2">
        {/*
         * A routing row's subject is the coworker it went to, and it is the only thing on the row
         * worth reading. Its target type is `agent`, which is not a named target because everywhere
         * else an agent id appears it belongs in the Bot column; here nothing acted, so there is no
         * Bot and the target is all there is. Rendered through `nameFor` so it reads as the name on
         * the roster rather than the immutable id.
         */}
        {event.eventType === "channel.routed" && event.targetId ? (
          <span title={event.targetId}>{nameFor(event.targetId)}</span>
        ) : /*
         * A discovery row's subject is the narrowing itself, so the numbers are the subject. A
         * reader asking "why did it not call the tool" needs to see that eleven of thirty were
         * offered before anything else on the row means anything.
         */
        event.eventType === "mcp.tools_discovered" ? (
          <span className="font-mono text-xs">
            {typeof payload.offered === "number" &&
            typeof payload.granted === "number"
              ? `${payload.offered}/${payload.granted} 个工具`
              : "-"}
          </span>
        ) : /* Named targets and file paths are the audit subject before page elements. */
        NAMED_TARGETS.has(event.targetType) && event.targetId ? (
          <span className="font-mono text-xs">
            {event.targetId}
            {typeof payload.function === "string" ? (
              <span className="text-muted-foreground">
                {" "}
                · {payload.function}
              </span>
            ) : null}
          </span>
        ) : typeof payload.file === "string" ? (
          <span className="font-mono text-xs">{payload.file}</span>
        ) : typeof payload.command === "string" ? (
          // The command is the subject of its own row, the way a path is for a file action.
          <span className="font-mono text-xs">{payload.command}</span>
        ) : typeof element === "object" && element?.name ? (
          <span>
            {element.name}
            {element.role ? (
              <span className="text-muted-foreground"> ({element.role})</span>
            ) : null}
          </span>
        ) : typeof element === "string" ? (
          <span className="text-muted-foreground">{element}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
        {/* Page host is meaningful only for browser actions, not workspace file actions. */}
        {typeof payload.file !== "string" &&
        typeof payload.command !== "string" &&
        typeof payload.page === "string" &&
        payload.page ? (
          <div className="text-xs text-muted-foreground">
            {hostOf(payload.page)}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-2 text-muted-foreground">
        {typeof payload.bot === "string" ? (
          // Keep the immutable bot id available even when names collide.
          <span title={payload.bot}>{nameFor(payload.bot)}</span>
        ) : (
          "-"
        )}
      </td>
      <td className="px-4 py-2">
        <span
          className={
            refused
              ? "font-medium text-destructive"
              : failed
                ? "font-medium text-amber-600 dark:text-amber-500"
                : "text-muted-foreground"
          }
        >
          {routed ??
            DECISIONS[event.eventType] ??
            (refused ? "已阻止" : failed ? "未执行" : "已允许")}
        </span>
        {/* Refusal reasons mirror the conversation-facing reason. */}
        {(event.eventType === "component.refused" ||
          event.eventType === "component.function_refused" ||
          event.eventType === "mcp.call_rejected") &&
        typeof payload.reason === "string" ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {payload.reason}
          </div>
        ) : null}
        {/*
         * Why this run was offered what it was, which is the only part of a discovery row that
         * cannot be worked out from the numbers. "Nothing declared" and "selector unavailable" both
         * offer everything and mean entirely different things about the deployment.
         */}
        {event.eventType === "mcp.tools_discovered" &&
        typeof payload.reason === "string" ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {DISCOVERY_REASONS[payload.reason] ?? payload.reason}
            {Array.isArray(payload.skills) && payload.skills.length > 0
              ? `: ${payload.skills.join(", ")}`
              : ""}
          </div>
        ) : null}
        {event.eventType === "mcp.callback_refused" &&
        typeof payload.refusal === "string" ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {payload.refusal}
          </div>
        ) : null}
        {/*
         * Why the conversation went where it went, which is the whole reason the row is written.
         * Without it a routing row says "Allowed" and names nobody, which is indistinguishable from
         * a row that failed to write.
         */}
        {event.eventType === "channel.routed" &&
        typeof payload.reason === "string" ? (
          /*
           * A width rather than a max-width, because the table lays itself out from its content and
           * a max-width on a block inside a cell does not constrain that. A router's reason is a
           * sentence a model wrote, not a rule name, and left unbounded in the last column it
           * pushes the table wider than the page and the end of the sentence goes off the edge,
           * where nobody scrolls to find it.
           */
          <div className="mt-0.5 w-[22rem] break-words text-xs text-muted-foreground">
            {payload.reason}
          </div>
        ) : null}
        {event.eventType === "bot.declined" &&
        typeof payload.reason === "string" ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {payload.reason}
            <span className="italic">，由智能体自身报告</span>
          </div>
        ) : null}
        {failed && typeof payload.failure === "string" ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {payload.failure}
          </div>
        ) : null}
        {/*
         * The two numbers the stall row is worth reading for. Without them every stalled turn looks
         * the same, and the difference between an endpoint that dies halfway through an answer and
         * one that never begins is the difference between a slow Bot and a dead one.
         */}
        {silence ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{silence}</div>
        ) : null}
        {/* Show concrete policy rules, but suppress the uninformative default `true` allow rule. */}
        {decision.rule && decision.rule !== "true" ? (
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
            {decision.rule}
          </div>
        ) : null}
        {decision.mode === "dry-run" && decision.carriedOut ? (
          <div className="text-xs text-muted-foreground">
            试运行：已记录，未执行
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * Target types whose id is a name worth putting on screen.
 *
 * Anything else falls through to the element or file subject.
 */
/**
 * Why a run was offered the tools it was, in words rather than in the slug the server writes.
 *
 * Every one of these looks the same from outside: the Bot was handed some tools. The distinction is
 * the difference between a deployment that narrowed on purpose, one that has never declared a skill,
 * and one whose selector could not be reached, and only the last is a fault.
 */
const DISCOVERY_REASONS: Record<string, string> = {
  "under-floor": "工具数量较少，全部提供",
  "nothing-declared": "没有技能声明这些工具",
  unavailable: "无法选择，因此全部提供",
  "nothing-chosen": "没有应用技能，因此全部提供",
  selected: "由技能选择",
};

const NAMED_TARGETS = new Set([
  "component",
  "mcp_tool",
  "mcp_server",
  "skill",
  "credential",
]);

const DECISIONS: Record<string, string> = {
  "bot.declined": "智能体已拒绝",
  // Not a refusal, so not the refusal colour: nothing was blocked. The Bot was asked and never
  // answered, which is the same complaint as an action that was allowed and then did not happen.
  "agent.stream_stalled": "智能体停止响应",
  "computer.policy_loaded": "启动时加载边界",
  "computer.isolation_loaded": "启动时加载隔离设置",
  "computer.control_taken": "用户接管控制权",
  "computer.control_released": "控制权已交还",
  "computer.help_requested": "智能体请求帮助",
  "computer.secret_requested": "智能体请求秘密",
  "computer.secret_supplied": "用户提供了秘密",
  "computer.reset": "计算机已重置",
  "computer.stopped": "用户按下了停止",

  "component.granted": "已授予此智能体",
  "component.revoked": "已从此智能体撤销",
  "component.published": "已发布，所有智能体都可使用",
  "component.unpublished": "已取消发布，所有智能体都无法使用",
  "component.draft_saved": "草稿已保存，尚未发布",
  "component.refused": "已拒绝",
  "component.function_granted": "可以读取此内容",
  "component.function_revoked": "不再允许读取此内容",
  "component.function_called": "已读取真实数据",
  "component.function_refused": "已拒绝",
  // A function failure is execution failure, not a policy refusal.
  "component.function_failed": "读取失败",

  // Not a call and not a decision: the tools this run was allowed to see. Worded so nobody reads it
  // as permission, which it is not — everything named was already granted.
  "mcp.tools_discovered": "本次运行提供的工具",
  "mcp.call_succeeded": "已代表此智能体调用",
  "mcp.call_rejected": "已阻止",
  "mcp.call_failed": "服务器未响应",
  // Not "Blocked": nothing about the Bot was judged, because nothing proved which Bot it was.
  "mcp.callback_refused": "无法确认对应的智能体",

  "configuration.changed": "配置已更改",
  "credential.created": "凭据已保存",
};

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
