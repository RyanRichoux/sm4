import { ROLE_LABELS } from "@sm/shared";
import type { SessionUser } from "@sm/shared";
import { Link } from "react-router";

export function OrgPickerPage({ user }: { user: SessionUser }) {
  return (
    <section className="stack">
      <h1>Choose an organization</h1>
      <div className="tiles">
        {user.memberships.map((m) => (
          <Link key={m.orgId} to={`/o/${m.orgId}`} className="tile">
            <strong>{m.orgName}</strong>
            <span className="muted">{m.roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
