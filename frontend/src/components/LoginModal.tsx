import type { FormEvent } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { AlphaLogo } from "./AlphaLogo";

type LoginModalProps = {
  email: string;
  password: string;
  busy: boolean;
  error?: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
};

export function LoginModal({
  email,
  password,
  busy,
  error,
  onEmail,
  onPassword,
  onSubmit,
  onClose,
}: LoginModalProps) {
  return (
    <div className="raycast-backdrop" onClick={onClose}>
      <section
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close sign in"
        >
          <X size={18} />
        </button>

        <div className="login-modal-head">
          <AlphaLogo size={48} />
          <div>
            <span className="eyebrow">WORLDQUANT BRAIN GATEWAY</span>
            <h2 id="login-title">Sign In to Continue</h2>
          </div>
        </div>

        <p className="login-modal-desc">
          Sign in with your WorldQuant BRAIN account to unlock your portfolio
          dashboard, alpha vault, and simulation workbench.
        </p>

        {error && (
          <div className="login-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form
          method="post"
          action="/api/auth/login"
          autoComplete="on"
          onSubmit={onSubmit}
        >
          <label htmlFor="brain-login-email">
            WorldQuant BRAIN Email
            <input
              id="brain-login-email"
              name="email"
              type="email"
              autoComplete="username email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => onEmail(event.target.value)}
              required
            />
          </label>
          <label htmlFor="brain-login-password">
            Password
            <input
              id="brain-login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your WorldQuant BRAIN password"
              value={password}
              onChange={(event) => onPassword(event.target.value)}
              required
            />
          </label>

          <div className="login-security-note">
            <ShieldCheck size={15} />
            <span>
              Direct encrypted session with <b>api.worldquantbrain.com</b>
            </span>
          </div>

          <button className="button primary full" type="submit" disabled={busy}>
            <LockKeyhole size={15} />
            <span>
              {busy ? "Signing In & Syncing…" : "Sign In to WorldQuant BRAIN"}
            </span>
          </button>
        </form>
      </section>
    </div>
  );
}
