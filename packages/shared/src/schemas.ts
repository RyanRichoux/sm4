import { z } from "zod";
import { ROLES } from "./permissions.js";

export const RoleSchema = z.enum(ROLES);
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));
export const PasswordSchema = z
  .string()
  .min(10, { error: "Use at least 10 characters." })
  .max(200, { error: "Use at most 200 characters." });
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Name is required." })
  .max(100, { error: "Use at most 100 characters." });
export const IdSchema = z.uuid({ error: "Not a valid id." });
export const RolesSchema = z
  .array(RoleSchema)
  .min(1, { error: "Pick at least one role." })
  .transform((r) => [...new Set(r)]);

export const LoginInput = z.object({
  email: EmailSchema,
  password: z.string().min(1, { error: "Enter your password." }).max(200),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1, { error: "Enter your current password." }).max(200),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

/** Add someone to an organization. A password is required only when the email is new. */
export const AddMemberInput = z.object({
  email: EmailSchema,
  displayName: DisplayNameSchema,
  password: PasswordSchema.optional(),
  roles: RolesSchema,
});
export type AddMemberInput = z.infer<typeof AddMemberInput>;

export const UpdateMemberInput = z
  .object({
    displayName: DisplayNameSchema.optional(),
    roles: RolesSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { error: "Nothing to change." });
export type UpdateMemberInput = z.infer<typeof UpdateMemberInput>;

export const ResetPasswordInput = z.object({ newPassword: PasswordSchema });
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

export const UpdateOrgInput = z.object({
  name: z.string().trim().min(1, { error: "Name is required." }).max(120),
});
export type UpdateOrgInput = z.infer<typeof UpdateOrgInput>;

export const AuditQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

export const OrgParams = z.object({ orgId: IdSchema });
export const MemberParams = z.object({ orgId: IdSchema, userId: IdSchema });
