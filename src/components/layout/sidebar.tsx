"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Wallet, Receipt, Users, Package,
  Repeat, Layers, AlertTriangle, Percent, Truck, Tags, Building2, Landmark,
  CheckCircle2, BarChart3, LineChart, FileBarChart, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "ADMIN" | "FINANCEIRO" | "COMERCIAL" | "GESTOR" | "CONSULTOR" | "READONLY";

type Item = { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] };
type Group = { group: string; items: Item[] };

// Sem `roles` = visível pra todos. Com roles = só esses perfis veem.
const nav: Group[] = [
  { group: "Visão geral", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { group: "Movimento", items: [
    { href: "/receitas", label: "Receitas", icon: TrendingUp },
    { href: "/despesas", label: "Despesas", icon: TrendingDown, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/contas-a-receber", label: "Contas a receber", icon: Wallet, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/contas-a-pagar", label: "Contas a pagar", icon: Receipt, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
  ]},
  { group: "Vendas & Clientes", items: [
    { href: "/clientes", label: "Clientes / Alunos", icon: Users },
    { href: "/produtos", label: "Produtos & Ofertas", icon: Package },
    { href: "/assinaturas", label: "Assinaturas", icon: Repeat, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/parcelamentos", label: "Parcelamentos", icon: Layers, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/inadimplencia", label: "Inadimplência", icon: AlertTriangle, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/comissoes", label: "Comissões", icon: Percent },
  ]},
  { group: "Estrutura", items: [
    { href: "/fornecedores", label: "Fornecedores", icon: Truck, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/categorias", label: "Categorias", icon: Tags, roles: ["ADMIN", "FINANCEIRO"] },
    { href: "/centros-de-custo", label: "Centros de custo", icon: Building2, roles: ["ADMIN", "FINANCEIRO"] },
    { href: "/contas-bancarias", label: "Contas bancárias", icon: Landmark, roles: ["ADMIN", "FINANCEIRO"] },
    { href: "/conciliacao", label: "Conciliação", icon: CheckCircle2, roles: ["ADMIN", "FINANCEIRO"] },
  ]},
  { group: "Estratégico", items: [
    { href: "/dre", label: "DRE gerencial", icon: BarChart3, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/fluxo-de-caixa", label: "Fluxo de caixa", icon: LineChart, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
    { href: "/relatorios", label: "Relatórios", icon: FileBarChart, roles: ["ADMIN", "FINANCEIRO", "GESTOR"] },
  ]},
  { group: "Sistema", items: [
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ]},
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const filtered = nav
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.roles || it.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-bg-soft/70 backdrop-blur sticky top-0 h-screen">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="relative w-32 h-10">
            <Image src="https://entur.ia.br/logo.png" alt="ENTUR" fill className="object-contain object-left" priority />
          </div>
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-ink-subtle">Financeiro</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {filtered.map((section) => (
          <div key={section.group} className="mt-4">
            <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-ink-subtle font-semibold">{section.group}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      active ? "bg-brand-soft text-ink ring-1 ring-brand-500/40" : "text-ink-muted hover:bg-bg-elev hover:text-ink"
                    )}>
                      <Icon className={cn("h-4 w-4", active ? "text-magenta-400" : "text-ink-subtle group-hover:text-ink-muted")} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-line">
        <p className="text-[10px] text-ink-subtle">© ENTUR · Escola de Negócios do Turismo</p>
      </div>
    </aside>
  );
}
