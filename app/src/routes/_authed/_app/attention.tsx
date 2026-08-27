import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconHandStop,
  IconPlugOff,
} from "@tabler/icons-react";
import {
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import type { AttentionItem } from "@/lib/attention/queries";
import { attentionListQueryOptions } from "@/lib/attention/queries";
import { resolveAttentionMutationOptions } from "@/lib/attention/mutations";
import { queryClient } from "@/query-client";

/**
 * What is waiting on a person: boundary refusals and stalled runs, drawn from the trail and gone
 * once somebody marks them handled. The trail itself keeps everything; this page is only what is
 * open now.
 */

export const Route = createFileRoute("/_authed/_app/attention")({
  component: AttentionPage,
});

const KIND_WORDS: Record<AttentionItem["kind"], string> = {
  refused: "操作被拒绝",
  tool_rejected: "工具调用被拒绝",
  stalled: "运行已停滞",
};

function KindIcon({ kind }: { kind: AttentionItem["kind"] }) {
  if (kind === "stalled") return <IconPlugOff />;
  if (kind === "tool_rejected") return <IconHandStop />;
  return <IconAlertTriangle />;
}

function AttentionPage() {
  const items = useQuery(attentionListQueryOptions());
  const resolve = useMutation(resolveAttentionMutationOptions(queryClient));

  return (
    <PageShell
      description={
        <>
          尚未处理的拒绝和停滞运行。这里的每一项都已记录在审计记录中；标记为已处理后，所有人都会看到它已清除，并知道由谁处理。
        </>
      }
      title="待处理"
    >
      <PageSection title="等待你处理">
        {items.isPending ? null : items.error ? (
          <p className="mt-2 text-destructive text-sm" role="alert">
            无法加载待处理列表。
          </p>
        ) : items.data?.length === 0 ? (
          <p className="mt-2 text-muted-foreground text-sm">
            当前没有待处理事项。操作被拒绝或运行停滞时会显示在这里。
          </p>
        ) : (
          <PageRows>
            {items.data?.map((item, index) => (
              <div key={item.id}>
                {index > 0 ? <Separator /> : null}
                <Item size="sm">
                  <ItemMedia variant="icon">
                    <KindIcon kind={item.kind} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {KIND_WORDS[item.kind]} · {item.botId}
                    </ItemTitle>
                    <ItemDescription>
                      {item.sentence}{" "}
                      <span className="whitespace-nowrap">
                        {new Date(item.at).toLocaleString()}
                      </span>
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      render={(props) => (
                        <Link
                          {...props}
                          to="/bot"
                          search={{ agent: item.botId }}
                        />
                      )}
                      size="sm"
                      variant="ghost"
                    >
                      打开智能体
                    </Button>
                    <Button
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate(item.id)}
                      size="sm"
                      variant="outline"
                    >
                      {resolve.isPending ? "正在处理…" : "标记已处理"}
                    </Button>
                  </ItemActions>
                </Item>
              </div>
            ))}
          </PageRows>
        )}
        {resolve.error ? (
          <p className="mt-2 text-destructive text-xs" role="alert">
            {resolve.error.message}
          </p>
        ) : null}
      </PageSection>
    </PageShell>
  );
}
