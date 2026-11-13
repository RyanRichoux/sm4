import type { SessionUser } from "@sm/shared";
import type { FormEvent } from "react";
import { useState } from "react";
import { api, errorText } from "../api";
import { ErrorNote, Field } from "../components/Field";
import { useSetMe } from "../session";

export function LoginPage() {
  const setMe = useSetMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMe(await api<SessionUser>("POST", "/api/auth/login", { email, password }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="card narrow" onSubmit={submit}>
        <h1>Smoker Matchmaker</h1>
        <Field label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <ErrorNote error={error} />
        <button className="btn primary wide" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="muted small">Forgot your password? Ask an admin to reset it.</p>
      </form>
    </div>
  );
}
