import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { saveActionPolicyMutationOptions } from "@/lib/computers/mutations";
import {
  type ActionPolicy,
  actionPolicyQueryOptions,
  type DryRunReport,
  dryRunActionPolicy,
  type PolicyMode,
} from "@/lib/computers/queries";
import { queryClient } from "@/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * CEL computer-action boundary editor. Rules are shown as the gateway evaluates them, and denied
 * actions are recorded in Audit with the matching rule.
 */

/**
 * Presets are concrete CEL rules, not a separate policy language.
 */
const PRESETS: { label: string; rule: string; cost?: string }[] = [
  {
    label: "永不提交表单",
    // `key` is guarded by tool name so the clause short-circuits before it on actions that have no
    // keypress in them. Both tools that can press Enter are named: `computer_type` takes a `submit`
    // flag that presses it once the text is in, and a rule naming only `computer_key` left that door
    // open.
    rule: '(intent == "activate" && contains(element.name, "submit")) || ((tool.name == "computer_key" || tool.name == "computer_type") && key == "Enter")',
    cost: "也会阻止智能体在其他场景按下 Enter，因为表单中的任意字段都可以通过 Enter 提交。",
  },
  {
    label: "永不在密码字段中输入",
    rule: 'intent == "type" && contains(element.name, "password")',
    cost: "页面将密码框标记为其他名称时不受此规则覆盖，因为规则匹配的是标签。",
  },
  {
    label: "远离社交媒体",
    rule: 'intent == "navigate" && (contains(page.host, "facebook.com") || contains(page.host, "x.com"))',
    cost: "仅匹配指定的两个主机。从其他位置重定向到这些主机的链接仍然允许。",
  },
];

export const Route = createFileRoute("/_authed/admin/boundaries")({
  component: BoundariesPage,
});

function BoundariesPage() {
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState("");

  const [tested, setTested] = useState<{
    rule: string;
    report: DryRunReport;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const stored = useQuery(actionPolicyQueryOptions());
  const savePolicy = useMutation(saveActionPolicyMutationOptions(queryClient));

  /*
   * The saved policy wins while a save is in flight and after it lands: the server normalises what
   * it stores, so what came back is the policy, not what was sent.
   */
  const policy = savePolicy.data ?? stored.data ?? null;
  const saving = savePolicy.isPending;

  const save = (next: ActionPolicy) => {
    setSaved(false);
    setProblem(null);
    savePolicy.mutate(next, {
      onError: (thrown: Error) => setProblem(thrown.message),
      onSuccess: () => setSaved(true),
    });
  };

  if (problem && !policy) {
    return (
      <PageShell title="边界">
        <p className="mt-4 text-destructive text-sm" role="alert">
          {problem}
        </p>
      </PageShell>
    );
  }

  /* Nothing until the policy is known: a rule list that guesses is worse than a blank. */
  if (!policy) {
    return <PageShell title="边界">{null}</PageShell>;
  }

  const addRule = (rule: string) => {
    const trimmed = rule.trim();
    if (!trimmed || policy.deny.includes(trimmed)) return;
    void save({ ...policy, deny: [...policy.deny, trimmed] });
    setDraft("");
    setTested(null);
  };

  /*
   * The rule as it would be in force — the current policy plus this draft — replayed over recent
   * recorded actions. Nothing is saved and nothing is decided; the reply names the actions the
   * addition would have decided differently, so the rule's real reach is known before it starts
   * refusing anybody.
   */
  const testRule = async (rule: string) => {
    const trimmed = rule.trim();
    if (!trimmed) return;
    setProblem(null);
    setTesting(true);
    try {
      const report = await dryRunActionPolicy({
        ...policy,
        deny: [...policy.deny, trimmed],
      });
      setTested({ rule: trimmed, report });
    } catch (thrown) {
      setProblem((thrown as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <PageShell
      description={
        <>
          每个 Bot
          可以或不可以在计算机上执行的操作。规则会在每次操作发生前检查，拒绝结果会记录在{" "}
          <Link className="underline" to="/admin/audit">
            审计
          </Link>{" "}
          ，并附带拒绝它的规则。
        </>
      }
      title="边界"
    >
      <PageSection
        description="强制执行会停止操作。记录并允许会写入相同行并放行操作，用于在真实流量中试用规则，再决定是否开始拒绝操作。"
        title="规则匹配时"
      >
        <div className="mt-2 flex gap-2">
          {(["enforce", "dry-run"] as PolicyMode[]).map((mode) => (
            <Button
              key={mode}
              aria-pressed={policy.mode === mode}
              className={policy.mode === mode ? "bg-foreground/5" : undefined}
              disabled={saving}
              onClick={() => void save({ ...policy, mode })}
              size="sm"
              variant="outline"
            >
              {mode === "enforce" ? "停止操作" : "记录并允许"}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {policy.mode === "enforce"
            ? "智能体会被停止，并获知拒绝它的规则。"
            : "不会停止任何操作。规则匹配的每次操作都会按原本会被拒绝的方式记录，用于在启用前试用规则。"}
        </p>
      </PageSection>

      <PageSection
        description={
          <>
            规则会首先检查，匹配后立即停止：不会继续检查下方规则，Bot
            会获知拒绝它的规则。 规则使用 CEL，可以读取 <code>tool.name</code>、
            <code>intent</code>、 <code>bot.id</code>、<code>actor.id</code>、
            <code>page.url</code> 和 <code>page.host</code>
            、被操作的元素、按下的 <code>key</code>、正在处理的文件、 正在执行的{" "}
            <code>command</code>，以及调用他人工具时的 <code>mcp.server</code>、{" "}
            <code>mcp.tool</code> 和 <code>mcp.effect</code>
            。无法评估的规则会按匹配处理，因此拼写错误的拒绝规则会拒绝操作，而不会悄悄放行本应禁止的内容。
          </>
        }
        title="永远不允许的操作"
      >
        {policy.deny.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            没有规则。所有操作都会被允许并记录。
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {policy.deny.map((rule) => (
              <li
                className="flex items-center justify-between gap-4 px-3 py-2"
                key={rule}
              >
                <code className="min-w-0 break-all font-mono text-xs">
                  {rule}
                </code>
                <Button
                  disabled={saving}
                  onClick={() =>
                    void save({
                      ...policy,
                      deny: policy.deny.filter((one) => one !== rule),
                    })
                  }
                  size="sm"
                  variant="ghost"
                >
                  移除
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            aria-label="以 CEL 编写的规则"
            className="min-w-0 flex-1 font-mono text-xs"
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
              setTested(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") addRule(draft);
            }}
            placeholder='tool.name == "computer_click" && contains(element.name, "submit")'
            value={draft}
          />
          <Button
            disabled={testing || draft.trim().length === 0}
            onClick={() => void testRule(draft)}
            size="sm"
            variant="outline"
          >
            {testing ? "正在测试…" : "先测试"}
          </Button>
          <Button
            disabled={saving || draft.trim().length === 0}
            onClick={() => addRule(draft)}
            size="sm"
          >
            添加规则
          </Button>
        </div>

        {tested ? <DryRunResult report={tested.report} /> : null}

        <ul className="mt-3 space-y-2">
          {PRESETS.map((preset) => (
            <li className="flex items-start gap-3" key={preset.rule}>
              <Button
                className="shrink-0"
                disabled={saving || policy.deny.includes(preset.rule)}
                onClick={() => addRule(preset.rule)}
                size="sm"
                variant="outline"
              >
                {preset.label}
              </Button>
              {preset.cost ? (
                <span className="pt-1 text-xs text-muted-foreground">
                  {preset.cost}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        description="应用于未被拒绝列表捕获内容的基础规则。这并非形式要求：此处为空时不会允许任何操作，因此清空后部署会拒绝所有操作，而不是允许所有操作。"
        title="其他情况下允许的操作"
      >
        <ul className="mt-2 space-y-1">
          {policy.allow.map((rule) => (
            <li className="font-mono text-xs text-muted-foreground" key={rule}>
              {rule === "true" ? "true，以上未拒绝的所有操作" : rule}
            </li>
          ))}
        </ul>
      </PageSection>

      <p className="mt-8 text-muted-foreground text-xs">
        {problem ? (
          <span className="text-destructive" role="alert">
            {problem}
          </span>
        ) : saved ? (
          "已保存。它会应用于智能体执行的下一次操作。"
        ) : (
          "更改会应用于智能体执行的下一次操作，并会保留；重启后仍会按此处设置执行。"
        )}
      </p>
    </PageShell>
  );
}

/**
 * What the tested rule would have done to actions already on the trail.
 *
 * Says the number over everything scanned first, because the list below it is capped and a reader
 * who stops at the rows should not believe the rows are the whole answer.
 */
function DryRunResult({ report }: { report: DryRunReport }) {
  if (report.scanned === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        暂无可供测试的电脑操作记录。规则本身有效；只有智能体执行过操作后，才能知道它会匹配哪些内容。
      </p>
    );
  }

  return (
    <div className="mt-2" role="status">
      <p className="text-xs text-muted-foreground">
        {report.wouldRefuse === 0
          ? `已根据最近 ${report.scanned} 条电脑操作记录测试：此规则不会拒绝其中任何一条。未来操作仍可能匹配。`
          : `已根据最近 ${report.scanned} 条电脑操作记录测试：此规则会拒绝其中 ${report.wouldRefuse} 条。`}
      </p>
      {report.changes.length > 0 ? (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {report.changes.map((change) => (
            <li className="px-3 py-2" key={change.id}>
              <p className="text-xs">
                <span className="font-medium">
                  {change.would === "refused" ? "将拒绝" : "现在将允许"}
                </span>{" "}
                <code className="font-mono">{change.action}</code>
                {change.element?.name ? (
                  <> 在“{change.element.name}”上</>
                ) : null}
                {change.command ? (
                  <>
                    {" "}
                    执行 <code className="font-mono">{change.command}</code>
                  </>
                ) : null}
                {change.file ? <> 操作文件 {change.file}</> : null}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {change.bot}
                {change.page ? <> · {change.page}</> : null} ·{" "}
                {new Date(change.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {report.wouldRefuse > report.changes.length ? (
        <p className="mt-1 text-muted-foreground text-xs">
          仅显示前 {report.changes.length} 条；上方计数包含全部扫描结果。
        </p>
      ) : null}
    </div>
  );
}
