import type { Permission, Role } from "./permissions.js";

/** Body of every error response from the API. */
export interface ApiErrorBody {
  error: string;
  code?: string;
  issues?: { path: string; message: string }[];
}

export interface MembershipSummary {
  orgId: string;
  orgName: string;
  roles: Role[];
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
  memberships: MembershipSummary[];
}

export interface OrgDetails {
  id: string;
  name: string;
  roles: Role[];
  permissions: Permission[];
}

export interface MemberSummary {
  userId: string;
  email: string;
  displayName: string;
  roles: Role[];
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  before: unknown;
  after: unknown;
}
