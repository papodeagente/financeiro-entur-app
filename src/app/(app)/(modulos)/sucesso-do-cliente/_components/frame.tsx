"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

export function HelpdeskFrame({ url }: { url: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // Se o iframe não carregar em 8s, provavelmente está sendo bloqueado por X-Frame-Options/CSP
    const t = setTimeout(() => {
      if (!loaded) setBlocked(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [loaded]);

  if (blocked) {
    return (
      <div className="card flex-1 flex flex-col items-center justify-center text-center p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn/10 text-warn ring-1 ring-warn/30">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-base font-semibold text-ink">O helpdesk não permite ser embarcado</h3>
        <p className="mt-2 text-sm text-ink-muted max-w-md">
          O Libredesk está protegido por <code className="text-[11px] bg-bg-elev px-1.5 py-0.5 rounded">X-Frame-Options</code> e bloqueia a renderização em iframe.
          Você pode abrir em nova aba ou ajustar a configuração do helpdesk para liberar o domínio do financeiro.
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
          <ExternalLink className="h-4 w-4" /> Abrir helpdesk em nova aba
        </a>
      </div>
    );
  }

  return (
    <div className="card flex-1 overflow-hidden relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-ink-subtle text-sm">
          Carregando helpdesk…
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        title="Helpdesk Libredesk"
        className="w-full h-full border-0"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
