import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageSection } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { relativeTime } from "@/lib/relative-time";
import {
  deleteRoutineMutationOptions,
  setRoutineEnabledMutationOptions,
} from "@/lib/routines/mutations";
import {
  type RoutineRecord,
  routinesQueryOptions,
} from "@/lib/routines/queries";
import { cn } from "@/lib/utils";
import { queryClient } from "@/query-client";

/**
 * What the last-run cell says, and in what tone.
 *
 * `lastRun === null` and `lastRun.status === null` are different facts, and saying the wrong one
 * invents news: the first is "this routine has never finished a run," the second is "one is open
 * right now" — which is also what a run stuck open after repeated dispatch failures looks like from
 * here. Neither is a failure, so neither gets the destructive tone; only `status: "failed"` does.
 */
function lastRunLabel(lastRun: RoutineRecord["lastRun"]): {
  text: string;
  className: string;
  /** The chip's dot, which carries the tone so the text can stay readable. */
  dot: string;
} {
  if (lastRun === null) {
    return {
      text: "尚未运行",
      className: "text-muted-foreground",
      dot: "bg-muted-foreground/40",
    };
  }
  if (lastRun.status === null) {
    return {
      text: "运行中…",
      className: "text-muted-foreground",
      dot: "animate-pulse bg-muted-foreground",
    };
  }
  const when = lastRun.at ? relativeTime(lastRun.at) : "刚刚";
  if (lastRun.status === "failed") {
    return {
      text: `失败：${when}`,
      className: "text-destructive",
      dot: "bg-destructive",
    };
  }
  if (lastRun.status === "skipped") {
    return {
      text: `已跳过：${when}`,
      className: "text-amber-600 dark:text-amber-500",
      dot: "bg-amber-500",
    };
  }
  if (lastRun.status === "succeeded") {
    return {
      text: `已运行：${when}`,
      className: "text-muted-foreground",
      dot: "bg-emerald-500",
    };
  }
  // An outcome this DTO doesn't recognise degrades to a neutral label rather than an invented
  // success — the contract typing (`RoutineRunOutcome | null`) makes a fourth outcome a build-time
  // error, but this is the runtime fallback if that ever slips through.
  return {
    text: `已完成：${when}`,
    className: "text-muted-foreground",
    dot: "bg-muted-foreground/40",
  };
}

/**
 * One fact about a routine, worn as a small pill so the footer reads as a row of states rather
 * than a sentence. On the muted item the pill's own background is what keeps it legible.
 */
function Chip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-0.5 text-xs",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The signed-in person's standing instructions: a switch to stop one taking effect, and a delete
 * that ends it for good.
 *
 * Scoped by `agentId` on a Bot's own dialog, unscoped on the Routines page. One query either way —
 * the list is owner-scoped and small, so the scope is a filter here rather than a second endpoint.
 */
export function RoutinesList({
  agentId,
  embedded = false,
}: {
  /** Show only the routines this Bot carries out. Absent shows all of the person's. */
  agentId?: string;
  /** Inside a dialog, where the page section's own top margin is somebody else's spacing. */
  embedded?: boolean;
} = {}) {
  const routines = useQuery(routinesQueryOptions());
  const setEnabled = useMutation(setRoutineEnabledMutationOptions(queryClient));
  const deleteRoutine = useMutation(deleteRoutineMutationOptions(queryClient));
  /** The routine a delete is being confirmed for, or null. Its own dialog rather than one per row. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const rows = (routines.data ?? []).filter(
    (row) => agentId === undefined || row.agentId === agentId,
  );
  const confirming = rows.find((row) => row.id === confirmingId) ?? null;

  return (
    <PageSection className={embedded ? "mt-0" : undefined}>
      {setEnabled.error ? (
        <p className="text-destructive text-sm" role="alert">
          {setEnabled.error.message}
        </p>
      ) : null}

      {/* Pending renders nothing: the empty-state sentence would otherwise flash for the fetch. */}
      {routines.isPending ? null : routines.error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          无法加载你的例行任务。
        </p>
      ) : rows.length === 0 ? (
        <Empty className="h-[180px] border border-dashed">
          <EmptyHeader>
            <EmptyTitle className="text-muted-foreground">
              {agentId ? "该智能体还没有排期" : "还没有排期"}
            </EmptyTitle>
            <EmptyDescription>
              {agentId
                ? "在频道中告诉它“每个工作日 9 点……”之类的指令，排期会显示在这里。"
                : "告诉智能体“每个工作日 9 点……”之类的指令，排期会显示在这里。"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((routine) => {
            const lastRun = lastRunLabel(routine.lastRun);
            return (
              <Item key={routine.id} variant="muted">
                {/* Paused reads at a glance: the content dims, and a chip below says the word. */}
                <ItemContent className={routine.enabled ? "" : "opacity-60"}>
                  <ItemTitle>
                    {routine.schedule}
                    <span className="font-normal text-muted-foreground text-xs">
                      {routine.timezone}
                    </span>
                  </ItemTitle>
                  <ItemDescription className="line-clamp-2">
                    {routine.instruction}
                  </ItemDescription>
                  {/* A set, so it wraps onto its own line rather than crowding the title. */}
                  <ItemFooter>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {routine.channel.gone ? (
                        <Chip className="border-destructive/40 text-destructive">
                          该频道已不存在
                        </Chip>
                      ) : (
                        // Where it posts is a place, so the chip goes there.
                        <Link
                          params={{ channelId: routine.channel.id }}
                          to="/channel/$channelId"
                        >
                          <Chip className="text-muted-foreground transition-colors hover:text-foreground">
                            {routine.channel.name ?? "未命名频道"}
                          </Chip>
                        </Link>
                      )}
                      <Chip className={lastRun.className}>
                        <span
                          className={cn("size-1.5 rounded-full", lastRun.dot)}
                        />
                        {lastRun.text}
                      </Chip>
                      {/*
                       * Enabled only: the store recomputes nextRunAt on cron/timezone change or
                       * re-enable, so a disabled routine's stamp is frozen in the past — rendering
                       * it unguarded would announce a stale "3 days ago" as the next run. Paused
                       * takes its place, so the switch's state has a word as well as a position.
                       */}
                      {!routine.enabled ? (
                        <Chip className="text-muted-foreground">已暂停</Chip>
                      ) : new Date(routine.nextRunAt).getTime() <=
                        Date.now() ? (
                        /*
                         * A stamp in the past is a firing the sweep has not picked up, and "Next 5
                         * hours ago" is nonsense. Said as what it is: due, and visibly waiting.
                         */
                        <Chip className="text-amber-600 dark:text-amber-500">
                          <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                          到期
                        </Chip>
                      ) : (
                        <Chip className="text-muted-foreground">
                          下次：{relativeTime(routine.nextRunAt)}
                        </Chip>
                      )}
                    </div>
                  </ItemFooter>
                </ItemContent>
                <ItemActions>
                  {/*
                   * Binary and immediate: it takes effect when switched, there is no save.
                   * Disabled only while its own write is in flight, so switching one routine
                   * does not freeze the rest of the list — the same idiom the per-tool plugins
                   * page uses for its per-Bot grant switches.
                   */}
                  <Switch
                    aria-label={`启用时间为 ${routine.schedule} 的例行任务`}
                    checked={routine.enabled}
                    disabled={
                      setEnabled.isPending &&
                      setEnabled.variables?.id === routine.id
                    }
                    onCheckedChange={(next) =>
                      setEnabled.mutate({ id: routine.id, enabled: next })
                    }
                  />
                  <Button
                    aria-label={`删除时间为 ${routine.schedule} 的例行任务`}
                    onClick={() => {
                      deleteRoutine.reset();
                      setConfirmingId(routine.id);
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <IconTrash />
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </div>
      )}

      {/*
       * One dialog for the whole list rather than one per row, keyed by which routine is being
       * confirmed. It names the schedule, not the id or the instruction, because the schedule is
       * the word a person reads first on the row and the one most likely to tell two routines apart
       * at a glance.
       */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirmingId(null);
        }}
        open={confirming !== null}
      >
        {/* The heavier backdrop, forced: opened from a Bot's dialog this stacks over it, and Base
            UI would otherwise render a nested dialog with no backdrop at all. */}
        <DialogContent overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>删除“{confirming?.schedule}”吗？</DialogTitle>
            <DialogDescription>
              这条固定指令将永久停止。之后不会再按此排期运行，也无法撤销。
            </DialogDescription>
          </DialogHeader>
          {deleteRoutine.error ? (
            <p className="text-destructive text-sm" role="alert">
              {deleteRoutine.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setConfirmingId(null)}
              size="sm"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              disabled={deleteRoutine.isPending}
              onClick={() => {
                if (!confirmingId) return;
                deleteRoutine.mutate(confirmingId, {
                  onSuccess: () => setConfirmingId(null),
                });
              }}
              size="sm"
              variant="destructive"
            >
              {deleteRoutine.isPending ? "删除中…" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSection>
  );
}
