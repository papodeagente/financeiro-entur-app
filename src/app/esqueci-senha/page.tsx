import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { RequestForm } from "./_components/form";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-40 h-12">
              <Image src="https://entur.ia.br/logo.png" alt="ENTUR" fill className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-center text-lg font-semibold text-ink">Esqueceu sua senha?</h1>
          <p className="text-center text-sm text-ink-muted mt-1">Vamos te mandar um link de redefinição.</p>
          <Suspense fallback={null}><RequestForm /></Suspense>
          <Link href="/login" className="block text-center mt-4 text-xs text-ink-muted hover:text-ink">← Voltar pro login</Link>
        </div>
      </div>
    </div>
  );
}
