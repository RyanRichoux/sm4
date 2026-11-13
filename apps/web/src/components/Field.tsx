import type { InputHTMLAttributes } from "react";
import { useId } from "react";

export function Field({ label, hint, ...input }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input id={id} {...input} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
