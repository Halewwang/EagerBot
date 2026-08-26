import {
  IconArrowUpRight,
  IconChevronRight,
  IconExternalLink,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import * as React from "react";
import { useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useBotNames } from "@/lib/agents/bot-names";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { storeMcpToken } from "@/lib/credentials/mutations";
import {
  addCuratedServerMutationOptions,
  connectAccountMutationOptions,
  grantPlugin,
  invalidatePlugins,
  refreshPluginServerMutationOptions,
  registerOAuthClientMutationOptions,
  removePluginServerMutationOptions,
} from "@/lib/plugins/mutations";
import {
  connectionsQueryOptions,
  pluginsPageQueryOptions,
} from "@/lib/plugins/queries";

/**
 * One vendor: what it needs from this deployment, and which Bots hold its tools.
 *
 * Its own page because what a connector needs configured differs by vendor and does not fit on a
 * row. A token for one, an OAuth client and a redirect URI for another, an instance hostname for a
 * third, and then a grant per tool per Bot. The screen this replaced tried to hold all of that in a
 * list and grew a column per Bot, which is how a grant goes unread.
 */
export const Route = createFileRoute("/_authed/admin/plugins/$key")({
  component: RouteComponent,
});

/** Which of the four dialogs is open, or none. */
type OpenDialog = "token" | "client" | "instance" | "grant" | null;

/** The set with one member toggled, as a new set so React sees the change. */
function toggled(
  set: ReadonlySet<string>,
  member: string,
): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(member)) next.add(member);
  return next;
}

/**
 * How widely a tool is granted, in words rather than a fraction.
 *
 * "0/3" needs decoding and reads as a score. The two ends are the ones worth recognising without
 * reading — nothing holds this, or everything does — so they are named, and the middle is the only
 * case that gets a number.
 */
function grantSummary(held: number, total: number): string {
  if (held === 0) return "无智能体";
  if (held === total) return total === 1 ? "1 个智能体" : "所有智能体";
  return `${held}/${total} 个智能体`;
}

function RouteComponent() {
  const { key } = useParams({ from: "/_authed/admin/plugins/$key" });
  const queryClient = useQueryClient();
  const plugins = useQuery(pluginsPageQueryOptions());
  /*
   * The administrator's OWN connections, not the deployment's.
   *
   * On an admin screen that is a deliberate mixture, and it is the useful one: setting a per-person
   * connector up and finding out whether it works are two different questions, and the second has no
   * answer anywhere on this page without it. Nobody else's connection is readable here — the endpoint
   * only ever returns the caller's, so this cannot become a list of who has connected what.
   */
  const connections = useQuery(connectionsQueryOptions());
  const { data: agents } = useQuery(agentListQueryOptions());
  const youConnected = (connections.data?.connections ?? []).some(
    (row) => row.serverId === key,
  );
  const nameFor = useBotNames();

  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [token, setToken] = useState("");
  const [instanceHost, setInstanceHost] = useState("");
  const [client, setClient] = useState({ clientId: "", clientSecret: "" });
  /** Who gets the tools, and which, while the grant dialog is open. */
  const [selectedBots, setSelectedBots] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [selectedRefs, setSelectedRefs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  /**
   * How far through a batch of grants we are, or null when none is running.
   *
   * A count rather than a boolean because a bulk grant is honestly N writes: a Bot times twelve
   * tools is twelve requests, and a button that says only "Granting…" for the length of them gives
   * an administrator no way to tell a slow batch from a stuck one.
   */
  const [granting, setGranting] = useState<{
    done: number;
    total: number;
  } | null>(null);

  /* Every write reports into one banner rather than each growing its own handler. */
  const report = { onError: (thrown: Error) => setError(thrown.message) };
  const addCurated = useMutation({
    ...addCuratedServerMutationOptions(queryClient),
    ...report,
  });
  const registerClient = useMutation({
    ...registerOAuthClientMutationOptions(queryClient),
    ...report,
  });
  const refresh = useMutation({
    ...refreshPluginServerMutationOptions(queryClient),
    ...report,
  });
  const remove = useMutation({
    ...removePluginServerMutationOptions(queryClient),
    ...report,
  });
  const connectSelf = useMutation({
    // Back to this page afterwards, not to the personal settings screen.
    ...connectAccountMutationOptions("admin"),
    ...report,
    /*
     * A full page navigation, not a fetch. The consent screen is the vendor's own and has to be
     * shown to this person in their own browser; there is deliberately nothing here that could
     * complete it for them, and nothing about being an administrator changes that.
     */
    onSuccess: (authorizationUrl) => {
      window.location.href = authorizationUrl;
    },
  });
  const entry = plugins.data?.catalogue.find((item) => item.key === key);
  const server = plugins.data?.servers.find((item) => item.id === key);
  const bots = (agents ?? []).map((agent: { id: string }) => ({
    id: agent.id,
    name: nameFor(agent.id),
  }));

  /**
   * How this vendor is reached, from whichever record we have.
   *
   * A server added by URL has no catalogue entry, and nothing about it is reached as a person, so it
   * falls back to the shared-token shape.
   */
  const auth = entry?.auth ?? "deployment-bearer";
  const title = entry?.title ?? server?.title ?? key;

  /** Adding is two writes when a token was typed: the credential, then the record pointing at it. */
  const add = async () => {
    setError(null);
    try {
      const credentialId =
        auth === "deployment-bearer"
          ? await storeMcpToken(key, token || undefined)
          : undefined;
      await addCurated.mutateAsync({
        key,
        instanceHost: instanceHost || undefined,
        credentialId,
      });
      if (auth === "user-oauth" && client.clientId && client.clientSecret) {
        await registerClient.mutateAsync({ serverId: key, ...client });
      }
      setToken("");
      setClient({ clientId: "", clientSecret: "" });
      setDialog(null);
    } catch (thrown) {
      setError((thrown as Error).message);
    }
  };

  /*
   * One write per grant, in selection order. The server records each grant as its own audit row, so
   * a bulk action here is honestly N decisions; a refusal stops the rest and leaves the dialog open
   * with the banner saying why.
   *
   * One refetch for the batch, at the end. Going through the grant mutation invalidated every plugin
   * query after each write and awaited it, so a batch of twenty grants was twenty round trips
   * interleaved with twenty refetches of a list nobody could see behind the dialog — most of the
   * wait, for nothing anybody read. It is invalidated even when a grant is refused, because the ones
   * before it landed and the screen behind is now stale about them.
   */
  const grantSelected = async () => {
    setError(null);
    const total = selectedBots.size * selectedRefs.size;
    setGranting({ done: 0, total });
    let done = 0;
    try {
      for (const agentId of selectedBots) {
        for (const ref of selectedRefs) {
          await grantPlugin({ agentId, kind: "mcp", ref });
          done += 1;
          setGranting({ done, total });
        }
      }
      setDialog(null);
    } catch (thrown) {
      setError((thrown as Error).message);
    } finally {
      await invalidatePlugins(queryClient);
      setGranting(null);
    }
  };

  /* Nothing rather than a placeholder, so no sentence asserts anything while the fetch is open. */
  if (plugins.isPending) {
    return <PageShell title="插件">{null}</PageShell>;
  }
  if (!(entry || server)) {
    return (
      <PageShell
        backButton={{ label: "插件", linkProps: { to: "/admin/plugins" } }}
        description="此部署没有名为此名称的插件，目录中也没有提供该插件。"
        title="插件不存在"
      >
        <PageEmpty>暂无可配置内容。</PageEmpty>
      </PageShell>
    );
  }

  /* The grant dialog's two halves of the tool list, split by what a boundary would see. */
  const reads = server?.tools.filter((tool) => tool.effect !== "write") ?? [];
  const writes = server?.tools.filter((tool) => tool.effect === "write") ?? [];
  const chosenWrites = writes.filter((tool) =>
    selectedRefs.has(tool.ref),
  ).length;
  const chosenNames = bots
    .filter((bot) => selectedBots.has(bot.id))
    .map((bot) => bot.name);

  return (
    <PageShell
      backButton={{ label: "插件", linkProps: { to: "/admin/plugins" } }}
      description={entry?.summary ?? server?.summary}
      title={title}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {/*
       * No section heading. This is one decision, and a heading over a single row that repeats the
       * row's own title tells a reader nothing they cannot already see.
       */}
      <PageSection>
        <PageRows className="mt-0">
          {/*
           * Binary and immediate, which is what the layout skill reserves a Switch for: it takes
           * effect when switched and there is no save. It replaces an "Add to deployment" button and
           * a destructive "Remove" row that were the same decision drawn twice, in two places, one of
           * them looking far more dangerous than the other.
           *
           * The description states the consequence in the present tense, in both directions, because
           * switching this off deletes every grant on the vendor's tools and that is not recoverable
           * by switching it back on.
           */}
          <Item size="sm">
            <ItemContent>
              <ItemTitle>为此部署启用</ItemTitle>
              <ItemDescription>
                {server
                  ? "可以向智能体授予其工具。关闭后会移除插件及其工具上的所有授权。"
                  : "没有智能体可以访问此服务提供商。打开开关即可配置并授予其工具。"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label={`为此部署启用 ${title}`}
                checked={server !== undefined}
                onCheckedChange={(next) => {
                  setError(null);
                  if (next) void add();
                  else remove.mutate(key);
                }}
              />
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      {server ? (
        <PageSection
          description={
            auth === "user-oauth"
              ? "此服务提供商会以请求者身份响应。部署注册 OAuth 客户端，每个人连接自己的账户，因此智能体只能看到该用户能看到的内容。"
              : "此部署向服务提供商提供的内容。所有人共用一个凭据。"
          }
          title="连接"
        >
          {/*
           * Rows that DO something, and nothing else — with one admitted exception. The layout
           * skill's third row kind — a value with no chevron and nothing to click — earns its
           * place on a screen full of them, but among four actionable rows a dead one reads as a
           * control that has stopped working. The redirect URI is prose under the card instead.
           *
           * The exception is the OAuth client row for a vendor with a dynamic client: there is a
           * real fact to state — this deployment registers itself, nobody configures it — right
           * where the actionable client row would otherwise sit. Leaving that slot empty would
           * read as a missing setup step, not as nothing to do.
           */}
          <PageRows>
            {auth === "deployment-bearer" ? (
              <Item
                render={
                  <button onClick={() => setDialog("token")} type="button" />
                }
                size="sm"
              >
                <ItemContent>
                  <ItemTitle>访问令牌</ItemTitle>
                  <ItemDescription>
                    每次调用此服务提供商时都会作为 Bearer 令牌发送。
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    {server?.hasCredential ? "已保存" : "未设置"}
                  </span>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </ItemActions>
              </Item>
            ) : null}

            {auth === "user-oauth" && server?.dynamicClient ? (
              /*
               * Nothing to click. This deployment registers its own OAuth client with the
               * vendor (RFC 7591) the first time anybody connects, so there is no client id
               * or secret for an administrator to hold, let alone paste.
               */
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>OAuth 客户端</ItemTitle>
                  <ItemDescription>
                    此部署会在首次连接时向服务提供商自动注册 OAuth
                    客户端，无需手动粘贴。
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    自动注册
                  </span>
                </ItemActions>
              </Item>
            ) : null}

            {auth === "user-oauth" && !server?.dynamicClient ? (
              <Item
                render={
                  <button onClick={() => setDialog("client")} type="button" />
                }
                size="sm"
              >
                <ItemContent>
                  <ItemTitle>OAuth 客户端</ItemTitle>
                  <ItemDescription>
                    用于向服务提供商标识此部署。它本身不会访问任何人的文档。
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    {server?.hasCredential ? "已注册" : "未注册"}
                  </span>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </ItemActions>
              </Item>
            ) : null}

            {/*
             * The administrator's own account, on the setup screen.
             *
             * Setting a connector up and knowing whether it works are different questions, and the
             * second used to have no answer here: an administrator finished configuring Drive and
             * had to go to their personal settings to find out whether any of it was right. This row
             * answers it in place, and stays honest about being personal — it is this person's
             * connection, not deployment state, and it reaches their documents and nobody else's.
             *
             * It is NOT part of setup. The connector is fully configured without it, which is why it
             * sits below the client and says so rather than reading as the next required step.
             *
             * Shown once a client exists, because there is nothing to consent against before
             * that: a Connect button with no OAuth client behind it can only fail. A vendor with a
             * dynamic client is the exception — there is no client to register in advance, so
             * Connect is shown right away and is itself what creates one.
             */}
            {auth === "user-oauth" &&
            (server?.hasCredential || server?.dynamicClient) ? (
              <>
                <Separator />
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle>你的账户</ItemTitle>
                    <ItemDescription>
                      {youConnected
                        ? `已连接，因此获得这些工具授权的智能体会以你的 ${title} 账户身份访问内容。其他用户需要连接自己的账户。`
                        : "连接你的账户以试用此连接器。不连接也不影响配置完成，连接后只会访问你的文档。"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {youConnected ? (
                      <>
                        {/* Decorative: the word beside it already says which. */}
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-emerald-500"
                        />
                        <span className="text-muted-foreground text-xs">
                          已连接
                        </span>
                      </>
                    ) : (
                      /* The arrow says this leaves OpenBot for the vendor's consent page. It does. */
                      <Button
                        disabled={connectSelf.isPending}
                        onClick={() => {
                          setError(null);
                          connectSelf.mutate(key);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        连接
                        <IconArrowUpRight />
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              </>
            ) : null}

            {entry?.perInstance ? (
              <>
                <Separator />
                <Item
                  render={
                    <button
                      onClick={() => setDialog("instance")}
                      type="button"
                    />
                  }
                  size="sm"
                >
                  <ItemContent>
                    <ItemTitle>实例主机</ItemTitle>
                    <ItemDescription>
                      此服务提供商为每位客户提供独立主机名，保存前会根据其格式进行检查。
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-muted-foreground text-xs">
                      {server?.url ?? "未设置"}
                    </span>
                    <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </ItemActions>
                </Item>
              </>
            ) : null}

            {entry?.docsUrl ? (
              <>
                <Separator />
                <Item
                  render={
                    <a href={entry.docsUrl} rel="noreferrer" target="_blank" />
                  }
                  size="sm"
                >
                  <ItemContent>
                    <ItemTitle>服务提供商文档</ItemTitle>
                    <ItemDescription>
                      由维护此服务器的团队提供的能力说明。
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <IconExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  </ItemActions>
                </Item>
              </>
            ) : null}
          </PageRows>

          {auth === "user-oauth" ? (
            <div className="mt-3 p-3">
              {server?.dynamicClient ? (
                <p className="text-muted-foreground text-sm">
                  此部署会自动注册 redirect URI，无需在服务提供商处添加。
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  请将此内容原样添加到服务提供商处客户端的授权 redirect URI
                  中。即使一个字符错误也会导致失败，且错误信息不会提及 EMKE
                  Bot。
                </p>
              )}
              {!plugins.data?.redirectUri ? (
                <p className="mt-3 text-destructive text-sm" role="alert">
                  此部署没有公开 URL，因此无法完成授权流程。请设置
                  OPENBOT_PUBLIC_URL。
                </p>
              ) : server?.dynamicClient ? null : (
                /* Selectable and monospaced: it is copied by hand into somebody else's console. */
                <code className="mt-3 block select-all break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                  {plugins.data.redirectUri}
                </code>
              )}
            </div>
          ) : null}
        </PageSection>
      ) : null}

      {server ? (
        <PageSection
          /*
           * Beside the heading rather than on the page's own baseline. Refreshing is about this list
           * and nothing else on the screen — it asks the vendor what it offers now — so it belongs
           * where the list is named. Ghost, because it is a maintenance action rather than the thing
           * an administrator came here to do.
           */
          action={
            <div className="flex gap-1.5">
              <Button
                onClick={() => refresh.mutate(key)}
                size="sm"
                type="button"
                variant="ghost"
              >
                刷新工具
              </Button>
              {/*
               * Outline where refresh is ghost: granting is the thing an administrator came to
               * this section to do. Hidden rather than disabled with nothing to grant — a dialog
               * over an empty list could only explain its own emptiness.
               */}
              {server.tools.length > 0 && bots.length > 0 ? (
                <Button
                  onClick={() => {
                    setSelectedBots(new Set());
                    setSelectedRefs(new Set());
                    setDialog("grant");
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  授予工具…
                </Button>
              ) : null}
            </div>
          }
          description="只有持有工具时，智能体才会获知它。每次调用发生时都会重新决定，因此移除授权会在下一次调用时生效。"
          title="工具"
        >
          {server.tools.length === 0 ? (
            <PageEmpty>
              {server.lastError ?? "暂无工具列表。刷新以再次向服务提供商请求。"}
            </PageEmpty>
          ) : (
            <PageRows>
              {server.tools.map((tool, index) => (
                <React.Fragment key={tool.ref}>
                  {/* A real link with no children: children passed to `render` replace the row's own. */}
                  <Item
                    render={
                      <Link
                        params={{ key, tool: tool.name }}
                        to="/admin/plugins/$key/tools/$tool"
                      />
                    }
                    size="sm"
                  >
                    <ItemContent>
                      <ItemTitle className="font-mono text-xs">
                        {tool.name}
                      </ItemTitle>
                      <ItemDescription>{tool.description}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {/*
                       * How many Bots hold it, not which. The names were here as a chip each and
                       * turned every row into a wrapping cluster of controls — twenty-four of them
                       * across this list — with the tool's own name losing the fight for attention.
                       * A count is what a reader scanning for "what is exposed, and how widely" is
                       * actually asking, and the names are one click away where they can be switched
                       * one at a time.
                       */}
                      <span className="text-muted-foreground text-xs">
                        {grantSummary(tool.grantedTo.length, bots.length)}
                      </span>
                      {/*
                       * The effect, not a description. It is what a boundary written about writes
                       * evaluates, and an operator writing that rule has no other way to know.
                       */}
                      <span
                        className={
                          tool.effect === "write"
                            ? "text-amber-600 text-xs dark:text-amber-500"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {tool.effect === "write" ? "修改内容" : "读取内容"}
                      </span>
                      <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </ItemActions>
                  </Item>
                  {index !== server.tools.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </PageRows>
          )}
        </PageSection>
      ) : null}

      {/*
       * Only when there is something to say. An empty section here would teach a reader to scroll past
       * a heading that is usually blank, which is the opposite of the point.
       *
       * Its own section rather than rows inside Tools, because these are not tools: they are not
       * listed by the vendor, there is no page to open for one, and putting them in the same list
       * would make the count above it wrong.
       */}
      {server && server.withdrawn.length > 0 ? (
        <PageSection
          description="此服务提供商不再列出这些工具，因此智能体不会获知它们，模型也无法调用。授权仍会记录；如果服务提供商重新列出工具，系统会再次提供。若不希望如此，请在智能体自己的页面撤销授权。"
          title="已持有但未提供"
        >
          <PageRows>
            {server.withdrawn.map((held, index) => (
              <React.Fragment key={held.ref}>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle className="font-mono text-xs">
                      {held.name}
                    </ItemTitle>
                    <ItemDescription>
                      {title} 未列出
                      {server.toolsRefreshedAt ? "（截至上次刷新）" : ""}。
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-muted-foreground text-xs">
                      {grantSummary(held.grantedTo.length, bots.length)}
                    </span>
                  </ItemActions>
                </Item>
                {index !== server.withdrawn.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </PageRows>
        </PageSection>
      ) : null}

      <Dialog
        onOpenChange={(open) => setDialog(open ? dialog : null)}
        open={dialog !== null && dialog !== "grant"}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "client"
                ? `${title} 的 OAuth 客户端`
                : dialog === "instance"
                  ? `${title} 的实例主机`
                  : `${title} 的访问令牌`}
            </DialogTitle>
            <DialogDescription>
              {dialog === "client"
                ? "来自服务提供商控制台。密钥会存储在此部署的保险库中，且不会被读回。"
                : dialog === "instance"
                  ? "你在此服务提供商处使用的主机名。保存前会根据其格式进行检查。"
                  : "存储在此部署的保险库中，且不会被读回。"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            <FieldGroup>
              {dialog === "client" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="client-id">客户端 ID</FieldLabel>
                    <Input
                      id="client-id"
                      onChange={(event) =>
                        setClient((c) => ({
                          ...c,
                          clientId: event.target.value,
                        }))
                      }
                      value={client.clientId}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="client-secret">客户端密钥</FieldLabel>
                    <Input
                      id="client-secret"
                      onChange={(event) =>
                        setClient((c) => ({
                          ...c,
                          clientSecret: event.target.value,
                        }))
                      }
                      type="password"
                      value={client.clientSecret}
                    />
                  </Field>
                </>
              ) : dialog === "instance" ? (
                <Field>
                  <FieldLabel htmlFor="instance-host">实例主机</FieldLabel>
                  <Input
                    id="instance-host"
                    onChange={(event) => setInstanceHost(event.target.value)}
                    placeholder="https://your-instance.service-now.com"
                    value={instanceHost}
                  />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="access-token">访问令牌</FieldLabel>
                  <Input
                    id="access-token"
                    onChange={(event) => setToken(event.target.value)}
                    type="password"
                    value={token}
                  />
                </Field>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button onClick={() => setDialog(null)} size="sm" variant="ghost">
              取消
            </Button>
            <Button
              onClick={() => {
                if (!server) {
                  void add();
                  return;
                }
                if (dialog === "client") {
                  registerClient.mutate({ serverId: key, ...client });
                }
                setDialog(null);
              }}
              size="sm"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
       * Who first, then what: the decision arrives as "set this Bot up", not as a list of tools
       * looking for an owner. Both groups get a select-all; the amber heading and the footer's
       * "N of which change things" are what keep a bulk write grant a read decision, not a blind one.
       */}
      {server ? (
        <Dialog
          onOpenChange={(open) => setDialog(open ? dialog : null)}
          open={dialog === "grant"}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>授予工具</DialogTitle>
              <DialogDescription>
                每项授权都会作为独立记录写入审计轨迹；已授予的写入工具仍会在每次调用时接受边界检查。
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="mt-4 space-y-5">
              {/*
               * Each set of tickboxes is a group named by its own heading, so a screen reader
               * reaching a bare tool name is told which list it is in. "Changes things" is the whole
               * warning on those, and it is a heading a sighted reader cannot miss and a listener
               * would otherwise never hear.
               *
               * A `fieldset` because that is what a group of tickboxes is, named by the heading
               * already on screen rather than by a `legend` duplicating it. `min-w-0` undoes the
               * one thing a fieldset brings that a div did not: a min-content floor that a long
               * tool name would push the dialog out to.
               */}
              <fieldset aria-labelledby="grant-to-heading" className="min-w-0">
                <p className="mb-2 font-medium text-sm" id="grant-to-heading">
                  授予对象
                </p>
                <div className="space-y-2">
                  {bots.map((bot) => (
                    <div className="flex items-center gap-2" key={bot.id}>
                      <Checkbox
                        checked={selectedBots.has(bot.id)}
                        id={`grant-bot-${bot.id}`}
                        onCheckedChange={() =>
                          setSelectedBots((previous) =>
                            toggled(previous, bot.id),
                          )
                        }
                      />
                      <label
                        className="text-sm"
                        htmlFor={`grant-bot-${bot.id}`}
                      >
                        {bot.name}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className="max-h-64 space-y-5 overflow-y-auto">
                {reads.length > 0 ? (
                  <fieldset
                    aria-labelledby="grant-reads-heading"
                    className="min-w-0"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p
                        className="font-medium text-sm"
                        id="grant-reads-heading"
                      >
                        读取内容
                      </p>
                      <Button
                        onClick={() =>
                          setSelectedRefs((previous) => {
                            const next = new Set(previous);
                            for (const tool of reads) next.add(tool.ref);
                            return next;
                          })
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        全选
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {reads.map((tool) => (
                        <div className="flex items-center gap-2" key={tool.ref}>
                          <Checkbox
                            checked={selectedRefs.has(tool.ref)}
                            id={`grant-tool-${tool.ref}`}
                            onCheckedChange={() =>
                              setSelectedRefs((previous) =>
                                toggled(previous, tool.ref),
                              )
                            }
                          />
                          <label
                            className="font-mono text-xs"
                            htmlFor={`grant-tool-${tool.ref}`}
                          >
                            {tool.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {writes.length > 0 ? (
                  <fieldset
                    aria-labelledby="grant-writes-heading"
                    className="min-w-0"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p
                        className="font-medium text-amber-600 text-sm dark:text-amber-500"
                        id="grant-writes-heading"
                      >
                        修改内容
                      </p>
                      <Button
                        onClick={() =>
                          setSelectedRefs((previous) => {
                            const next = new Set(previous);
                            for (const tool of writes) next.add(tool.ref);
                            return next;
                          })
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        全选
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {writes.map((tool) => (
                        <div className="flex items-center gap-2" key={tool.ref}>
                          <Checkbox
                            checked={selectedRefs.has(tool.ref)}
                            id={`grant-tool-${tool.ref}`}
                            onCheckedChange={() =>
                              setSelectedRefs((previous) =>
                                toggled(previous, tool.ref),
                              )
                            }
                          />
                          <label
                            className="font-mono text-xs"
                            htmlFor={`grant-tool-${tool.ref}`}
                          >
                            {tool.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </div>
            </DialogBody>
            <DialogFooter className="mt-4 items-center">
              {/* What is about to happen, in one sentence, before it does. */}
              {selectedRefs.size > 0 && chosenNames.length > 0 ? (
                <p className="flex-1 text-muted-foreground text-xs">
                  {`将 ${selectedRefs.size} 项工具授予 ${chosenNames.join("、")}${
                    chosenWrites > 0
                      ? `，其中 ${chosenWrites} 项会修改内容`
                      : ""
                  }。`}
                </p>
              ) : null}
              <Button onClick={() => setDialog(null)} size="sm" variant="ghost">
                取消
              </Button>
              <Button
                disabled={
                  granting !== null ||
                  selectedBots.size === 0 ||
                  selectedRefs.size === 0
                }
                onClick={() => void grantSelected()}
                size="sm"
              >
                {/* The one in flight, not the ones finished: a count that starts at zero of twelve reads as nothing happening. */}
                {granting
                  ? `正在授予 ${Math.min(granting.done + 1, granting.total)}/${granting.total}…`
                  : "授予"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </PageShell>
  );
}
