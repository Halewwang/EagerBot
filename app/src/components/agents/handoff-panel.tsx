import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AbstractAvatar } from "@/components/agents/abstract-avatar";
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
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { setHandoffGrantMutationOptions } from "@/lib/agents/mutations";
import {
  agentHandoffQueryOptions,
  agentListQueryOptions,
} from "@/lib/agents/queries";

/**
 * Which Bots this one may hand work to.
 *
 * On the Bot's own screen rather than in the connector catalogue: a catalogue entry has a fixed list
 * of tools somebody else maintains, and the Bots a deployment has are whatever was made here. It is
 * also the question a person asks while looking at a Bot, not while looking at a vendor.
 *
 * DIRECTIONAL, and said so on the screen, because the pair is the one thing about this that is easy
 * to get backwards: this is who this Bot may ask, not who may ask it.
 *
 * One Item per candidate, with a Switch: the grant is one boolean that takes effect when switched,
 * which is exactly the row kind a Switch means everywhere else in this app.
 */
export function HandoffPanel({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const handoff = useQuery(agentHandoffQueryOptions(agentId));
  const agents = useQuery(agentListQueryOptions());
  const setGrant = useMutation(setHandoffGrantMutationOptions(queryClient));

  if (handoff.isPending || !handoff.data) return null;
  const { enabled, canGrant, reachable, grantable } = handoff.data;

  /*
   * A Bot may not be granted itself, and the server refuses it, so it is not offered here either.
   * Hidden Bots are already absent from this list.
   */
  const others = (agents.data ?? []).filter(
    (candidate) => candidate.id !== agentId,
  );
  const granted = others.filter((candidate) =>
    reachable.includes(candidate.id),
  ).length;
  /*
   * On a Bot that cannot be a grantee only the leftovers are shown: a stale grant may still be
   * revoked — taking away is always allowed — but offering switches that can only bounce off the
   * server's refusal is the thing the explanation item above replaces.
   */
  const candidates = grantable
    ? others
    : others.filter((candidate) => reachable.includes(candidate.id));

  // Nothing to say to somebody who cannot change it and has nothing to read.
  if (!canGrant && reachable.length === 0) return null;

  return (
    <section className="grid gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          可转交工作的智能体
        </h2>
        {/* The current answer at a glance, so the list below is detail rather than homework. */}
        {grantable && others.length > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {granted} / {others.length}
          </span>
        ) : null}
      </header>

      <p className="text-muted-foreground text-sm">
        这里设置当前智能体可以向谁转交工作，而不是谁可以向它转交。被询问智能体的回答会带着来源回到发起转交的对话中。
      </p>

      {enabled ? null : (
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>此部署已关闭智能体间的工作转交</ItemTitle>
            {/*
             * Unclamped: `ItemDescription` clips to two lines, which is right for a roster row
             * whose description is a subtitle and wrong for an item that exists to explain. The
             * sentence that gets cut is the one saying what to do about it.
             */}
            <ItemDescription className="line-clamp-none">
              现有授权会保留，但在重新开启智能体间的工作转交前都不会生效。
            </ItemDescription>
          </ItemContent>
        </Item>
      )}

      {grantable ? null : (
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>该智能体无法继续转交工作</ItemTitle>
            {/* Unclamped for the same reason as above: three lines, and the third is the useful one. */}
            <ItemDescription className="line-clamp-none">
              工作转交工具运行在此部署自身的循环中，而该智能体作为独立服务运行，因此没有可授予它的转交权限。但其他具备转交能力的智能体仍可以向它发起请求。
            </ItemDescription>
          </ItemContent>
        </Item>
      )}

      {setGrant.error ? (
        <p className="text-destructive text-sm" role="alert">
          {setGrant.error.message}
        </p>
      ) : null}

      {grantable && others.length === 0 ? (
        <Empty className="h-[180px] border border-dashed">
          <EmptyHeader>
            <EmptyTitle className="text-muted-foreground">
              这里还没有其他智能体
            </EmptyTitle>
            <EmptyDescription>
              当此部署中有更多智能体后，它们会显示在这里，并可在此设置当前智能体可以向谁转交工作。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {candidates.length > 0 ? (
        <div className="flex flex-col gap-2">
          {candidates.map((candidate) => (
            <Item key={candidate.id} size="sm" variant="muted">
              <ItemMedia>
                <AbstractAvatar
                  name={candidate.name}
                  seed={candidate.avatarSeed}
                  size={28}
                />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{candidate.name}</ItemTitle>
                <ItemDescription>{candidate.title}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch
                  aria-label={`允许当前智能体向 ${candidate.name} 转交工作`}
                  checked={reachable.includes(candidate.id)}
                  disabled={!canGrant || setGrant.isPending}
                  onCheckedChange={(next: boolean) =>
                    setGrant.mutate({
                      agentId,
                      ref: candidate.id,
                      granted: next,
                    })
                  }
                />
              </ItemActions>
            </Item>
          ))}
        </div>
      ) : null}

      {canGrant ? null : (
        <p className="text-muted-foreground text-xs">
          可转交对象由管理员决定。
        </p>
      )}
    </section>
  );
}
