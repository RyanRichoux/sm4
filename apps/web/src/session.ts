import { can } from "@sm/shared";
import type { MembershipSummary, Permission, SessionUser } from "@sm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./api";

export const ME_KEY = ["me"] as const;

async function fetchMe(): Promise<SessionUser | null> {
  try {
    return await api<SessionUser>("GET", "/api/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: fetchMe, retry: false, staleTime: 60_000 });
}

export function useSetMe() {
  const qc = useQueryClient();
  return (user: SessionUser | null) => {
    if (user === null) qc.clear();
    qc.setQueryData(ME_KEY, user);
  };
}

export function membershipFor(user: SessionUser, orgId: string | undefined): MembershipSummary | undefined {
  return user.memberships.find((m) => m.orgId === orgId);
}

export function canIn(user: SessionUser, orgId: string | undefined, permission: Permission): boolean {
  const m = membershipFor(user, orgId);
  return !!m && can(m.roles, permission);
}
