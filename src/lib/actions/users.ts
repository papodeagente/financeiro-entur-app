"use server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole, requireSession } from "@/lib/session";
import { ok, fail, safeParseForm, type ActionResult } from "@/lib/action-result";
import { sendEmail, inviteTemplate, resetTemplate } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";

function token() { return randomBytes(24).toString("base64url"); }
function baseUrl() { return process.env.NEXTAUTH_URL ?? "http://localhost:3000"; }

// ─── Convite de usuário ───────────────────
const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nome muito curto"),
  role: z.enum(["ADMIN", "FINANCEIRO", "COMERCIAL", "GESTOR", "CONSULTOR", "READONLY"]),
});

export async function inviteUser(_: ActionResult<{ acceptUrl: string; emailSent: boolean }> | null, formData: FormData): Promise<ActionResult<{ acceptUrl: string; emailSent: boolean }>> {
  const session = await requireRole(["ADMIN"]);
  const parsed = safeParseForm<typeof inviteSchema, { acceptUrl: string; emailSent: boolean }>(inviteSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { email, name, role } = parsed.data;

  const lowerEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
  if (existing) return fail("Já existe usuário com este email.");

  const inv = await prisma.invitation.create({
    data: {
      email: lowerEmail, name, role, token: token(),
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const acceptUrl = `${baseUrl()}/aceitar-convite/${inv.token}`;
  const result = await sendEmail({
    to: lowerEmail,
    subject: "Convite para o Financeiro ENTUR",
    html: inviteTemplate(name, role, acceptUrl),
  });
  revalidatePath("/configuracoes/usuarios");
  return ok({ acceptUrl, emailSent: result.sent });
}

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function acceptInvitation(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = safeParseForm(acceptInviteSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { token: t, password } = parsed.data;

  const inv = await prisma.invitation.findUnique({ where: { token: t } });
  if (!inv) return fail("Convite inválido.");
  if (inv.acceptedAt) return fail("Convite já foi usado.");
  if (inv.expiresAt < new Date()) return fail("Convite expirou. Peça um novo.");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: { email: inv.email, name: inv.name, role: inv.role, passwordHash, active: true },
    });
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  });
  return ok();
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);
  await prisma.invitation.update({ where: { id }, data: { expiresAt: new Date(0) } });
  revalidatePath("/configuracoes/usuarios");
  return ok();
}

export async function toggleUserActive(id: string): Promise<ActionResult> {
  const session = await requireRole(["ADMIN"]);
  if (id === session.user.id) return fail("Você não pode desativar sua própria conta.");
  const u = await prisma.user.findUnique({ where: { id }, select: { active: true } });
  if (!u) return fail("Usuário não encontrado.");
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/configuracoes/usuarios");
  return ok();
}

// ─── Reset de senha ───────────────────────
const requestResetSchema = z.object({ email: z.string().email() });

export async function requestPasswordReset(_: ActionResult<{ resetUrl?: string; emailSent: boolean }> | null, formData: FormData): Promise<ActionResult<{ resetUrl?: string; emailSent: boolean }>> {
  const parsed = safeParseForm<typeof requestResetSchema, { resetUrl?: string; emailSent: boolean }>(requestResetSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Sempre responde sucesso pra não vazar enumeração
  if (!user || !user.active) return ok({ emailSent: false });
  const t = await prisma.passwordResetToken.create({
    data: { userId: user.id, token: token(), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const resetUrl = `${baseUrl()}/redefinir-senha/${t.token}`;
  const result = await sendEmail({ to: user.email, subject: "Redefinir senha", html: resetTemplate(user.name, resetUrl) });
  return ok({ resetUrl: result.sent ? undefined : resetUrl, emailSent: result.sent });
}

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function completePasswordReset(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = safeParseForm(resetSchema, formData);
  if (!parsed.ok) return parsed.result;
  const { token: t, password } = parsed.data;
  const row = await prisma.passwordResetToken.findUnique({ where: { token: t }, include: { user: true } });
  if (!row) return fail("Token inválido.");
  if (row.usedAt) return fail("Token já foi usado.");
  if (row.expiresAt < new Date()) return fail("Token expirou.");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  });
  return ok();
}

// ─── Trocar senha (autenticado) ────────────
const changeSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export async function changePassword(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = safeParseForm(changeSchema, formData);
  if (!parsed.ok) return parsed.result;
  const u = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!u) return fail("Sessão inválida.");
  const ok2 = await bcrypt.compare(parsed.data.currentPassword, u.passwordHash);
  if (!ok2) return fail("Senha atual incorreta.");
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash } });
  return ok();
}

// ─── Metas de venda ────────────────────────
const goalSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, "Selecione um vendedor"),
  year: z.string().transform((s) => parseInt(s, 10)),
  month: z.string().transform((s) => parseInt(s, 10)),
  targetAmount: z.string().transform((s) => Number(s.replace(/\./g, "").replace(",", ".")) || 0),
  targetSales: z.string().optional().transform((s) => {
    if (!s) return undefined;
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }),
});

export async function upsertGoal(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(["ADMIN", "GESTOR"] as UserRole[]);
  const parsed = safeParseForm(goalSchema, formData);
  if (!parsed.ok) return parsed.result;
  const d = parsed.data;
  try {
    await prisma.salesGoal.upsert({
      where: { userId_year_month: { userId: d.userId, year: d.year, month: d.month } },
      create: { userId: d.userId, year: d.year, month: d.month, targetAmount: d.targetAmount, targetSales: d.targetSales },
      update: { targetAmount: d.targetAmount, targetSales: d.targetSales },
    });
  } catch {
    return fail("Erro ao salvar meta.");
  }
  revalidatePath("/configuracoes/metas");
  revalidatePath("/dashboard");
  return ok();
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  await requireRole(["ADMIN", "GESTOR"] as UserRole[]);
  await prisma.salesGoal.delete({ where: { id } });
  revalidatePath("/configuracoes/metas");
  return ok();
}
