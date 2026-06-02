import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { ImportClientes } from "./_components/import-form";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <PageShell
      title="Importar clientes via CSV"
      description="Cadastro em massa de alunos. Colunas aceitas: nome (obrigatória), email, telefone, documento, empresa, status."
    >
      <Link href="/relatorios" className="btn-ghost text-sm">
        <ArrowLeft className="h-4 w-4" /> Todos os relatórios
      </Link>
      <ImportClientes />
      <div className="card-soft p-4">
        <h3 className="text-xs uppercase tracking-widest text-ink-subtle font-semibold mb-2">Exemplo de cabeçalho</h3>
        <pre className="text-xs text-ink-muted overflow-x-auto"><code>nome;email;telefone;documento;empresa;status{"\n"}Joana Silva;joana@example.com;+55 11 99999-0001;123.456.789-00;Acme;Ativo</code></pre>
        <p className="mt-3 text-xs text-ink-subtle">Status aceitos: <code>Ativo</code>, <code>Inadimplente</code>, <code>Em negociação</code>, <code>Cancelado</code>, <code>Reembolsado</code>, <code>Ex-aluno</code>. Padrão: <code>Ativo</code>.</p>
      </div>
    </PageShell>
  );
}
