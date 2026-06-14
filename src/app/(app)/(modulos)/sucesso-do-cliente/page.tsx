import { PageShell } from "@/components/layout/page-shell";
import { HelpdeskFrame } from "./_components/frame";
import { ExternalLink, Headphones, Inbox, Users, Zap, Github, Settings as SettingsIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default function Page() {
  const url = process.env.HELPDESK_URL?.trim();
  const configured = !!url && /^https?:\/\//i.test(url);

  if (configured) {
    return (
      <div className="px-6 py-6 h-[calc(100vh-3.5rem)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30">
              <Headphones className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink">Sucesso do cliente</h2>
              <p className="text-xs text-ink-subtle">Helpdesk Libredesk · inbox, tickets, atendimentos.</p>
            </div>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            <ExternalLink className="h-4 w-4" /> Abrir em nova aba
          </a>
        </div>
        <HelpdeskFrame url={url} />
      </div>
    );
  }

  return (
    <PageShell
      title="Sucesso do cliente"
      description="Canal de atendimento ao aluno integrado ao financeiro — para tickets, dúvidas, suporte, retenção e cobrança humanizada."
    >
      <div className="card p-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30">
          <Headphones className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-ink">Libredesk ainda não está configurado</h3>
        <p className="mt-2 text-sm text-ink-muted max-w-xl mx-auto">
          Vamos rodar o <strong className="text-ink">Libredesk</strong> (helpdesk open-source) num servidor próprio e plugar aqui.
          Quando estiver no ar, esta página vira um painel embarcado de atendimento.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <a href="https://github.com/abhinavxd/libredesk" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            <Github className="h-4 w-4" /> Ver repositório
          </a>
          <a href="https://libredesk.io" target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            <ExternalLink className="h-4 w-4" /> Site oficial
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Feature icon={<Inbox className="h-4 w-4" />} title="Inbox compartilhada" desc="Email, chat e WhatsApp num mesmo painel pro time de CS." />
        <Feature icon={<Users className="h-4 w-4" />} title="Tickets por aluno" desc="Conversas vinculadas ao cliente. Histórico unificado de atendimento." />
        <Feature icon={<Zap className="h-4 w-4" />} title="Automações" desc="Roteamento, SLA, respostas automáticas, follow-up de inadimplente." />
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-magenta-400" /> Como ativar
        </h3>
        <ol className="mt-3 space-y-3 text-sm text-ink-muted list-decimal pl-5">
          <li>Subir o Libredesk no Coolify (mesma infra do financeiro) — posso fazer isso pra você, é só pedir.</li>
          <li>
            Definir no ambiente desta app a variável <code className="px-1.5 py-0.5 rounded bg-bg-elev text-[11px] text-ink">HELPDESK_URL</code> apontando pra URL do Libredesk
            (ex.: <code className="px-1.5 py-0.5 rounded bg-bg-elev text-[11px] text-ink">https://helpdesk.entur.com.br</code>).
          </li>
          <li>Recarregar esta página — ela vira automaticamente um painel embarcado do helpdesk.</li>
        </ol>
        <p className="mt-4 text-xs text-ink-subtle">
          ⓘ Se o Libredesk bloquear o embed por política de segurança, esta página oferece um botão de &ldquo;Abrir em nova aba&rdquo; como fallback.
        </p>
      </div>
    </PageShell>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-magenta-400 ring-1 ring-brand-500/30">{icon}</span>
      <h4 className="mt-3 text-sm font-semibold text-ink">{title}</h4>
      <p className="mt-1 text-xs text-ink-muted">{desc}</p>
    </div>
  );
}
