import type { SessionUser } from "@sm/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { api, errorText } from "../api";
import { ErrorNote, Field } from "../components/Field";
import { useSetMe } from "../session";

export function ChangePasswordPage({ forced = false }: { forced?: boolean }) {
  const setMe = useSetMe();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirm) return setError("The new passwords don't match.");
    try {
      setMe(await api<SessionUser>("POST", "/api/auth/password", { currentPassword, newPassword }));
      setCurrent("");
      setNew("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    }
  }

  const form = (
    <form className="card narrow" onSubmit={submit}>
      <h1>{forced ? "Choose a new password" : "Change password"}</h1>
      {forced && <p className="muted">Your account was set up with a temporary password. Choose your own to continue.</p>}
      <Field label={forced ? "Temporary password" : "Current password"} type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
      <Field label="New password" hint="At least 10 characters." type="password" autoComplete="new-password" required minLength={10} value={newPassword} onChange={(e) => setNew(e.target.value)} />
      <Field label="New password again" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <ErrorNote error={error} />
      {done && <p className="success">Password changed. Other devices have been signed out.</p>}
      <button className="btn primary wide">Save password</button>
    </form>
  );
  return forced ? <div className="center-page">{form}</div> : form;
}
