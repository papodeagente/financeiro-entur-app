"use client";
import { Search } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function SearchInput({ placeholder = "Buscar…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [q, setQ] = useState(search.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(Array.from(search.entries()));
      if (q) params.set("q", q); else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none" />
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder} className="input pl-9"
      />
    </div>
  );
}
