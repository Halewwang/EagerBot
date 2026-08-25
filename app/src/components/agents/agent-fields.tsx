import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type AgentFormValues, agentFormSchema } from "@/lib/agents/form";
import {
  type ConnectionVerdict,
  testAgentConnection,
} from "@/lib/agents/queries";

export function AgentFields({
  defaultValues,
  hasAuth = false,
  submitLabel,
  onSubmit,
  error,
  onCancel,
}: {
  defaultValues: AgentFormValues;
  /** Whether this coworker already has a key, so the field can say so without showing it. */
  hasAuth?: boolean;
  submitLabel: string;
  onSubmit: (values: AgentFormValues) => Promise<unknown>;
  error?: Error | null;
  onCancel?: () => void;
}) {
  const form = useForm({
    defaultValues,
    validators: { onSubmit: agentFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  const [connection, setConnection] = useState<ConnectionVerdict | null>(null);
  const [testing, setTesting] = useState(false);

  /** Test endpoint reachability from the server, which is what runs will use. */
  const testConnection = async (endpoint: string, key: string) => {
    setTesting(true);
    setConnection(null);
    try {
      setConnection(await testAgentConnection(endpoint, key));
    } finally {
      setTesting(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>名称</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="费用管理"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="title">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>称谓</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="财务运营"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="roleDescription">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>角色</FieldLabel>
                <Textarea
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="审核收据、归类费用并准备报销报告。"
                  rows={4}
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="visibility">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>可见性</FieldLabel>
              <Select
                onValueChange={(value) =>
                  field.handleChange(value as AgentFormValues["visibility"])
                }
                value={field.state.value}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="private">私有，仅自己可见</SelectItem>
                    <SelectItem value="public">公开，所有人可见</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        <form.Field name="endpoint">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>智能体端点（可选）</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    aria-invalid={isInvalid}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setConnection(null);
                      field.handleChange(event.target.value);
                    }}
                    placeholder="https://your-agent.example.com/ag-ui"
                    value={field.state.value}
                  />
                  <Button
                    disabled={!field.state.value || testing}
                    onClick={() =>
                      void testConnection(
                        field.state.value,
                        form.getFieldValue("authValue") ?? "",
                      )
                    }
                    type="button"
                    variant="outline"
                  >
                    {testing ? "测试中…" : "测试"}
                  </Button>
                </div>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
                {connection ? (
                  <p
                    className={`text-sm ${connection.ok ? "text-muted-foreground" : "text-destructive"}`}
                    role="status"
                  >
                    {connection.ok
                      ? `已收到响应：${connection.events.join("、")}`
                      : connection.reason}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    留空即可使用内置 Bot。任何支持 AG-UI 的智能体都可以使用。
                    连接由本服务器发起，因此你本机上的智能体必须能从这里访问。
                  </p>
                )}
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="authValue">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>智能体密钥（可选）</FieldLabel>
              <Input
                autoComplete="off"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={
                  hasAuth ? "已设置密钥。如需替换，请输入新密钥。" : "Bearer …"
                }
                // Never repopulated; `hasAuth` communicates that a key exists without exposing it.
                type="password"
                value={field.state.value}
              />
              <p className="text-muted-foreground text-sm">
                每次运行都会作为 <code>Authorization</code>{" "}
                请求头发送，并保存在凭据 保管库中。留空则保留当前密钥。
              </p>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button disabled={!canSubmit || isSubmitting} type="submit">
              {isSubmitting ? "保存中…" : submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="outline">
            取消
          </Button>
        ) : null}
      </div>
    </form>
  );
}
