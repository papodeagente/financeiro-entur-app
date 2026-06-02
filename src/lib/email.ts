import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? "no-reply@entur.com.br";
const replyTo = process.env.RESEND_REPLY_TO ?? "financeiro@entur.com.br";

const client = apiKey ? new Resend(apiKey) : null;

export type EmailResult = { sent: boolean; reason?: string; id?: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  if (!client) {
    console.warn("[email] RESEND_API_KEY ausente — email não enviado.", { to: input.to, subject: input.subject });
    return { sent: false, reason: "no-key" };
  }
  try {
    const res = await client.emails.send({
      from: `ENTUR Financeiro <${from}>`,
      to: input.to,
      replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, ""),
    });
    if (res.error) {
      console.error("[email] Erro Resend:", res.error);
      return { sent: false, reason: res.error.message };
    }
    return { sent: true, id: res.data?.id };
  } catch (e) {
    console.error("[email] Falha ao enviar:", e);
    return { sent: false, reason: (e as Error).message };
  }
}

export const isEmailConfigured = () => !!apiKey;

// ── Templates ────────────────────────────
const baseHtml = (body: string) => `<!doctype html><html><body style="font-family:Inter,system-ui,sans-serif;background:#0B0820;color:#F5F3FF;margin:0;padding:40px 20px;">
<table align="center" style="max-width:560px;width:100%;background:#16113A;border-radius:16px;padding:32px;border:1px solid #2A2256">
<tr><td>
<div style="background:linear-gradient(135deg,#8B33F2 0%,#FF1AB5 100%);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700;font-size:18px;letter-spacing:2px">ENTUR</div>
<div style="color:#A9A2D6;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Financeiro</div>
<div style="margin-top:24px">${body}</div>
<hr style="margin-top:32px;border:none;border-top:1px solid #2A2256">
<p style="color:#7A73AE;font-size:11px;margin-top:16px">ENTUR · Escola de Negócios do Turismo</p>
</td></tr></table>
</body></html>`;

export const inviteTemplate = (name: string, role: string, acceptUrl: string) => baseHtml(`
<h2 style="color:#F5F3FF;font-size:18px;margin:0 0 8px">Olá, ${name}</h2>
<p style="color:#A9A2D6;font-size:14px;line-height:1.6">
Você foi convidado para o sistema financeiro da ENTUR como <strong style="color:#FF4DCB">${role}</strong>.
</p>
<p style="color:#A9A2D6;font-size:14px;line-height:1.6">Clique no botão abaixo pra criar sua senha e acessar a plataforma:</p>
<p style="margin:24px 0"><a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#8B33F2,#FF1AB5);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Aceitar convite</a></p>
<p style="color:#7A73AE;font-size:11px">Ou copie o link: ${acceptUrl}</p>
<p style="color:#7A73AE;font-size:11px;margin-top:16px">Este convite expira em 7 dias.</p>
`);

export const resetTemplate = (name: string, resetUrl: string) => baseHtml(`
<h2 style="color:#F5F3FF;font-size:18px;margin:0 0 8px">Olá, ${name}</h2>
<p style="color:#A9A2D6;font-size:14px;line-height:1.6">Recebemos uma solicitação para redefinir sua senha. Use o botão abaixo:</p>
<p style="margin:24px 0"><a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#8B33F2,#FF1AB5);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Redefinir senha</a></p>
<p style="color:#7A73AE;font-size:11px">Ou copie: ${resetUrl}</p>
<p style="color:#7A73AE;font-size:11px;margin-top:16px">Link válido por 1 hora. Se você não solicitou, ignore.</p>
`);
