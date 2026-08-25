import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { useBotNames } from "@/lib/agents/bot-names";
import { setComputerStateMutationOptions } from "@/lib/computers/mutations";
import { computerFleetQueryOptions } from "@/lib/computers/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/admin/computers")({
  component: ComputersPage,
});

function ComputersPage() {
  /** Bot id currently running a stop/reset request. */
  const [busy, setBusy] = useState<string | null>(null);
  /** Reset deletes the browser profile, so it requires confirmation. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const nameFor = useBotNames();

  const fleet = useQuery(computerFleetQueryOptions());
  const setState = useMutation(setComputerStateMutationOptions(queryClient));

  const computers = fleet.data?.computers ?? null;
  const isolation = fleet.data?.isolation ?? null;
  /*
   * One line for either failure. A list that could not be read and an action that was refused are
   * both "this did not work", and the page has one place to say so.
   */
  const problem = fleet.error
    ? "无法列出计算机。"
    : setState.error
      ? setState.error.message
      : null;

  const run = (botId: string, action: "stop" | "reset") => {
    setBusy(botId);
    setConfirming(null);
    setState.mutate({ action, botId }, { onSettled: () => setBusy(null) });
  };

  return (
    <PageShell
      description="每个智能体的浏览器及其保留的配置文件。配置文件让智能体明天仍保持登录，重置配置文件会退出所有服务。"
      title="计算机"
    >
      {problem ? (
        <p
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          role="alert"
        >
          {problem}
        </p>
      ) : null}

      {isolation === "shared" ? (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-medium">所有智能体正在共享一台计算机。</span>{" "}
          它们共享登录状态、文件和会话，因此一个 Bot 可以访问另一个 Bot
          登录过的内容。设置
          <code>COMPUTER_SUPERVISOR_URL</code> 可为每个智能体分配独立计算机。
        </p>
      ) : isolation === "per-bot" ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
          每个 Bot 都有独立的计算机，包括独立容器、文件和浏览器配置文件。
        </p>
      ) : null}

      <PageSection title="此部署中的计算机">
        {computers === null && problem ? (
          <PageEmpty>无法加载列表。</PageEmpty>
        ) : computers === null ? null : computers.length === 0 ? (
          <PageEmpty>暂无计算机。智能体首次打开页面时会创建一台。</PageEmpty>
        ) : (
          <PageRows>
            {computers.map((computer, index) => (
              <StaggerItem index={index} key={computer.botId}>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle title={computer.botId}>
                      {nameFor(computer.botId)}
                    </ItemTitle>
                    <ItemDescription>
                      {computer.running
                        ? `浏览器运行于 ${new Date(computer.startedAt ?? "").toLocaleTimeString("zh-CN")}`
                        : "浏览器未运行。智能体下次需要时会启动。"}
                      {" · "}
                      {computer.egress === undefined
                        ? "未报告出口信息"
                        : computer.egress === null
                          ? "直接访问"
                          : `通过 ${computer.egress} 访问`}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      disabled={busy === computer.botId || !computer.running}
                      onClick={() => void run(computer.botId, "stop")}
                      size="sm"
                      variant="outline"
                    >
                      {busy === computer.botId ? "处理中…" : "停止浏览器"}
                    </Button>
                    <Button
                      disabled={busy === computer.botId}
                      onClick={() => setConfirming(computer.botId)}
                      size="sm"
                      variant="outline"
                    >
                      重置
                    </Button>
                  </ItemActions>
                </Item>
                {index !== computers.length - 1 && <Separator />}
              </StaggerItem>
            ))}
          </PageRows>
        )}
      </PageSection>

      {/*
       * A DIALOG RATHER THAN AN INLINE CONFIRM. Resetting signs a Bot out of everything it has ever
       * logged into and cannot be undone, and the row it was confirmed on was one of several
       * identical-looking rows. The dialog names the Bot, so the sentence somebody agrees to says
       * which computer it destroys.
       */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              要重置 {confirming ? nameFor(confirming) : ""} 的计算机吗？
            </DialogTitle>
            <DialogDescription>
              配置文件会被删除，Bot
              将退出曾登录的所有服务并从全新状态开始。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirming(null)}
              size="sm"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              disabled={busy === confirming}
              onClick={() => {
                if (confirming) void run(confirming, "reset");
              }}
              size="sm"
              variant="destructive"
            >
              {busy === confirming ? "重置中…" : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-muted-foreground text-sm">
        <strong>停止</strong> 会关闭浏览器并保留登录状态：智能体
        下次操作时会从上次停留处重新启动。 <strong>重置</strong>{" "}
        会删除配置文件，使 Bot 退出所有服务并从全新状态开始。两者都会记录在{" "}
        <Link className="underline" to="/admin/audit">
          审计
        </Link>
        。
      </p>
    </PageShell>
  );
}
