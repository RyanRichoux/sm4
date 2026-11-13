// Roles are granted per organization. Code checks permissions, never role names.
export const ROLES = ["admin", "matchmaker", "checkin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  matchmaker: "Matchmaker",
  checkin: "Check-in staff",
};

export const PERMISSIONS = {
  "org.read": ["admin", "matchmaker", "checkin"],
  "org.manage": ["admin"],
  "users.manage": ["admin"],
  "audit.read": ["admin"],
  "fighters.read": ["admin", "matchmaker", "checkin"],
  "fighters.write": ["admin", "matchmaker"],
  // Skill is internal to matchmaking; check-in staff and the public never see it.
  "skill.read": ["admin", "matchmaker"],
  "contacts.read": ["admin", "matchmaker", "checkin"],
  "contacts.write": ["admin", "matchmaker", "checkin"],
  "events.run": ["admin", "matchmaker"],
  "checkin.run": ["admin", "matchmaker", "checkin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(roles: readonly Role[], permission: Permission): boolean {
  const allowed: readonly Role[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}

export function permissionsFor(roles: readonly Role[]): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(roles, p));
}
