"use client";
import { useEffect, useRef } from "react";
import { X, ArrowUpRight } from "lucide-react";
import {
  healthLabels,
  lifecycleLabels,
  type Health,
  type Lifecycle,
  type StackItem,
} from "@repo/registry";
export function HealthBadge({ health }: { health: Health }) {
  return (
    <span className={`health health-${health}`}>
      <i />
      {healthLabels[health] || "Unknown"}
    </span>
  );
}
export function LifecycleBadge({ value }: { value: Lifecycle }) {
  return (
    <span className={`lifecycle lifecycle-${value}`}>
      {lifecycleLabels[value]}
    </span>
  );
}
export function Stack({
  items,
  limit = 4,
}: {
  items: StackItem[];
  limit?: number;
}) {
  const unique = [...new Map(items.map((i) => [i.name, i])).values()];
  return (
    <div className="stack">
      {unique.slice(0, limit).map((i) => (
        <span
          key={i.name}
          title={`${i.version || "Version unknown"} · ${i.source}`}
        >
          {i.name}
        </span>
      ))}
      {unique.length > limit && (
        <span
          title={unique
            .slice(limit)
            .map((i) => i.name)
            .join(", ")}
        >
          +{unique.length - limit}
        </span>
      )}
      {!unique.length && (
        <span className="muted no-tag">Stack not recorded</span>
      )}
    </div>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return /^https?:\/\//.test(href) ? (
    <a className="external-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  ) : (
    <span>{children}</span>
  );
}
export function Panel({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sheet ${wide ? "sheet-wide" : ""}`}
      onCancel={onClose}
      aria-label={title}
    >
      <div className="sheet-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error-notice" role="alert">
      {message}
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="inline-empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "span-2" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
