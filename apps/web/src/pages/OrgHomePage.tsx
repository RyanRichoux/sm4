import { ROLE_LABELS } from "@sm/shared";
import type { OrgDetails, SessionUser } from "@sm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api, errorText } from "../api";
import { ErrorNote } from "../components/Field";
import { ME_KEY } from "../session";

export function OrgHomePage({ user }: { user: SessionUser }) {
  const { orgId = "" } = useParams();
  const org = useQuery({ queryKey: ["org", orgId], queryFn: () => api<OrgDetails>("GET", `/api/orgs/${orgId}`) });
  if (org.isPending) return <p className="muted">Loading…</p>;
  if (org.isError) return <ErrorNote error={errorText(org.error)} />;
  const p = new Set(org.data.permissions);

  return (
    <section className="stack">
      <h1>{org.data.name}</h1>
      <p className="muted">
        Signed in as {user.displayName} · {org.data.roles.map((r) => ROLE_LABELS[r]).join(", ")}
      </p>
      <div className="tiles">
        <div className="tile disabled">
          <strong>Events</strong>
          <span className="muted">Coming in Phase 1</span>
        </div>
        <div className="tile disabled">
          <strong>Fighters</strong>
          <span className="muted">Coming in Phase 1</span>
        </div>
        <div className="tile disabled">
          <strong>Check-in</strong>
          <span className="muted">Coming in Phase 1</span>
        </div>
        {p.has("users.manage") && (
          <Link className="tile" to={`/o/${orgId}/members`}>
            <strong>Members</strong>
            <span className="muted">Accounts and roles</span>
          </Link>
        )}
        {p.has("audit.read") && (
          <Link className="tile" to={`/o/${orgId}/audit`}>
            <strong>Activity</strong>
            <span className="muted">Who changed what</span>
          </Link>
        )}
      </div>
      {p.has("org.manage") && <RenameOrg orgId={orgId} name={org.data.name} />}
    </section>
  );
}

function RenameOrg({ orgId, name }: { orgId: string; name: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(name);
  const rename = useMutation({
    mutationFn: () => api<OrgDetails>("PATCH", `/api/orgs/${orgId}`, { name: value }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["org", orgId] });
      void qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
  return (
    <form
      className="card row-form"
      onSubmit={(e) => {
        e.preventDefault();
        rename.mutate();
      }}
    >
      <label className="field grow">
        <span className="field-label">Organization name</span>
        <input value={value} onChange={(e) => setValue(e.target.value)} required maxLength={120} />
      </label>
      <button className="btn" disabled={rename.isPending || value.trim() === name}>
        Rename
      </button>
      <ErrorNote error={rename.error ? errorText(rename.error) : null} />
    </form>
  );
}
