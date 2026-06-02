"use client";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label, error, hint, required, className, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="label">
        {label}{required && <span className="text-magenta-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-ink-subtle">{hint}</p>}
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn("input", className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cn("input min-h-[80px]", className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return <select {...rest} className={cn("input", className)}>{children}</select>;
}

export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const grid = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-3" }[cols];
  return <div className={cn("grid gap-4", grid)}>{children}</div>;
}
