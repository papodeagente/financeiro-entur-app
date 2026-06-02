"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) setError("Email ou senha inválidos.");
    else router.push(callbackUrl);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-40 h-12">
              <Image src="https://entur.ia.br/logo.png" alt="ENTUR" fill className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-center text-lg font-semibold text-ink">Sistema Financeiro</h1>
          <p className="text-center text-sm text-ink-muted mt-1">Entre com sua conta</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required autoFocus
                className="input mt-1"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@entur.com.br"
              />
            </div>
            <div>
              <label className="label">Senha</label>
              <input
                type="password" required
                className="input mt-1"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-ink-subtle">
          © ENTUR · Escola de Negócios do Turismo
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
