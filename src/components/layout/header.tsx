"use client";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Search, Bell } from "lucide-react";

export function Header({ unreadCount = 0 }: { unreadCount?: number }) {
  const { data: session } = useSession();
  const user = session?.user;
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4 flex-1">
          <div className="hidden md:flex items-center gap-2 max-w-md flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar cliente, venda, despesa…"
                className="input pl-9"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notificacoes" className="btn-ghost p-2 relative" aria-label="Notificações" title="Notificações">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-magenta-500 text-white text-[10px] font-semibold flex items-center justify-center px-1 ring-2 ring-bg">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-3 pl-3 border-l border-line">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-ink leading-tight">{user?.name ?? "—"}</p>
              <p className="text-[11px] text-ink-subtle leading-tight">{user?.role ?? ""}</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-brand-gradient flex items-center justify-center text-white text-sm font-semibold">
              {(user?.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="btn-ghost p-2"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
