import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type BtnVariant =
  | "primary"
  | "secondary"
  | "link"
  | "icon"
  | "danger-text";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  disabled,
  ...rest
}: BtnProps) {
  return (
    <button
      className={["btn", `btn-${variant}`, className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : children}
    </button>
  );
}

export function Input({
  className = "",
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={[
        "field",
        error ? "field-error" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={["field select", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "accent" | "high" | "medium" | "low" | "muted";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function TypeDot({
  color,
  size = 8,
}: {
  color: string;
  size?: number;
}) {
  return (
    <span
      className="type-dot"
      style={{ width: size, height: size, background: color } as CSSProperties}
      aria-hidden
    />
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="error-banner" role="alert">
      {children}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  width = 480,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
  footer?: ReactNode;
}) {
  return (
    <div
      className="modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card" style={{ width }}>
        <div className="modal-head">
          <h2 id="modal-title" className="serif modal-title">
            {title}
          </h2>
          <Button variant="icon" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {body ? (
        <p className="muted" style={{ marginBottom: action ? 16 : 0 }}>
          {body}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="tip-wrap">
      {children}
      <span className="tip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
