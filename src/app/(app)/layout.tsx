import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

const labelByPath: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/receitas": "Receitas",
  "/despesas": "Despesas",
  "/contas-a-receber": "Contas a receber",
  "/contas-a-pagar": "Contas a pagar",
  "/clientes": "Clientes / Alunos",
  "/produtos": "Produtos & Ofertas",
  "/assinaturas": "Assinaturas",
  "/parcelamentos": "Parcelamentos",
  "/inadimplencia": "Inadimplência",
  "/comissoes": "Comissões",
  "/fornecedores": "Fornecedores",
  "/categorias": "Categorias",
  "/centros-de-custo": "Centros de custo",
  "/contas-bancarias": "Contas bancárias",
  "/conciliacao": "Conciliação",
  "/dre": "DRE gerencial",
  "/fluxo-de-caixa": "Fluxo de caixa",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header title="Visão geral" />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

export { labelByPath };
