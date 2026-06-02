import { prisma } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { ResetForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await prisma.passwordResetToken.findUnique({ where: { token }, include: { user: { select: { name: true } } } });
  const invalid = !row || row.usedAt || row.expiresAt < new Date();

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
              <h1 className="text-center text-lg font-semibold text-ink">Link indisponível</h1>
              <p className="text-center text-sm text-ink-muted mt-2">
                {!row ? "Token inválido." : row.usedAt ? "Este link já foi usado." : "Token expirou."}
              </p>
              <Link href="/esqueci-senha" className="block text-center mt-6 btn-primary">Solicitar novo link</Link>
            </>
          ) : (
            <>
              <h1 className="text-center text-lg font-semibold text-ink">Crie sua nova senha</h1>
              <p className="text-center text-sm text-ink-muted mt-1">{row.user.name}</p>
              <ResetForm token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
