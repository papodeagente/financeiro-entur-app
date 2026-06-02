"use client";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markAllRead } from "@/lib/actions/notifications-actions";

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button className="btn-secondary" disabled={pending} onClick={() => start(async () => { await markAllRead(); })}>
      <CheckCheck className="h-4 w-4" /> {pending ? "Marcando…" : "Marcar todas como lidas"}
    </button>
  );
}
