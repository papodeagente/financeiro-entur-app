"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Plus, Pencil, Power, Package, GraduationCap, Users, Calendar, Briefcase, Sparkles,
  ShoppingBag, Zap, ArrowUp, ArrowDown, Layers, Tag, Building2, Settings, Repeat,
  CircleDollarSign, ChevronDown, Info,
} from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError, FormFooter } from "@/components/ui/form-actions";
import { upsertProduct, toggleProductActive } from "@/lib/actions/products";
import { productTypeLabel } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";

export type ProductRow = {
  id: string; name: string; description: string | null;
  type: string; billing: string;
  defaultPrice: string;
  estimatedCost: string | null; estimatedMargin: string | null;
  defaultCommissionPercent: string | null;
  accessDurationDays: number | null;
  categoryId: string | null; costCenterId: string | null;
  active: boolean; notes: string | null;
};
export type Option = { id: string; name: string };

const typeIcons: Record<string, typeof Package> = {
  CURSO: GraduationCap,
  MENTORIA: Sparkles,
  ASSINATURA: Repeat,
  COMUNIDADE: Users,
  EVENTO: Calendar,
  CONSULTORIA: Briefcase,
  TREINAMENTO: GraduationCap,
  PRODUTO_DIGITAL: Package,
  UPSELL: ArrowUp,
  DOWNSELL: ArrowDown,
  ORDER_BUMP: ShoppingBag,
};

const typeHints: Record<string, string> = {
  CURSO: "Curso online com aulas estruturadas",
  MENTORIA: "Acompanhamento individual ou em grupo",
  ASSINATURA: "Acesso recorrente a conteúdo ou plataforma",
  COMUNIDADE: "Grupo de alunos com encontros e materiais",
  EVENTO: "Workshop, masterclass, encontro presencial ou online",
  CONSULTORIA: "Serviço sob demanda, projeto específico",
  TREINAMENTO: "Capacitação corporativa ou turma fechada",
  PRODUTO_DIGITAL: "E-book, planilha, template, ferramenta",
  UPSELL: "Oferta após a compra principal",
  DOWNSELL: "Versão reduzida para quem não comprou a principal",
  ORDER_BUMP: "Adicional no checkout",
};

function parseN(s: string): number {
  return Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0;
}
function formatBR(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "0,00";
  return n.toFixed(decimals).replace(".", ",");
}
function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FormDrawer({
  open, onClose, initial, categories, costCenters,
}: { open: boolean; onClose: () => void; initial?: ProductRow | null; categories: Option[]; costCenters: Option[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertProduct, null);
  const [snapshot, setSnapshot] = useState(0);
  const [type, setType] = useState(initial?.type ?? "CURSO");
  const [billing, setBilling] = useState(initial?.billing ?? "UNICA");
  const [defaultPrice, setDefaultPrice] = useState(initial?.defaultPrice ?? "");
  const [estimatedCost, setEstimatedCost] = useState(initial?.estimatedCost ?? "");
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState(initial?.defaultCommissionPercent ?? "");
  const [accessDays, setAccessDays] = useState<string>(initial?.accessDurationDays?.toString() ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setSnapshot((s) => s + 1);
      setType(initial?.type ?? "CURSO");
      setBilling(initial?.billing ?? "UNICA");
      setDefaultPrice(initial?.defaultPrice ?? "");
      setEstimatedCost(initial?.estimatedCost ?? "");
      setDefaultCommissionPercent(initial?.defaultCommissionPercent ?? "");
      setAccessDays(initial?.accessDurationDays?.toString() ?? "");
      setShowAdvanced(!!(initial?.accessDurationDays || initial?.notes));
    }
  }, [open, initial]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  const priceN = parseN(defaultPrice);
  const costN = parseN(estimatedCost);
  const commissionPctN = parseN(defaultCommissionPercent);
  const commissionR$ = priceN > 0 && commissionPctN > 0 ? (priceN * commissionPctN) / 100 : 0;
  const marginAmountN = priceN - costN - commissionR$;
  const marginPctN = priceN > 0 ? (marginAmountN / priceN) * 100 : 0;
  const hasCost = costN > 0;

  return (
    <Drawer open={open} onClose={onClose} widthClass="max-w-3xl"
      title={initial ? "Editar produto" : "Novo produto"}
      description="Configure como o produto é vendido, custa e remunera o vendedor."
      footer={
        priceN > 0 ? (
          <p className="text-xs text-ink-subtle">
            Preço <span className="text-ink font-medium">{formatBRL(priceN)}</span>
            {commissionPctN > 0 && <> · Comissão <span className="text-info font-medium">{formatBRL(commissionR$)}</span></>}
            {hasCost && <> · Margem <span className={marginAmountN < 0 ? "text-danger font-medium" : "text-ok font-medium"}>{formatBRL(marginAmountN)}</span></>}
          </p>
        ) : <p className="text-xs text-ink-subtle">Preencha preço, custo e % de comissão pra ver margem ao vivo.</p>
      }
    >
      <form action={formAction} key={snapshot} className="space-y-6">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="billing" value={billing} />

        {state && !state.ok && <FormError message={state.error} />}

        {/* ── Identificação ─────────────────────── */}
        <Section icon={<Package className="h-4 w-4" />} title="Identificação" description="Como esse produto aparece pro vendedor e na contabilidade.">
          <Field label="Nome do produto" required error={fe("name")}>
            <TextInput
              name="name" defaultValue={initial?.name ?? ""} required autoFocus
              placeholder="Ex.: Mentoria Trekker, Universidade do Turismo, Workshop Curitiba"
              className="text-base"
            />
          </Field>
          <Field label="Descrição curta" hint="1-2 linhas que expliquem a oferta. Aparece no detalhe da venda.">
            <TextArea name="description" defaultValue={initial?.description ?? ""}
              placeholder="Ex.: Mentoria de 6 meses com encontros quinzenais e acesso à comunidade." />
          </Field>
        </Section>

        {/* ── Tipo de oferta ─────────────────────── */}
        <Section icon={<Tag className="h-4 w-4" />} title="Tipo de oferta" description="Qual é o formato. Pode ser alterado depois.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(productTypeLabel).map(([v, l]) => {
              const Icon = typeIcons[v] ?? Package;
              const active = type === v;
              return (
                <button
                  key={v} type="button" onClick={() => setType(v)}
                  className={cn(
                    "flex items-start gap-2 rounded-lg ring-1 px-3 py-2.5 text-left transition",
                    active ? "ring-brand-500/60 bg-brand-soft text-ink" : "ring-line bg-bg-elev/40 text-ink-muted hover:text-ink hover:ring-line/80",
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", active ? "text-magenta-400" : "text-ink-subtle")} />
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", active ? "text-ink" : "")}>{l}</p>
                    <p className="text-[11px] text-ink-subtle mt-0.5 line-clamp-2">{typeHints[v]}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Modelo de cobrança ─────────────────── */}
        <Section icon={<Repeat className="h-4 w-4" />} title="Modelo de cobrança" description="Como o cliente paga.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <BillingChoice
              active={billing === "UNICA"} onClick={() => setBilling("UNICA")}
              title="Pagamento único"
              hint="Uma venda, com ou sem parcelamento. Boa pra cursos, mentorias, eventos."
              icon={<Zap className="h-4 w-4" />}
            />
            <BillingChoice
              active={billing === "RECORRENTE"} onClick={() => setBilling("RECORRENTE")}
              title="Recorrente / Assinatura"
              hint="Cobrado periodicamente. Boa pra comunidades, planos mensais, plataformas."
              icon={<Repeat className="h-4 w-4" />}
            />
          </div>
          {billing === "RECORRENTE" && (
            <div className="mt-2 rounded-md bg-info/10 ring-1 ring-info/30 text-info px-3 py-2 text-xs flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>A periodicidade (mensal, trimestral, etc.) é definida ao criar a <strong>assinatura</strong> do cliente.</span>
            </div>
          )}
        </Section>

        {/* ── Financeiro ─────────────────────────── */}
        <Section icon={<CircleDollarSign className="h-4 w-4" />} title="Financeiro" description="Preço, custo operacional e comissão padrão para o vendedor.">
          <FormGrid cols={2}>
            <Field label="Preço padrão" required error={fe("defaultPrice")}>
              <TextInput
                name="defaultPrice" required value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="0,00" inputMode="decimal" prefix="R$"
              />
            </Field>
            <Field label="Custo operacional estimado" error={fe("estimatedCost")} hint="Custo direto por unidade (opcional).">
              <TextInput
                name="estimatedCost" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0,00" inputMode="decimal" prefix="R$"
              />
            </Field>
            <Field label="Comissão padrão" error={fe("defaultCommissionPercent")} hint="Sobre o valor líquido. Pode ser sobrescrita por venda.">
              <TextInput
                name="defaultCommissionPercent" value={defaultCommissionPercent} onChange={(e) => setDefaultCommissionPercent(e.target.value)}
                placeholder="0" inputMode="decimal" suffix="%"
              />
            </Field>
            <Field label="Margem estimada" hint={hasCost ? "Calculada automaticamente." : "Informe o custo pra calcular."} error={fe("estimatedMargin")}>
              <TextInput
                name="estimatedMargin"
                value={hasCost && priceN > 0 ? formatBR(marginPctN) : ""}
                readOnly suffix="%"
                className="bg-bg-elev/40 text-ink-muted cursor-not-allowed"
                placeholder="—"
              />
            </Field>
          </FormGrid>

          {priceN > 0 && (
            <div className="rounded-lg ring-1 ring-line bg-bg-soft/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Stat label="Preço de venda" value={formatBRL(priceN)} tone="brand" />
              <Stat label="Comissão (R$)" value={commissionPctN > 0 ? formatBRL(commissionR$) : "—"} tone="info" />
              <Stat label="Custo" value={hasCost ? formatBRL(costN) : "—"} tone="muted" />
              <Stat
                label="Margem por venda"
                value={hasCost ? `${formatBRL(marginAmountN)} · ${formatBR(marginPctN, 1)}%` : "—"}
                tone={hasCost ? (marginPctN >= 30 ? "ok" : marginPctN >= 0 ? "warn" : "danger") : "muted"}
              />
            </div>
          )}
        </Section>

        {/* ── Contábil ───────────────────────────── */}
        <Section icon={<Building2 className="h-4 w-4" />} title="Classificação contábil" description="Onde a receita aparece na DRE e nos relatórios.">
          <FormGrid cols={2}>
            <Field label="Categoria financeira" error={fe("categoryId")} hint="Receita de qual categoria?">
              <Select name="categoryId" defaultValue={initial?.categoryId ?? ""}>
                <option value="">— sem categoria —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Centro de custo" error={fe("costCenterId")} hint="Área responsável por entregar.">
              <Select name="costCenterId" defaultValue={initial?.costCenterId ?? ""}>
                <option value="">— sem centro —</option>
                {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </FormGrid>
        </Section>

        {/* ── Avançado ───────────────────────────── */}
        <div>
          <button
            type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurações avançadas
            <ChevronDown className={cn("h-3.5 w-3.5 transition", showAdvanced && "rotate-180")} />
          </button>
          {showAdvanced && (
            <Section icon={<Layers className="h-4 w-4" />} title="Configurações avançadas" description="Validade de acesso e observações internas." compact>
              <Field label="Validade de acesso" error={fe("accessDurationDays")} hint="Em dias. Deixe vazio se for vitalício.">
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    { label: "30 dias", days: "30" },
                    { label: "90 dias", days: "90" },
                    { label: "6 meses", days: "180" },
                    { label: "1 ano", days: "365" },
                    { label: "Vitalício", days: "" },
                  ].map((p) => (
                    <button
                      key={p.label} type="button" onClick={() => setAccessDays(p.days)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs ring-1",
                        accessDays === p.days ? "bg-brand-soft text-ink ring-brand-500/40" : "bg-bg-elev text-ink-muted ring-line hover:text-ink",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <TextInput
                  type="number" name="accessDurationDays" value={accessDays}
                  onChange={(e) => setAccessDays(e.target.value)}
                  placeholder="365" suffix="dias"
                />
              </Field>
              <Field label="Observações internas" hint="Não aparece na venda.">
                <TextArea name="notes" defaultValue={initial?.notes ?? ""} placeholder="Notas pro time, regras especiais, etc." />
              </Field>
            </Section>
          )}
        </div>

        <FormFooter onCancel={onClose} submitting={pending} submitLabel={initial ? "Salvar alterações" : "Criar produto"} />
      </form>
    </Drawer>
  );
}

function Section({ icon, title, description, children, compact }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className={cn("space-y-3", compact ? "mt-3" : "")}>
      <div className="flex items-start gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30 shrink-0">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-ink leading-tight">{title}</h3>
          {description && <p className="text-xs text-ink-subtle mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="pl-9 space-y-3">{children}</div>
    </section>
  );
}

function BillingChoice({ active, onClick, title, hint, icon }: { active: boolean; onClick: () => void; title: string; hint: string; icon: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg ring-1 px-4 py-3 text-left transition",
        active ? "ring-brand-500/60 bg-brand-soft text-ink" : "ring-line bg-bg-elev/40 text-ink-muted hover:text-ink hover:ring-line/80",
      )}
    >
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-md shrink-0", active ? "bg-bg-card text-magenta-400 ring-1 ring-brand-500/30" : "bg-bg-elev text-ink-subtle")}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", active ? "text-ink" : "")}>{title}</p>
        <p className="text-xs text-ink-subtle mt-0.5">{hint}</p>
      </div>
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "brand" | "ok" | "warn" | "danger" | "info" | "muted" }) {
  const cls = {
    brand: "text-magenta-400",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    info: "text-info",
    muted: "text-ink-muted",
  }[tone];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-ink-subtle">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold", cls)}>{value}</p>
    </div>
  );
}

export function NewButton({ categories, costCenters }: { categories: Option[]; costCenters: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo produto
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} categories={categories} costCenters={costCenters} />
    </>
  );
}

export function RowActions({ row, categories, costCenters }: { row: ProductRow; categories: Option[]; costCenters: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <button className="btn-ghost p-1.5" onClick={() => setOpen(true)} title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
      <button className="btn-ghost p-1.5" title={row.active ? "Desativar" : "Reativar"} disabled={pending}
        onClick={() => start(async () => { await toggleProductActive(row.id); })}>
        <Power className="h-3.5 w-3.5" />
      </button>
      <FormDrawer open={open} onClose={() => setOpen(false)} initial={row} categories={categories} costCenters={costCenters} />
    </div>
  );
}
