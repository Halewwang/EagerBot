import { OpenGenerativeUIActivityRenderer } from "@copilotkit/react-core/v2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteSandboxedMutationOptions,
  publishSandboxedMutationOptions,
  type SandboxedDraftInput,
  saveSandboxedDraftMutationOptions,
} from "@/lib/sandboxed/mutations";
import {
  type SandboxedRecord,
  sandboxedListQueryOptions,
} from "@/lib/sandboxed/queries";

/**
 * Browser-authored components are edited as drafts, previewed in the production sandbox renderer,
 * and used by conversations only after publishing.
 */
export const Route = createFileRoute("/_authed/admin/playground")({
  component: PlaygroundPage,
});

const STARTER = {
  slug: "",
  title: "",
  description: "",
  html: `<div class="card">\n  <h3 id="title">未命名</h3>\n  <p id="body"></p>\n</div>`,
  css: `.card { font: 14px system-ui; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; }\n.card h3 { margin: 0 0 4px; font-size: 15px; }`,
  jsFunctions: `// 运行到这里时，参数已位于 window.__args。\nconst args = window.__args || {};\ndocument.getElementById("title").textContent = args.title || "未命名";\ndocument.getElementById("body").textContent = args.body || "";`,
  argumentSchema: `{\n  "type": "object",\n  "properties": {\n    "title": { "type": "string" },\n    "body": { "type": "string" }\n  }\n}`,
  sampleArguments: `{\n  "title": "示例",\n  "body": "编辑左侧面板，这里会重新绘制。"\n}`,
};

type Draft = typeof STARTER;

function PlaygroundPage() {
  const [deleting, setDeleting] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: components } = useQuery(sandboxedListQueryOptions());
  const [draft, setDraft] = useState<Draft>(STARTER);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const parsed = (raw: string): Record<string, unknown> | null => {
    try {
      const value = JSON.parse(raw);
      return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const sample = parsed(draft.sampleArguments);
  const schema = parsed(draft.argumentSchema);

  /* Every write here reports into the same banner, so they share one failure handler. */
  const report = { onError: (thrown: Error) => setError(thrown.message) };
  const saveDraft = useMutation({
    ...saveSandboxedDraftMutationOptions(queryClient),
    ...report,
  });
  const publishDraft = useMutation({
    ...publishSandboxedMutationOptions(queryClient),
    ...report,
  });
  const removeComponent = useMutation({
    ...deleteSandboxedMutationOptions(queryClient),
    ...report,
  });
  /** What the editors currently describe, in the shape the server accepts. */
  const input = (): SandboxedDraftInput => ({
    slug: draft.slug,
    title: draft.title,
    description: draft.description,
    html: draft.html,
    css: draft.css,
    jsFunctions: draft.jsFunctions,
    argumentSchema: schema ?? {},
    sampleArguments: sample ?? {},
  });

  const save = () => {
    setError(null);
    saveDraft.mutate(input());
  };

  const publish = () => {
    setError(null);
    publishDraft.mutate(input());
  };

  const load = (component: SandboxedRecord) =>
    setDraft({
      slug: component.name.replace(/^custom_/, ""),
      title: component.title,
      description: component.draftDescription,
      html: component.draftHtml,
      css: component.draftCss,
      jsFunctions: component.draftJsFunctions,
      argumentSchema: JSON.stringify(component.draftArgumentSchema, null, 2),
      sampleArguments: JSON.stringify(component.sampleArguments, null, 2),
    });

  return (
    /*
     * THE ONE PAGE THAT KEEPS ITS OWN GEOMETRY. Everything else in admin is a column you scroll;
     * this is an editor beside a live preview, and the preview is the entire point — put it in the
     * standard prose column and it lands below the fold, so you would be typing at something you
     * cannot see. It takes the header and the controls, and keeps the two panes.
     */
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 border-border border-b px-6 py-4">
        <div>
          <h1 className="font-bold text-2xl">组件试验场</h1>
          <p className="mt-1 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
            在此编写组件并发布，无需重新部署。你编辑的是草稿；对话只会绘制已发布的内容。
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={!(draft.slug && draft.title)}
            onClick={save}
            size="sm"
            type="button"
            variant="outline"
          >
            保存草稿
          </Button>
          <Button
            /* `publish` saves first, since publishing acts on the stored draft, not the editors. */
            disabled={!(draft.slug && draft.title)}
            onClick={publish}
            size="sm"
            type="button"
          >
            发布
          </Button>
        </div>
      </header>

      {error ? (
        <div
          className="border-border border-b bg-destructive/10 px-6 py-2 text-destructive text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto px-6 py-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <TextField
              label="名称"
              onChange={set("slug")}
              placeholder="refund_card"
              value={draft.slug}
            />
            <TextField
              label="标题"
              onChange={set("title")}
              placeholder="退款卡片"
              value={draft.title}
            />
          </div>
          <TextField
            label="模型读取的描述"
            onChange={set("description")}
            placeholder="显示退款金额、原因和状态。"
            value={draft.description}
          />
          <CodeField label="HTML" onChange={set("html")} value={draft.html} />
          <CodeField label="CSS" onChange={set("css")} value={draft.css} />
          <CodeField
            label="JavaScript"
            onChange={set("jsFunctions")}
            value={draft.jsFunctions}
          />
          <CodeField
            invalid={schema === null}
            label="参数（JSON Schema）"
            onChange={set("argumentSchema")}
            value={draft.argumentSchema}
          />
          <CodeField
            invalid={sample === null}
            label="示例参数"
            onChange={set("sampleArguments")}
            value={draft.sampleArguments}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">预览</div>
            {sample === null ? (
              <p className="text-sm text-destructive">
                示例参数不是有效的 JSON，因此没有可用于绘制的内容。
              </p>
            ) : (
              <OpenGenerativeUIActivityRenderer
                activityType="open-generative-ui"
                agent={null}
                content={{
                  css: draft.css,
                  cssComplete: true,
                  html: [draft.html],
                  htmlComplete: true,
                  // Provide sample args in the same sandbox evaluation as the component code.
                  jsFunctions: `window.__args = ${JSON.stringify(sample)};\n${draft.jsFunctions}`,
                  jsFunctionsComplete: true,
                  generating: false,
                }}
                key={`${draft.html}${draft.css}${draft.jsFunctions}${draft.sampleArguments}`}
                message={null}
              />
            )}
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-border border-b px-4 py-2 font-medium text-sm">
              已保存的组件
            </div>
            {(components ?? []).length === 0 ? (
              <p className="px-4 py-3 text-muted-foreground text-sm">
                暂无内容。
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(components ?? []).map((component) => (
                  <li
                    className="flex items-center justify-between px-4 py-2 text-sm"
                    key={component.name}
                  >
                    <div>
                      <div className="font-mono text-xs">{component.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {component.published
                          ? `已发布，第 ${component.revision} 版`
                          : "仅草稿，智能体无法绘制"}
                        {component.hasUnpublishedChanges
                          ? " · 自发布后已编辑"
                          : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => load(component)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        打开
                      </Button>
                      <Button
                        onClick={() => setDeleting(component.name)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        删除
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-border border-t px-4 py-2 text-muted-foreground text-xs">
              发布后所有 Bot
              都可以使用。和此构建自带的组件一样，可在组件页面为特定 Bot
              关闭使用权限。
            </p>
          </div>
        </div>
      </div>

      {/*
       * Deleting was a bare button on a row of one-line entries, and it does not come back. The
       * dialog names the component, so what is agreed to says which one it removes.
       */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>要删除 {deleting} 吗？</DialogTitle>
            <DialogDescription>
              它会从此部署中移除。原本可以绘制它的 Bot
              将无法继续使用，且此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleting(null)} size="sm" variant="ghost">
              取消
            </Button>
            <Button
              onClick={() => {
                const name = deleting;
                setDeleting(null);
                if (name) {
                  setError(null);
                  removeComponent.mutate(name);
                }
              }}
              size="sm"
              variant="destructive"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  /*
   * An explicit `htmlFor`, not a wrapping label. The label used to wrap a bare `<input>`; now that
   * the control is a component the association has to be written down rather than implied by
   * nesting, or it exists for sighted people only.
   */
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </Field>
  );
}

function CodeField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>
        {label}
        {invalid ? (
          <span className="ml-2 text-destructive">不是有效的 JSON</span>
        ) : null}
      </FieldLabel>
      <Textarea
        aria-invalid={invalid}
        className="h-32 font-mono text-xs"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        value={value}
      />
    </Field>
  );
}
