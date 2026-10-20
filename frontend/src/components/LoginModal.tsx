import type { FormEvent } from "react";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { AlphaLogo } from "./AlphaLogo";

type LoginModalProps = {
  email: string;
  password: string;
  busy: boolean;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
};

export function LoginModal({
  email,
  password,
  busy,
  onEmail,
  onPassword,
  onSubmit,
  onClose,
}: LoginModalProps) {
  return (
    <div className="palette-backdrop" onClick={onClose}>
      <section
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close sign in"
        >
          <X size={18} />
        </button>

        <div className="login-modal-head">
          <AlphaLogo size={52} />
          <div>
            <span className="eyebrow">WORLDQUANT BRAIN GATEWAY</span>
            <h2 id="login-title">Authenticate Consultant Session</h2>
          </div>
        </div>

        <p className="login-modal-desc">
          Sign in with your WorldQuant BRAIN account. Credentials are encrypted
          in your local session to dispatch cloud simulations and sync your
          portfolio.
        </p>

        <form onSubmit={onSubmit}>
          <label>
            Consultant Email
            <input
              type="email"
              autoComplete="username"
              placeholder="consultant@worldquantbrain.com"
              value={email}
              onChange={(event) => onEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
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
              Direct local authentication with{" "}
              <b>api.worldquantbrain.com</b>
            </span>
          </div>

          <button className="button primary full" type="submit" disabled={busy}>
            <LockKeyhole size={15} />
            <span>
              {busy ? "Authenticating Session…" : "Connect WorldQuant BRAIN"}
            </span>
          </button>
        </form>
      </section>
    </div>
  );
}
