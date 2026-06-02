import { prisma } from "@/lib/db";
import Image from "next/image";
import { AcceptForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invitation.findUnique({ where: { token } });

  const invalid = !inv || inv.acceptedAt || inv.expiresAt < new Date();
  const reason = !inv ? "Convite não encontrado." : inv.acceptedAt ? "Convite já foi usado." : inv.expiresAt < new Date() ? "Convite expirou." : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-40 h-12">
              <Image src="https://entur.ia.br/logo.png" alt="ENTUR" fill className="object-contain" priority />
            </div>
          </div>
          {invalid ? (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">Convite indisponível</h1>
              <p className="text-center text-sm text-ink-muted mt-2">{reason}</p>
              <p className="text-center text-xs text-ink-subtle mt-6">Peça um novo convite ao administrador.</p>
            </>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">Bem-vindo, {inv.name}</h1>
              <p className="text-center text-sm text-ink-muted mt-1">Crie sua senha pra acessar como <strong className="text-magenta-400">{inv.role}</strong></p>
              <p className="text-center text-xs text-ink-subtle mt-1">Email: <strong>{inv.email}</strong></p>
              <AcceptForm token={token} />
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-ink-subtle">© ENTUR · Escola de Negócios do Turismo</p>
      </div>
    </div>
  );
}
