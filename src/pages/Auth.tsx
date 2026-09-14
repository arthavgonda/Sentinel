import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../state/store";
import { Button, ErrorBanner, Input } from "../ui/primitives";
import { APP_NAME, AUTH_POLICY } from "../config/application";

export function LoginPage() {
  const { user, login } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      const r = login(email, password);
      setLoading(false);
      if (r === "locked") {
        setErr(AUTH_POLICY.lockoutMessage);
        return;
      }
      if (r === "invalid") {
        setErr("Incorrect email or password.");
        return;
      }
      nav("/mfa");
    }, AUTH_POLICY.simulatedLatencyMs);
  }

  return (
    <div className="auth-wrap">
      <form className="auth-col" onSubmit={handleSubmit} noValidate>
        <div className="wordmark" style={{ fontSize: 28, color: "var(--ink)" }}>
          {APP_NAME}
        </div>
        <p className="muted" style={{ marginTop: 4, marginBottom: 28 }}>
          Investigation intelligence.
        </p>

        {err ? (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner>{err}</ErrorBanner>
          </div>
        ) : null}

        <label className="form-label" htmlFor="email">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          error={Boolean(err)}
          onChange={(e) => { setEmail(e.target.value); setErr(""); }}
          required
        />

        <div style={{ height: 12 }} />

        <label className="form-label" htmlFor="password">
          Password
        </label>
        <div style={{ position: "relative" }}>
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            error={Boolean(err)}
            style={{ paddingRight: 52 }}
            onChange={(e) => { setPassword(e.target.value); setErr(""); }}
            required
          />
          <button
            type="button"
            className="btn btn-link"
            style={{ position: "absolute", right: 10, top: 9, fontSize: 11, height: "auto" }}
            tabIndex={0}
            onClick={() => setShow((s) => !s)}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>

        <div style={{ textAlign: "right", marginTop: 6, marginBottom: 20 }}>
          <Link to="/forgot-password" style={{ fontSize: 12 }}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" style={{ width: "100%" }} loading={loading}>
          Log In
        </Button>

        <p className="muted" style={{ marginTop: 20, fontSize: 11, lineHeight: 1.5 }}>
          Demo accounts accept a password of at least {AUTH_POLICY.minimumPasswordLength} characters. MFA accepts any
          {AUTH_POLICY.mfaCodeLength}-digit code except 000000.
        </p>
      </form>
    </div>
  );
}

export function MfaPage() {
  const { completeMfa } = useStore();
  const nav = useNavigate();
  const [digits, setDigits] = useState(() => Array(AUTH_POLICY.mfaCodeLength).fill(""));
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [left, setLeft] = useState<number>(AUTH_POLICY.mfaExpirySeconds);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (left <= 0) return;
    const iv = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(iv);
  }, [left]);

  function submit(code: string) {
    const r = completeMfa(code);
    if (r === "expired") {
      setErr("This code has expired. Request a new one.");
      triggerShake();
      return;
    }
    if (r === "incorrect") {
      setErr("Incorrect code. Try again.");
      triggerShake();
      return;
    }
    nav("/dashboard");
  }

  function triggerShake() {
    setShake(true);
    setDigits(Array(AUTH_POLICY.mfaCodeLength).fill(""));
    window.setTimeout(() => {
      setShake(false);
      refs.current[0]?.focus();
    }, 220);
  }

  return (
    <div className="auth-wrap">
      <form
        className="auth-col"
        style={{ textAlign: "center" }}
        onSubmit={(e) => { e.preventDefault(); submit(digits.join("")); }}
      >
        <div className="wordmark" style={{ fontSize: 20, color: "var(--ink)" }}>
          {APP_NAME}
        </div>
        <h1 className="serif" style={{ fontSize: 22, margin: "20px 0 8px" }}>
          Enter your verification code
        </h1>
        <p className="muted">We've sent a {AUTH_POLICY.mfaCodeLength}-digit code to your authenticator app.</p>

        {err ? (
          <div style={{ margin: "12px 0" }}>
            <ErrorBanner>{err}</ErrorBanner>
          </div>
        ) : null}

        <div className={`mfa-row ${shake ? "shake" : ""}`} style={{ margin: "28px 0" }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              className="mfa-box"
              inputMode="numeric"
              pattern="[0-9]"
              maxLength={1}
              value={d}
              aria-label={`Digit ${i + 1}`}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(-1);
                const next = [...digits];
                next[i] = v;
                setDigits(next);
                setErr("");
                if (v && i < AUTH_POLICY.mfaCodeLength - 1) refs.current[i + 1]?.focus();
                const code = next.join("");
                if (code.length === AUTH_POLICY.mfaCodeLength) submit(code);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) {
                  refs.current[i - 1]?.focus();
                }
              }}
              onPaste={(e) => {
                const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, AUTH_POLICY.mfaCodeLength);
                if (!t) return;
                e.preventDefault();
                const next = t.split("").concat(Array(AUTH_POLICY.mfaCodeLength).fill("")).slice(0, AUTH_POLICY.mfaCodeLength);
                setDigits(next);
                const idx = Math.min(t.length, AUTH_POLICY.mfaCodeLength - 1);
                refs.current[idx]?.focus();
                if (t.length === AUTH_POLICY.mfaCodeLength) submit(t);
              }}
            />
          ))}
        </div>

        <Button type="submit" style={{ width: "100%" }}>
          Verify
        </Button>

        <div style={{ marginTop: 16 }}>
          {left > 0 ? (
            <span className="muted">
              Resend in 0:{String(left).padStart(2, "0")}
            </span>
          ) : (
            <Button
              variant="link"
              type="button"
              onClick={() => { setLeft(AUTH_POLICY.mfaExpirySeconds); setErr(""); }}
            >
              Resend code
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <div className="auth-wrap">
      <form
        className="auth-col"
        onSubmit={(e) => { e.preventDefault(); setSent(true); }}
      >
        <div className="wordmark" style={{ fontSize: 20, color: "var(--ink)" }}>
          {APP_NAME}
        </div>
        <h1 className="serif" style={{ fontSize: 22, margin: "20px 0 20px" }}>
          Reset your password
        </h1>

        {sent ? (
          <p style={{ lineHeight: 1.6 }}>
            If an account exists for that email, a reset link has been sent.
          </p>
        ) : (
          <>
            <label className="form-label" htmlFor="reset-email">
              Email
            </label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div style={{ height: 16 }} />
            <Button type="submit" style={{ width: "100%" }}>
              Send Reset Link
            </Button>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <Link to="/login" style={{ fontSize: 12 }}>
            ← Back to log in
          </Link>
        </div>
      </form>
    </div>
  );
}
