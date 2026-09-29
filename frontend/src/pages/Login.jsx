import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Copy, Eye, EyeOff, LogIn, Snowflake } from "lucide-react";
import Reveal from "../components/ui/Reveal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const DEMO_ACCOUNTS = [
  { role: "Duty Officer", email: "duty.officer@polarops.io", password: "demo123" },
  { role: "Admin", email: "admin@polarops.io", password: "admin123", note: "can delete" },
  { role: "Medical Officer", email: "medic@polarops.io", password: "medic123", note: "clinical access" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");

  const copyValue = async (key, value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast(`Copied ${label}`);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? "" : prev)), 1500);
    } catch {
      showToast("Couldn't copy — select and copy it manually.", { variant: "error" });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Reveal className="glass-card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
            <Snowflake size={26} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-wide text-text-primary">
              POLAR<span className="text-accent">OPS</span>
            </p>
            <p className="text-sm text-text-secondary">Sign in to Operations Command</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@polarops.io"
              className="focus-ring rounded-xl border border-border bg-surface-solid px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-text-secondary">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="focus-ring w-full rounded-xl border border-border bg-surface-solid px-3.5 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-secondary/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="focus-ring absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-status-critical" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={16} strokeWidth={2} />
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <p className="text-center text-xs font-medium text-text-secondary">Demo accounts</p>
          {DEMO_ACCOUNTS.map((account) => (
            <div
              key={account.email}
              className="rounded-lg border border-border bg-surface-solid/60 px-3 py-2 text-xs"
            >
              <p className="mb-1 font-semibold text-text-primary">
                {account.role}
                {account.note && <span className="ml-1 font-normal text-text-secondary">({account.note})</span>}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-text-secondary">{account.email}</span>
                <button
                  type="button"
                  onClick={() => copyValue(`${account.email}-email`, account.email, `${account.role} email`)}
                  aria-label={`Copy ${account.role} email`}
                  className="focus-ring shrink-0 rounded p-1 text-text-secondary hover:text-accent"
                >
                  {copiedKey === `${account.email}-email` ? (
                    <Check size={13} strokeWidth={2} className="text-status-ok" />
                  ) : (
                    <Copy size={13} strokeWidth={1.75} />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-text-secondary">{account.password}</span>
                <button
                  type="button"
                  onClick={() => copyValue(`${account.email}-password`, account.password, `${account.role} password`)}
                  aria-label={`Copy ${account.role} password`}
                  className="focus-ring shrink-0 rounded p-1 text-text-secondary hover:text-accent"
                >
                  {copiedKey === `${account.email}-password` ? (
                    <Check size={13} strokeWidth={2} className="text-status-ok" />
                  ) : (
                    <Copy size={13} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
