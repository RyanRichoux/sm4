import { ROLES, ROLE_LABELS } from "@sm/shared";
import type { MemberSummary, Role, SessionUser } from "@sm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { useParams } from "react-router";
import { api, errorText } from "../api";
import { ErrorNote, Field } from "../components/Field";

export function MembersPage({ user }: { user: SessionUser }) {
  const { orgId = "" } = useParams();
  const key = ["members", orgId];
  const members = useQuery({ queryKey: key, queryFn: () => api<MemberSummary[]>("GET", `/api/orgs/${orgId}/members`) });

  return (
    <section className="stack">
      <h1>Members</h1>
      <AddMember orgId={orgId} />
      {members.isPending && <p className="muted">Loading…</p>}
      {members.isError && <ErrorNote error={errorText(members.error)} />}
      {members.data && (
        <div className="list">
          {members.data.map((m) => (
            <MemberRow key={m.userId} orgId={orgId} member={m} isSelf={m.userId === user.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function RolePicker({ value, onChange, disabled }: { value: Role[]; onChange: (r: Role[]) => void; disabled?: boolean }) {
  return (
    <div className="chips" role="group" aria-label="Roles">
      {ROLES.map((r) => {
        const on = value.includes(r);
        return (
          <button
            key={r}
            type="button"
            className={`chip ${on ? "on" : ""}`}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
          >
            {ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}

function AddMember({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>(["checkin"]);
  const add = useMutation({
    mutationFn: () => api<MemberSummary>("POST", `/api/orgs/${orgId}/members`, { email, displayName, roles, ...(password ? { password } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members", orgId] });
      setEmail("");
      setName("");
      setPassword("");
      setOpen(false);
    },
  });
  if (!open) {
    return (
      <div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          + Add member
        </button>
      </div>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Add member</h2>
      <div className="grid2">
        <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Name" required value={displayName} onChange={(e) => setName(e.target.value)} />
      </div>
      <Field
        label="Temporary password"
        hint="Needed for new accounts; they'll choose their own at first sign-in. Leave blank if they already have an account."
        type="text"
        autoComplete="off"
        minLength={10}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <RolePicker value={roles} onChange={setRoles} />
      <ErrorNote error={add.error ? errorText(add.error) : null} />
      <div className="row">
        <button className="btn primary" disabled={add.isPending || roles.length === 0}>
          Add
        </button>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function MemberRow({ orgId, member, isSelf }: { orgId: string; member: MemberSummary; isSelf: boolean }) {
  const qc = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [temp, setTemp] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["members", orgId] });
  const update = useMutation({
    mutationFn: (body: { roles?: Role[]; active?: boolean }) => api<MemberSummary>("PATCH", `/api/orgs/${orgId}/members/${member.userId}`, body),
    onSuccess: refresh,
  });
  const reset = useMutation({
    mutationFn: () => api("POST", `/api/orgs/${orgId}/members/${member.userId}/reset-password`, { newPassword: temp }),
    onSuccess: () => {
      setResetting(false);
      setTemp("");
      setNote("Password reset. Give them the temporary password; they'll choose a new one at sign-in.");
    },
  });
  const error = update.error ?? reset.error;

  return (
    <div className={`card member ${member.active ? "" : "inactive"}`}>
      <div className="member-head">
        <div>
          <strong>{member.displayName}</strong> {isSelf && <span className="badge">You</span>}
          {!member.active && <span className="badge warn">No access</span>}
          {member.mustChangePassword && <span className="badge">Temporary password</span>}
          <div className="muted small">
            {member.email} · {member.lastLoginAt ? `last signed in ${new Date(member.lastLoginAt).toLocaleString()}` : "never signed in"}
          </div>
        </div>
        <div className="row">
          {!isSelf && (
            <button className="btn ghost" onClick={() => setResetting((v) => !v)}>
              Reset password
            </button>
          )}
          <button className="btn ghost" onClick={() => update.mutate({ active: !member.active })}>
            {member.active ? "Remove access" : "Restore access"}
          </button>
        </div>
      </div>
      <RolePicker value={member.roles} disabled={update.isPending} onChange={(roles) => roles.length > 0 && update.mutate({ roles })} />
      {resetting && (
        <form
          className="row-form"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate();
          }}
        >
          <Field label="New temporary password" minLength={10} required value={temp} onChange={(e) => setTemp(e.target.value)} />
          <button className="btn primary">Reset</button>
        </form>
      )}
      {note && <p className="success">{note}</p>}
      <ErrorNote error={error ? errorText(error) : null} />
    </div>
  );
}
