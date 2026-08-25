import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { callComponentFunction } from "@/lib/components/queries";
import { useActiveBotId } from "@/lib/copilot/active-bot";
import { useConversation } from "@/lib/copilot/conversation";
import type { GalleryComponent } from "@/lib/copilot/gallery-registry";
import { GalleryFrame } from "./frame";
import { seriesColour } from "./palette";

/**
 * Server-filled report component. The model chooses report arguments; data and permissions come
 * from the deployment.
 */

export const ActivityReportProps = z.object({
  report: z
    .enum(["activity", "refusals"])
    .describe(
      "Which report to show: 'activity' for how much each Bot has done, 'refusals' for what this deployment recently refused",
    ),
  title: z
    .string()
    .optional()
    .describe("A heading for the report, in a few words"),
  days: z
    .number()
    .optional()
    .describe(
      "For the activity report: how many days back to count. Defaults to 7",
    ),
});

type ActivityArgs = z.infer<typeof ActivityReportProps>;

/** Which server-side function each report reads. Not the model's choice. */
const FUNCTION_FOR: Record<string, string> = {
  activity: "botActivity",
  refusals: "recentRefusals",
};

type ActivityRow = { bot: string; actions: number };
type RefusalRow = {
  at: string;
  bot: string | null;
  what: string;
  reason: string | null;
};

type State =
  | { status: "reading" }
  | { status: "refused"; reason: string }
  | { status: "read"; data: unknown };

export function ActivityReportCard({
  report,
  title,
  days,
}: Partial<ActivityArgs>) {
  const botId = useActiveBotId();
  const conversation = useConversation();
  const [state, setState] = useState<State>({ status: "reading" });

  const functionName = report ? FUNCTION_FOR[report] : undefined;

  useEffect(() => {
    // Nothing to read until the arguments have finished streaming in.
    if (!functionName) return;
    let current = true;

    void callComponentFunction(
      "showActivityReport",
      functionName,
      days === undefined ? {} : { days },
      botId,
    ).then((result) => {
      if (!current) return;
      setState(
        result.allowed && result.data !== undefined
          ? { status: "read", data: result.data }
          : {
              status: "refused",
              reason: result.reason ?? result.error ?? "无法读取该数据。",
            },
      );
    });

    return () => {
      current = false;
    };
  }, [functionName, days, botId]);

  if (!report) {
    return (
      <GalleryFrame title="报告">
        <p className="text-sm text-muted-foreground">正在选择报告…</p>
      </GalleryFrame>
    );
  }

  if (state.status === "reading") {
    return (
      <GalleryFrame caption="正在读取此部署的数据" title={title ?? "报告"}>
        <p className="text-sm text-muted-foreground">读取中…</p>
      </GalleryFrame>
    );
  }

  if (state.status === "refused") {
    return (
      <GalleryFrame title={title ?? "报告"}>
        <p className="text-sm text-destructive">未显示</p>
        <p className="mt-1 text-sm text-foreground/80">{state.reason}</p>
      </GalleryFrame>
    );
  }

  return report === "activity" ? (
    <ActivityChart
      ask={conversation?.ask}
      data={state.data as { days: number; rows: ActivityRow[] }}
      title={title}
    />
  ) : (
    <RefusalList
      ask={conversation?.ask}
      data={state.data as { rows: RefusalRow[] }}
      title={title}
    />
  );
}

function ActivityChart({
  data,
  title,
  ask,
}: {
  data: { days: number; rows: ActivityRow[] };
  title?: string;
  ask?: (text: string) => void;
}) {
  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <GalleryFrame title={title ?? "智能体活动"}>
        <p className="text-sm text-muted-foreground">
          过去 {data?.days ?? 7} 天内没有智能体执行过任何操作。
        </p>
      </GalleryFrame>
    );
  }

  const busiest = rows[0];
  const most = Math.max(...rows.map((row) => row.actions));

  return (
    <GalleryFrame
      action={
        ask && busiest ? (
          <Button
            onClick={() =>
              ask(`请查看审计记录，总结 ${busiest.bot} 实际执行过的操作。`)
            }
            size="sm"
            variant="outline"
          >
            询问最忙碌的智能体
          </Button>
        ) : undefined
      }
      caption={`根据此部署的审计记录统计，最近 ${data.days} 天`}
      title={title ?? "智能体活动"}
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li className="flex items-center gap-3" key={row.bot}>
            <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
              {row.bot}
            </span>
            <span className="h-4 flex-1 overflow-hidden rounded bg-foreground/5">
              <span
                className="block h-full rounded"
                style={{
                  backgroundColor: seriesColour(index),
                  // Normalize to the busiest Bot so relative activity stays readable across ranges.
                  width: `${most === 0 ? 0 : Math.round((row.actions / most) * 100)}%`,
                }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums">
              {row.actions}
            </span>
          </li>
        ))}
      </ul>
    </GalleryFrame>
  );
}

function RefusalList({
  data,
  title,
  ask,
}: {
  data: { rows: RefusalRow[] };
  title?: string;
  ask?: (text: string) => void;
}) {
  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <GalleryFrame title={title ?? "最近的拒绝"}>
        <p className="text-sm text-muted-foreground">
          此部署最近没有拒绝任何操作。
        </p>
      </GalleryFrame>
    );
  }

  return (
    <GalleryFrame
      action={
        ask ? (
          <Button
            onClick={() =>
              ask(
                "请解释列表中最近一次拒绝的原因，以及需要如何改变才能允许该操作。",
              )
            }
            size="sm"
            variant="outline"
          >
            解释最近一次拒绝
          </Button>
        ) : undefined
      }
      caption="读取自此部署的审计记录"
      title={title ?? "最近的拒绝"}
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li className="text-sm" key={`${row.at}-${row.what}`}>
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{row.what}</span>
              {row.bot ? (
                <span className="text-xs text-muted-foreground">{row.bot}</span>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(row.at).toLocaleString("zh-CN")}
              </span>
            </div>
            {row.reason ? (
              <p className="text-xs text-muted-foreground">{row.reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </GalleryFrame>
  );
}

export const GALLERY: GalleryComponent[] = [
  {
    /*
     * NO `preview`, DELIBERATELY. This one reads the deployment through `callComponentFunction` as
     * soon as it mounts, and needs the Bot and conversation it was called in. Drawing it in Admin
     * would put a real read, attributed to whichever Bot happened to be active, behind a page that
     * only means to show what the component looks like. Admin draws it as unpreviewable instead.
     */
    name: "showActivityReport",
    title: "活动报告",
    kind: "card",
    description:
      "显示此部署实际执行过的操作，数据读取自部署自身的记录。可用于回答“智能体最近在做什么”或“哪些操作被拒绝”。你选择报告类型和时间范围，数据会在页面中读取并展示。",
    parameters: ActivityReportProps,
    Component: ActivityReportCard as GalleryComponent["Component"],
    confirmation:
      "报告已显示在用户屏幕上，内容来自此部署读取的统计数据。具体数据不会提供给智能体。",
    reads: (args) => {
      const report = typeof args.report === "string" ? args.report : undefined;
      const functionName = report ? FUNCTION_FOR[report] : undefined;
      return functionName ? [functionName] : [];
    },
  },
];
