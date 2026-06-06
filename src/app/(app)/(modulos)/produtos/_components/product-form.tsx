"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package, GraduationCap, Users, Calendar, Briefcase, Sparkles,
  ShoppingBag, Zap, ArrowUp, ArrowDown, Layers, Tag, Building2, Settings, Repeat,
  CircleDollarSign, ChevronDown, Info, ArrowLeft, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Field, TextInput, TextArea, Select, FormGrid } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-actions";
import { upsertProduct } from "@/lib/actions/products";
import { productTypeLabel } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";
import type { ProductRow, Option } from "./form";

const typeIcons: Record<string, typeof Package> = {
  CURSO: GraduationCap, MENTORIA: Sparkles, ASSINATURA: Repeat, COMUNIDADE: Users,
  EVENTO: Calendar, CONSULTORIA: Briefcase, TREINAMENTO: GraduationCap,
  PRODUTO_DIGITAL: Package, UPSELL: ArrowUp, DOWNSELL: ArrowDown, ORDER_BUMP: ShoppingBag,
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

const parseN = (s: string) => Number((s || "0").replace(/\./g, "").replace(",", ".")) || 0;
const formatBR = (n: number, d = 2) => Number.isFinite(n) ? n.toFixed(d).replace(".", ",") : "0,00";
const formatBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProductForm({
  initial, categories, costCenters,
}: { initial?: ProductRow | null; categories: Option[]; costCenters: Option[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(upsertProduct, null);
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState(initial?.type ?? "CURSO");
  const [billing, setBilling] = useState(initial?.billing ?? "UNICA");
  const [defaultPrice, setDefaultPrice] = useState(initial?.defaultPrice ?? "");
  const [estimatedCost, setEstimatedCost] = useState(initial?.estimatedCost ?? "");
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState(initial?.defaultCommissionPercent ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [costCenterId, setCostCenterId] = useState(initial?.costCenterId ?? "");
  const [accessDays, setAccessDays] = useState<string>(initial?.accessDurationDays?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showAdvanced, setShowAdvanced] = useState(!!(initial?.accessDurationDays || initial?.notes));
  const [isDirty, setIsDirty] = useState(false);

  // Marca dirty na primeira alteração
  useEffect(() => { setIsDirty(true); }, [name, description, type, billing, defaultPrice, estimatedCost, defaultCommissionPercent, categoryId, costCenterId, accessDays, notes]);
  useEffect(() => { setIsDirty(false); }, []);

  // Aviso ao sair sem salvar
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Atalho Ctrl+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (state?.ok) {
      setIsDirty(false);
      router.push("/produtos");
    }
  }, [state, router]);

  const fe = (k: string) => !state?.ok && state ? state.fieldErrors?.[k]?.[0] : undefined;

  const priceN = parseN(defaultPrice);
  const costN = parseN(estimatedCost);
  const commissionPctN = parseN(defaultCommissionPercent);
  const commissionR$ = priceN > 0 && commissionPctN > 0 ? (priceN * commissionPctN) / 100 : 0;
  const marginAmountN = priceN - costN - commissionR$;
  const marginPctN = priceN > 0 ? (marginAmountN / priceN) * 100 : 0;
  const hasCost = costN > 0;
  const hasName = name.trim().length >= 2;
  const hasPrice = priceN > 0;

  const sectionStatus = {
    identification: hasName,
    type: !!type,
    billing: !!billing,
    financial: hasPrice,
    accounting: !!(categoryId || costCenterId),
  };

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 border-b border-line bg-bg/85 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/produtos" className="btn-ghost p-1.5"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-ink-subtle">{initial ? "Editar produto" : "Novo produto"}</p>
            <h2 className="text-sm font-semibold text-ink truncate">{name || (initial ? "Sem nome" : "Novo produto")}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && <span className="hidden sm:inline-flex text-[11px] text-warn items-center gap-1"><AlertCircle className="h-3 w-3" /> Alterações não salvas</span>}
          <Link href="/produtos" className="btn-secondary">Cancelar</Link>
          <button type="submit" form="product-form" className="btn-primary" disabled={pending || !hasName || !hasPrice}>
            {pending ? "Salvando…" : initial ? "Salvar alterações" : "Criar produto"}
          </button>
        </div>
      </div>

      <form id="product-form" ref={formRef} action={formAction} className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        {initial?.id && <input type="hidden" name="id" defaultValue={initial.id} />}
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="billing" value={billing} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="costCenterId" value={costCenterId} />

        {/* Main column */}
        <div className="xl:col-span-7 space-y-6">
          {state && !state.ok && <FormError message={state.error} />}

          <Section icon={<Package className="h-4 w-4" />} title="Identificação" description="Como esse produto aparece pro vendedor." done={sectionStatus.identification}>
            <Field label="Nome do produto" required error={fe("name")}>
              <TextInput
                name="name" required autoFocus
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Mentoria Trekker, Universidade do Turismo, Workshop Curitiba"
                className="text-base"
              />
            </Field>
            <Field label="Descrição curta" hint="Aparece no detalhe da venda.">
              <TextArea name="description" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Mentoria de 6 meses com encontros quinzenais e acesso à comunidade." />
            </Field>
          </Section>

          <Section icon={<Tag className="h-4 w-4" />} title="Tipo de oferta" description="Qual é o formato.">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

          <Section icon={<CircleDollarSign className="h-4 w-4" />} title="Financeiro" description="Preço, custo e comissão padrão." done={sectionStatus.financial}>
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
              <Field label="Comissão padrão" error={fe("defaultCommissionPercent")} hint="Sobre o valor líquido.">
                <TextInput
                  name="defaultCommissionPercent" value={defaultCommissionPercent} onChange={(e) => setDefaultCommissionPercent(e.target.value)}
                  placeholder="0" inputMode="decimal" suffix="%"
                />
              </Field>
              <Field label="Margem estimada" hint={hasCost ? "Calculada automaticamente." : "Preencha o custo pra calcular."}>
                <TextInput
                  name="estimatedMargin"
                  value={hasCost && priceN > 0 ? formatBR(marginPctN) : ""}
                  readOnly suffix="%"
                  className="bg-bg-elev/40 text-ink-muted cursor-not-allowed"
                  placeholder="—"
                />
              </Field>
            </FormGrid>
          </Section>

          <Section icon={<Building2 className="h-4 w-4" />} title="Classificação contábil" description="Onde a receita aparece na DRE." done={sectionStatus.accounting}>
            <FormGrid cols={2}>
              <Field label="Categoria financeira" error={fe("categoryId")}>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— sem categoria —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Centro de custo" error={fe("costCenterId")}>
                <Select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
                  <option value="">— sem centro —</option>
                  {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </FormGrid>
          </Section>

          <div>
            <button
              type="button" onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink"
            >
              <Settings className="h-3.5 w-3.5" /> Configurações avançadas
              <ChevronDown className={cn("h-3.5 w-3.5 transition", showAdvanced && "rotate-180")} />
            </button>
            {showAdvanced && (
              <Section icon={<Layers className="h-4 w-4" />} title="Configurações avançadas" description="Validade e observações.">
                <Field label="Validade de acesso" error={fe("accessDurationDays")} hint="Em dias. Vazio = vitalício.">
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
                  <TextArea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas pro time, regras especiais, etc." />
                </Field>
              </Section>
            )}
          </div>
        </div>

        {/* Side preview — sticky */}
        <aside className="xl:col-span-5">
          <div className="xl:sticky xl:top-24 space-y-4">
            {/* Preview hero */}
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest text-ink-subtle font-semibold">Pré-visualização</p>
                {(() => {
                  const Icon = typeIcons[type] ?? Package;
                  return (
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30">
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                })()}
              </div>
              <p className="mt-2 text-base font-semibold text-ink truncate">{name || "Novo produto"}</p>
              <p className="text-xs text-ink-muted mt-0.5">{productTypeLabel[type]} · {billing === "UNICA" ? "Pagamento único" : "Recorrente"}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <PreviewStat label="Preço" value={hasPrice ? formatBRL(priceN) : "—"} tone="brand" />
                <PreviewStat label="Comissão" value={commissionPctN > 0 ? `${formatBR(commissionPctN, 1)}%` : "—"} sub={commissionPctN > 0 && hasPrice ? formatBRL(commissionR$) : undefined} tone="info" />
                <PreviewStat label="Custo" value={hasCost ? formatBRL(costN) : "—"} tone="muted" />
                <PreviewStat
                  label="Margem"
                  value={hasCost && hasPrice ? `${formatBR(marginPctN, 1)}%` : "—"}
                  sub={hasCost && hasPrice ? formatBRL(marginAmountN) : undefined}
                  tone={hasCost && hasPrice ? (marginPctN >= 30 ? "ok" : marginPctN >= 0 ? "warn" : "danger") : "muted"}
                />
              </div>

              {hasPrice && hasCost && marginPctN < 0 && (
                <div className="mt-4 rounded-md bg-danger/10 ring-1 ring-danger/30 text-danger px-3 py-2 text-xs flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Margem negativa: custo + comissão maiores que o preço. Revise.</span>
                </div>
              )}
            </div>

            {/* Checklist de campos */}
            <div className="card p-5 space-y-2.5">
              <p className="text-[11px] uppercase tracking-widest text-ink-subtle font-semibold mb-2">Checklist</p>
              <ChecklistItem ok={hasName} label="Nome preenchido" />
              <ChecklistItem ok={!!type} label="Tipo selecionado" />
              <ChecklistItem ok={!!billing} label="Cobrança definida" />
              <ChecklistItem ok={hasPrice} label="Preço informado" />
              <ChecklistItem ok={commissionPctN > 0} label="Comissão configurada" optional />
              <ChecklistItem ok={hasCost} label="Custo informado" optional />
              <ChecklistItem ok={!!categoryId || !!costCenterId} label="Categoria ou centro vinculado" optional />
            </div>

            <p className="text-[11px] text-ink-subtle text-center">
              Atalho: <kbd className="px-1.5 py-0.5 rounded bg-bg-elev text-[10px]">⌘/Ctrl + S</kbd> pra salvar.
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}

function Section({ icon, title, description, children, done }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30 shrink-0">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-ink leading-tight">{title}</h3>
            {description && <p className="text-xs text-ink-subtle mt-0.5">{description}</p>}
          </div>
        </div>
        {done !== undefined && (
          done
            ? <span className="inline-flex items-center gap-1 text-[11px] text-ok"><CheckCircle2 className="h-3 w-3" /> Pronto</span>
            : <span className="text-[11px] text-ink-subtle">Pendente</span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
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

function PreviewStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "brand" | "ok" | "warn" | "danger" | "info" | "muted" }) {
  const cls = {
    brand: "text-magenta-400", ok: "text-ok", warn: "text-warn",
    danger: "text-danger", info: "text-info", muted: "text-ink-muted",
  }[tone];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-ink-subtle">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", cls)}>{value}</p>
      {sub && <p className="text-[11px] text-ink-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

function ChecklistItem({ ok, label, optional }: { ok: boolean; label: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-ok shrink-0" />
      ) : (
        <span className={cn("h-3.5 w-3.5 rounded-full ring-1 shrink-0", optional ? "ring-line" : "ring-line")} />
      )}
      <span className={ok ? "text-ink" : "text-ink-muted"}>{label}</span>
      {optional && !ok && <span className="text-[10px] text-ink-subtle ml-auto">opcional</span>}
    </div>
  );
}
