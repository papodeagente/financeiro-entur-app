import { PrismaClient, CategoryKind, BankAccountType, ProductType, ProductBilling } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "bruno@entur.com.br").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Bruna2016*";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Bruno Barbosa";

  // ── Admin user ─────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: "ADMIN", active: true, name: adminName },
    create: { email: adminEmail, name: adminName, passwordHash, role: "ADMIN", active: true },
  });
  console.log(`✔ admin: ${adminEmail}`);

  // ── Métodos de pagamento ───────────────────────────────────────
  const paymentMethods = ["PIX", "Cartão de crédito", "Boleto", "Transferência", "Cartão de débito", "Dinheiro"];
  for (const name of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✔ payment methods: ${paymentMethods.length}`);

  // ── Centros de custo ──────────────────────────────────────────
  const costCenters = [
    "Comercial", "Marketing", "Operação", "Produto", "Suporte",
    "Eventos", "Tecnologia", "Administrativo", "Mentorias", "Comunidade",
    "Conteúdo", "Tráfego Pago",
  ];
  for (const name of costCenters) {
    await prisma.costCenter.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✔ cost centers: ${costCenters.length}`);

  // ── Categorias financeiras ─────────────────────────────────────
  const revenueCats = [
    "Cursos online", "Mentorias", "Assinaturas", "Comunidade", "Eventos",
    "Consultorias", "Treinamentos corporativos", "Produtos digitais",
    "Upsell", "Downsell", "Afiliados", "Patrocínios",
  ];
  const expenseCats = [
    "Equipe", "Ferramentas", "Marketing", "Tráfego pago", "Produção de conteúdo",
    "Impostos", "Comissões", "Eventos", "Plataformas", "Contabilidade",
    "Jurídico", "Infraestrutura", "Suporte", "Reembolsos", "Taxas financeiras",
  ];
  for (const name of revenueCats) {
    await prisma.financialCategory.upsert({
      where: { name_kind: { name, kind: CategoryKind.RECEITA } },
      update: {}, create: { name, kind: CategoryKind.RECEITA },
    });
  }
  for (const name of expenseCats) {
    await prisma.financialCategory.upsert({
      where: { name_kind: { name, kind: CategoryKind.DESPESA } },
      update: {}, create: { name, kind: CategoryKind.DESPESA },
    });
  }
  console.log(`✔ categorias: ${revenueCats.length} receita + ${expenseCats.length} despesa`);

  // ── Contas bancárias exemplo ────────────────────────────────────
  const bankAccounts: { name: string; type: BankAccountType; bank?: string }[] = [
    { name: "Caixa interno", type: "CAIXA_INTERNO" },
    { name: "Itaú PJ — Principal", type: "CORRENTE", bank: "Itaú" },
    { name: "Asaas (gateway)", type: "GATEWAY", bank: "Asaas" },
    { name: "Stripe (gateway)", type: "GATEWAY", bank: "Stripe" },
  ];
  for (const a of bankAccounts) {
    const exists = await prisma.bankAccount.findFirst({ where: { name: a.name, deletedAt: null } });
    if (!exists) await prisma.bankAccount.create({ data: { ...a, openingBalance: 0, currentBalance: 0 } });
  }
  console.log(`✔ contas bancárias: ${bankAccounts.length}`);

  // ── Produtos ENTUR ─────────────────────────────────────────────
  type Prod = { name: string; type: ProductType; billing: ProductBilling; defaultPrice: number; defaultCommissionPercent?: number; centro?: string };
  const produtos: Prod[] = [
    { name: "Universidade Corporativa do Turismo", type: "TREINAMENTO", billing: "UNICA", defaultPrice: 25000, defaultCommissionPercent: 10, centro: "Treinamentos" },
    { name: "Mentoria Trekker", type: "MENTORIA", billing: "UNICA", defaultPrice: 20000, defaultCommissionPercent: 15, centro: "Mentorias" },
    { name: "Formação Agente Independente", type: "CURSO", billing: "UNICA", defaultPrice: 3997, defaultCommissionPercent: 20, centro: "Produto" },
    { name: "Comunidade OSA", type: "COMUNIDADE", billing: "RECORRENTE", defaultPrice: 197, defaultCommissionPercent: 0, centro: "Comunidade" },
    { name: "Sirius", type: "ASSINATURA", billing: "RECORRENTE", defaultPrice: 497, defaultCommissionPercent: 10, centro: "Produto" },
    { name: "Workshop presencial", type: "EVENTO", billing: "UNICA", defaultPrice: 997, defaultCommissionPercent: 10, centro: "Eventos" },
    { name: "Consultoria estratégica", type: "CONSULTORIA", billing: "UNICA", defaultPrice: 8000, defaultCommissionPercent: 15, centro: "Operação" },
  ];

  const cursosCat = await prisma.financialCategory.findUnique({ where: { name_kind: { name: "Cursos online", kind: "RECEITA" } } });

  for (const p of produtos) {
    const existing = await prisma.product.findFirst({ where: { name: p.name, deletedAt: null } });
    if (existing) continue;
    const centro = p.centro ? await prisma.costCenter.findUnique({ where: { name: p.centro } }) : null;
    await prisma.product.create({
      data: {
        name: p.name,
        type: p.type,
        billing: p.billing,
        defaultPrice: p.defaultPrice,
        defaultCommissionPercent: p.defaultCommissionPercent,
        categoryId: cursosCat?.id,
        costCenterId: centro?.id,
        active: true,
      },
    });
  }
  console.log(`✔ produtos: ${produtos.length}`);

  // ── Fornecedores exemplo ───────────────────────────────────────
  const fornecedores = [
    { name: "Google Ads", category: "Tráfego pago" },
    { name: "Meta Ads", category: "Tráfego pago" },
    { name: "Hotmart", category: "Plataformas" },
    { name: "Asaas", category: "Plataformas" },
    { name: "Stripe", category: "Plataformas" },
    { name: "Notion", category: "Ferramentas" },
    { name: "Vercel", category: "Infraestrutura" },
    { name: "Contador parceiro", category: "Contabilidade" },
  ];
  for (const f of fornecedores) {
    const exists = await prisma.supplier.findFirst({ where: { name: f.name, deletedAt: null } });
    if (!exists) await prisma.supplier.create({ data: f });
  }
  console.log(`✔ fornecedores: ${fornecedores.length}`);

  console.log("\n✔ Seed concluído.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
