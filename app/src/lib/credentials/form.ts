import { z } from "zod";

export const credentialFormSchema = z.object({
  kind: z.enum(["model", "connector"]),
  provider: z.string().trim().min(1, "请输入提供商。"),
  keyId: z.string().trim().min(1, "请输入密钥 ID。"),
  plaintext: z.string().min(1, "请输入秘密。"),
});

export type CredentialFormValues = z.infer<typeof credentialFormSchema>;
