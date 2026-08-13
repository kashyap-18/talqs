"use client";

import { LogOut, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth-provider";

export default function AccountControl() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result =
      mode === "signin"
        ? await auth.signIn(email.trim(), password)
        : await auth.signUp(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    if (result.confirmationRequired) {
      setMessage("Check your email to confirm the account, then sign in.");
      setMode("signin");
      setPassword("");
      return;
    }
    setPassword("");
    setOpen(false);
  }

  if (auth.loading) {
    return <span className="account-loading" aria-label="Loading account" />;
  }

  return (
    <>
      {auth.user ? (
        <button
          className="account-button signed-in"
          type="button"
          title={`Sign out ${auth.user.email ?? ""}`}
          onClick={() => void auth.signOut()}
        >
          <LogOut size={16} aria-hidden="true" />
          <span>{auth.user.email}</span>
        </button>
      ) : (
        <button className="account-button" type="button" onClick={() => setOpen(true)}>
          <UserRound size={16} aria-hidden="true" /> Sign in
        </button>
      )}

      {open ? (
        <div className="modal-backdrop account-backdrop" role="presentation">
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <header>
              <div>
                <p className="eyebrow">Private workspace</p>
                <h2 id="auth-title">{mode === "signin" ? "Sign in" : "Create account"}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setOpen(false)} title="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {auth.configured ? (
              <form onSubmit={submit}>
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  required
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  minLength={8}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
                {message ? <p className="auth-message" role="status">{message}</p> : null}
                <button className="auth-submit" type="submit" disabled={submitting}>
                  {submitting ? "Working" : mode === "signin" ? "Sign in" : "Create account"}
                </button>
                <button
                  className="auth-switch"
                  type="button"
                  onClick={() => {
                    setMode((current) => current === "signin" ? "signup" : "signin");
                    setMessage("");
                  }}
                >
                  {mode === "signin" ? "Create an account" : "Use an existing account"}
                </button>
              </form>
            ) : (
              <p className="auth-message">
                Supabase environment variables are missing. Authentication is unavailable in this local process.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

