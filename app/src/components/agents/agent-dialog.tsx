import {
  IconAdjustments,
  IconArrowsExchange,
  IconClock,
  IconPencil,
  IconPlugConnected,
  IconPuzzle,
  IconUser,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ZodType } from "zod";
import { AbstractAvatar } from "@/components/agents/abstract-avatar";
import { CallbackTokenPanel } from "@/components/agents/callback-token-panel";
import { HandoffPanel } from "@/components/agents/handoff-panel";
import { RoutinesList } from "@/components/routines/routines-list";
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
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  type AgentFormValues,
  agentFormSchema,
  agentInputFrom,
} from "@/lib/agents/form";
import {
  deleteAgentMutationOptions,
  duplicateAgentMutationOptions,
  setAgentHiddenMutationOptions,
  updateAgentMutationOptions,
} from "@/lib/agents/mutations";
import { type AgentProfile, agentQueryOptions } from "@/lib/agents/queries";
import { agentPluginsQueryOptions } from "@/lib/plugins/queries";
import { readToolName } from "@/lib/plugins/tool-name";

/**
 * A coworker, in a dialog with its own sidebar.
 *
 * The agents screen used to slide this in as a side panel; a profile carries enough distinct
 * concerns — who it is, where it runs, what it may hand work to, and what can be done to it — that
 * a single scrolling column buried the later ones. Each concern is a section here, and the sidebar
 * is the map.
 */
export function AgentDialog({
  agentId,
  open,
  onClose,
}: {
  /** Which coworker to show. Null renders nothing but keeps the dialog mounted for its exit. */
  agentId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      {/* p-0/overflow-hidden hands the popup's rounding to the sidebar; wider than the default
          dialog because it holds a two-pane layout, which is the stated reason to deviate. */}
      {/* Tall enough that General's rows and its Delete sit on screen together; the popup's own
          max-h-[85svh] still caps it on a short display, where the main pane scrolls. */}
      <DialogContent className="overflow-hidden p-0 md:max-h-[680px] md:max-w-[700px] lg:max-w-[800px]">
        {/* Keyed by coworker so the section and edit state never carry over from another one. */}
        {agentId ? <AgentDialogBody agentId={agentId} key={agentId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

const SECTIONS = [
  { id: "general", name: "常规", icon: IconUser },
  { id: "access", name: "权限", icon: IconPuzzle },
  { id: "connection", name: "连接", icon: IconPlugConnected },
  { id: "handoff", name: "工作转交", icon: IconArrowsExchange },
  { id: "routines", name: "例行任务", icon: IconClock },
  { id: "manage", name: "管理", icon: IconAdjustments },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function AgentDialogBody({ agentId }: { agentId: string }) {
  const [section, setSection] = useState<SectionId>("general");
  const agent = useQuery(agentQueryOptions(agentId));

  if (agent.isPending) {
    return (
      <div className="flex h-[640px] max-h-[80svh] flex-col gap-4 p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (agent.error || !agent.data) {
    return (
      <p className="p-6 text-sm text-destructive" role="alert">
        无法加载该智能体。
      </p>
    );
  }
  const profile = agent.data;
  const active = SECTIONS.find((candidate) => candidate.id === section);

  return (
    <>
      <DialogTitle className="sr-only">{profile.name}</DialogTitle>
      {/* min-h-full overrides the provider's own min-h-svh, which is sized for a page. */}
      <SidebarProvider className="min-h-full items-start">
        <Sidebar className="hidden md:flex" collapsible="none">
          {/* Who this dialog is about, said once here rather than repeated per section. */}
          <SidebarHeader className="flex-row items-center gap-3 p-4">
            <AbstractAvatar
              name={profile.name}
              seed={profile.avatarSeed}
              size={36}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {profile.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {profile.title}
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent className="mt-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {SECTIONS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={item.id === section}
                        onClick={() => setSection(item.id)}
                      >
                        <item.icon />
                        <span>{item.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex h-[640px] max-h-[80svh] flex-1 flex-col overflow-hidden">
          {/*
           * The sidebar hides below md, and without this strip that left the sections unreachable
           * on a phone: the dialog opened on General and nothing could leave it. A scrollable row
           * of the same sections, shown only where the sidebar is not. The identity the sidebar
           * header carries rides along, with room kept for the popup's close button.
           */}
          <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3 pr-12 md:hidden">
            <div className="flex items-center gap-2">
              <AbstractAvatar
                name={profile.name}
                seed={profile.avatarSeed}
                size={28}
              />
              <span className="truncate text-sm font-medium">
                {profile.name}
              </span>
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {SECTIONS.map((item) => (
                <Button
                  className="shrink-0"
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  size="sm"
                  variant={item.id === section ? "secondary" : "ghost"}
                >
                  <item.icon />
                  {item.name}
                </Button>
              ))}
            </div>
          </div>
          <header className="flex h-14 shrink-0 items-center gap-2 px-6">
            <h2 className="text-sm font-medium">{active?.name}</h2>
          </header>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
            {section === "general" ? (
              <GeneralSection agentId={agentId} profile={profile} />
            ) : section === "access" ? (
              <AccessSection agentId={agentId} />
            ) : section === "connection" ? (
              <ConnectionSection agentId={agentId} profile={profile} />
            ) : section === "handoff" ? (
              <HandoffPanel agentId={agentId} />
            ) : section === "routines" ? (
              <RoutinesList agentId={agentId} embedded />
            ) : (
              <ManageSection agentId={agentId} profile={profile} />
            )}
          </div>
        </main>
      </SidebarProvider>
    </>
  );
}

function GeneralSection({
  agentId,
  profile,
}: {
  agentId: string;
  profile: AgentProfile;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const updateAgent = useMutation(updateAgentMutationOptions(queryClient));

  /*
   * One field at a time, over the whole update endpoint: the API takes the full profile, so the
   * unchanged fields ride along as they are on screen. The empty key means "keep the current one".
   */
  const save = (patch: Partial<AgentFormValues>) =>
    updateAgent.mutateAsync({
      agentId,
      input: agentInputFrom({
        name: profile.name,
        title: profile.title,
        roleDescription: profile.roleDescription,
        visibility: profile.visibility,
        endpoint: profile.endpoint ?? "",
        authValue: "",
        ...patch,
      }),
    });

  return (
    <>
      {/* Each stands on its own — muted, not bg-card, which is invisible against a popup — and
          each edits in place: the field somebody wants to change is the only one that opens. */}
      <div className="flex flex-col gap-2">
        <EditableTextItem
          canManage={profile.canManage}
          label="名称"
          onSave={(name) => save({ name })}
          schema={agentFormSchema.shape.name}
          value={profile.name}
        />
        <EditableTextItem
          canManage={profile.canManage}
          label="标题"
          onSave={(title) => save({ title })}
          schema={agentFormSchema.shape.title}
          value={profile.title}
        />
        <EditableTextItem
          canManage={profile.canManage}
          label="角色"
          multiline
          onSave={(roleDescription) => save({ roleDescription })}
          schema={agentFormSchema.shape.roleDescription}
          value={profile.roleDescription}
        />
        <VisibilityItem
          canManage={profile.canManage}
          onSave={(visibility) => save({ visibility })}
          value={profile.visibility}
        />
        {profile.systemOwned ? (
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>系统智能体</ItemTitle>
              <ItemDescription>随此部署提供，不属于任何个人。</ItemDescription>
            </ItemContent>
          </Item>
        ) : null}
      </div>

      <Item variant="muted">
        <ItemContent>
          <ItemTitle>开始频道</ItemTitle>
          <ItemDescription>与该智能体开启新频道。</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            onClick={() =>
              void navigate({
                search: { agent: agentId },
                to: "/channel/new",
              })
            }
            size="sm"
          >
            开始
          </Button>
        </ItemActions>
      </Item>
    </>
  );
}

/**
 * One fact about the coworker, edited in place.
 *
 * Only the field somebody wants to change opens: Edit swaps this item — and this item alone — for
 * its input, validated against the same limits the server enforces, and Save writes just it back.
 */
function EditableTextItem({
  label,
  value,
  canManage,
  multiline = false,
  schema,
  onSave,
}: {
  label: string;
  value: string;
  canManage: boolean;
  /** A textarea rather than an input, for the field that is a paragraph. */
  multiline?: boolean;
  /** The field's slice of the shared form contract, so errors match the server's limits. */
  schema: ZodType<string>;
  onSave: (draft: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setEditing(false);
    setError(null);
  };
  const submit = async () => {
    const parsed = schema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "该值不符合要求。");
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data);
      close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "无法保存。");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Item variant="muted">
        <ItemContent>
          <ItemTitle>{label}</ItemTitle>
        </ItemContent>
        <ItemActions className="min-w-0">
          <span
            className={`text-right text-sm text-muted-foreground ${
              multiline ? "line-clamp-2 whitespace-pre-wrap" : "truncate"
            }`}
          >
            {value}
          </span>
          {canManage ? (
            <Button
              aria-label={`编辑${label}`}
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
              size="icon-sm"
              variant="ghost"
            >
              <IconPencil />
            </Button>
          ) : null}
        </ItemActions>
      </Item>
    );
  }

  return (
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>{label}</ItemTitle>
        {multiline ? (
          <Textarea
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            value={draft}
          />
        ) : (
          <Input
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            value={draft}
          />
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-1 flex gap-2">
          <Button disabled={saving} onClick={() => void submit()} size="sm">
            {saving ? "保存中…" : "保存"}
          </Button>
          <Button disabled={saving} onClick={close} size="sm" variant="outline">
            取消
          </Button>
        </div>
      </ItemContent>
    </Item>
  );
}

/**
 * Visibility is two named choices, so it edits as a select that writes on pick — no open state and
 * no Save, because there is no draft worth holding: the pick is the whole of the change.
 */
function VisibilityItem({
  value,
  canManage,
  onSave,
}: {
  value: AgentProfile["visibility"];
  canManage: boolean;
  onSave: (visibility: AgentProfile["visibility"]) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>可见性</ItemTitle>
        <ItemDescription>
          {value === "private"
            ? "只有你可以查看它并与它开启频道。"
            : "此部署中的所有人都可以找到并使用它。"}
        </ItemDescription>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </ItemContent>
      <ItemActions>
        {canManage ? (
          <Select
            disabled={saving}
            // The label map, so the closed trigger says "Private" rather than the raw value.
            items={{ private: "私有", public: "公开" }}
            onValueChange={async (next) => {
              if (next === value) return;
              setError(null);
              setSaving(true);
              try {
                await onSave(next as AgentProfile["visibility"]);
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : "无法保存。",
                );
              } finally {
                setSaving(false);
              }
            }}
            value={value}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">私有</SelectItem>
              <SelectItem value="public">公开</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">
            {value === "private" ? "私有" : "公开"}
          </span>
        )}
      </ItemActions>
    </Item>
  );
}

/** "google-drive" as "Google Drive": the connector key, said the way a person would. */
function connectorName(key: string): string {
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * What this coworker may reach when it works: its granted connectors, one row each, and its skills.
 *
 * Read from the same snapshot the runtime offers the Bot, so this shows what a run would actually
 * hold rather than a second opinion. Read-only on purpose — granting is an administrator's, made on
 * the Plugins screens, and a row of switches here would be a second place for the same decision.
 */
function AccessSection({ agentId }: { agentId: string }) {
  const plugins = useQuery(agentPluginsQueryOptions(agentId));

  if (plugins.isPending) return null;
  if (plugins.error || !plugins.data) {
    return (
      <p className="text-sm text-destructive" role="alert">
        无法加载该智能体可访问的内容。
      </p>
    );
  }

  /* One row per connector, carrying what a person recognises: the tools' names, not their count. */
  const connectors = new Map<string, string[]>();
  for (const tool of plugins.data.tools) {
    const key = tool.ref.split("/")[0] ?? tool.ref;
    let label = readToolName(tool.toolName).label;
    /*
     * Vendors prefix every tool with their own name — "Notion create pages" — which next to a row
     * already titled Notion reads as a stutter. Stripped only as a leading word, and re-cased, so
     * "Notion search" becomes "Search" while "Search notion pages" is left alone.
     */
    const prefix = `${key.toLowerCase()} `;
    if (label.toLowerCase().startsWith(prefix)) {
      const rest = label.slice(prefix.length);
      label = rest ? rest[0]?.toUpperCase() + rest.slice(1) : label;
    }
    const labels = connectors.get(key) ?? [];
    labels.push(label);
    connectors.set(key, labels);
  }
  const skills = plugins.data.skills;

  if (connectors.size === 0 && skills.length === 0) {
    return (
      <Empty className="h-[180px] border border-dashed">
        <EmptyHeader>
          <EmptyTitle className="text-muted-foreground">
            尚未授予任何权限
          </EmptyTitle>
          <EmptyDescription>
            管理员可以在插件页面授予连接器和技能。在此之前，该智能体只能进行对话，无法执行其他操作。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        这是该智能体工作时可以访问的内容，由管理员在插件页面授予；未列出的内容在调用时会被拒绝。
      </p>
      <div className="flex flex-col gap-2">
        {[...connectors.entries()].map(([key, labels]) => (
          <Item key={key} variant="muted">
            <ItemContent>
              <ItemTitle>{connectorName(key)}</ItemTitle>
              <ItemDescription>
                {labels.slice(0, 4).join(", ")}
                {labels.length > 4 ? `，以及另外 ${labels.length - 4} 个` : ""}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="text-sm text-muted-foreground tabular-nums">
                {labels.length} 个工具
              </span>
            </ItemActions>
          </Item>
        ))}
        {skills.map((skill) => (
          <Item key={skill.slug} variant="muted">
            <ItemContent>
              <ItemTitle>{skill.title}</ItemTitle>
              <ItemDescription>{skill.summary}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="text-sm text-muted-foreground">技能</span>
            </ItemActions>
          </Item>
        ))}
      </div>
    </>
  );
}

function ConnectionSection({
  agentId,
  profile,
}: {
  agentId: string;
  profile: AgentProfile;
}) {
  /*
   * A built-in coworker is done the moment it exists: it runs on the deployment's own Bot, whose
   * process already holds the deployment's tool credential, so its tool calls authenticate with no
   * setup. Showing it the endpoint and the callback-token panel told the person the opposite —
   * an internal address they never typed, and a credential they were never supposed to need.
   */
  if (!profile.endpoint || profile.builtIn) {
    return (
      <p className="text-sm text-muted-foreground">
        运行在此部署自身的智能体上。无需连接或验证身份：工具调用由部署自身的凭据负责。
      </p>
    );
  }
  return (
    <>
      <section className="grid gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          端点
        </h2>
        <p className="break-all font-mono text-sm">{profile.endpoint}</p>
      </section>
      {profile.canManage ? (
        <CallbackTokenPanel
          agentId={agentId}
          hasToken={profile.hasCallbackToken}
        />
      ) : null}
    </>
  );
}

function ManageSection({
  agentId,
  profile,
}: {
  agentId: string;
  profile: AgentProfile;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const setHidden = useMutation(setAgentHiddenMutationOptions(queryClient));
  const duplicateAgent = useMutation(
    duplicateAgentMutationOptions(queryClient),
  );
  const deleteAgent = useMutation(deleteAgentMutationOptions(queryClient));
  const actionError = setHidden.error ?? duplicateAgent.error;

  return (
    <>
      {/* The same gap the General items keep, so the two screens read as one list style. */}
      <div className="flex flex-col gap-2">
        <Item variant="muted">
          <ItemContent>
            <ItemTitle>{profile.hidden ? "已隐藏" : "隐藏"}</ItemTitle>
            <ItemDescription>
              {profile.hidden
                ? "已从你的智能体列表中隐藏。此操作不会影响其他人。"
                : "从你的智能体列表中移除。此操作不会影响其他人。"}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              disabled={setHidden.isPending}
              onClick={async () => {
                await setHidden.mutateAsync({
                  agentId,
                  hidden: !profile.hidden,
                });
                if (!profile.hidden)
                  await navigate({ search: {}, to: "/agents" });
              }}
              size="sm"
              variant="outline"
            >
              {setHidden.isPending
                ? profile.hidden
                  ? "取消隐藏中…"
                  : "隐藏中…"
                : profile.hidden
                  ? "取消隐藏"
                  : "隐藏"}
            </Button>
          </ItemActions>
        </Item>

        <Item variant="muted">
          <ItemContent>
            <ItemTitle>复制</ItemTitle>
            <ItemDescription>创建一个副本，不包含密钥和频道。</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              disabled={duplicateAgent.isPending}
              onClick={async () => {
                const copy = await duplicateAgent.mutateAsync(agentId);
                await navigate({ search: { agent: copy.id }, to: "/agents" });
              }}
              size="sm"
              variant="outline"
            >
              {duplicateAgent.isPending ? "复制中…" : "复制"}
            </Button>
          </ItemActions>
        </Item>

        {profile.canManage ? (
          <Item variant="muted">
            <ItemContent>
              <ItemTitle>删除</ItemTitle>
              <ItemDescription>此操作无法撤销。</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                onClick={() => setConfirmingDelete(true)}
                size="sm"
                variant="destructive"
              >
                删除
              </Button>
            </ItemActions>
          </Item>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError.message}
        </p>
      ) : null}

      {/* Stacked over the agent dialog: destroying something deserves its own moment, and the
          question keeps the name in it so the wrong tab cannot delete the wrong coworker. */}
      <Dialog
        onOpenChange={(next) => !next && setConfirmingDelete(false)}
        open={confirmingDelete}
      >
        <DialogContent
          className="max-w-sm"
          overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-sm"
        >
          <DialogHeader>
            <DialogTitle>要删除 {profile.name} 吗？</DialogTitle>
            <DialogDescription>此操作无法撤销。</DialogDescription>
          </DialogHeader>
          {deleteAgent.error ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {deleteAgent.error.message}
            </p>
          ) : null}
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setConfirmingDelete(false)}
              size="sm"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={deleteAgent.isPending}
              onClick={async () => {
                await deleteAgent.mutateAsync(agentId);
                await navigate({ search: {}, to: "/agents" });
              }}
              size="sm"
              variant="destructive"
            >
              {deleteAgent.isPending ? "删除中…" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
