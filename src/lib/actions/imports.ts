"use server";
import { prisma } from "@/lib/db";
import { requireWrite } from "@/lib/session";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";

export type CustomerCsvRow = {
  nome: string;
  email?: string;
  telefone?: string;
  documento?: string;
  empresa?: string;
  status?: string;
};

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Remove BOM e normaliza quebras
  const cleaned = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  // Detect separator: prefer ; over ,
  const firstLine = lines[0];
  const sep = firstLine.includes(";") ? ";" : ",";
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === sep) { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

const customerStatusMap: Record<string, string> = {
  "ativo": "ATIVO", "adimplente": "ATIVO",
  "inadimplente": "INADIMPLENTE",
  "em negociacao": "EM_NEGOCIACAO", "em negociação": "EM_NEGOCIACAO",
  "cancelado": "CANCELADO",
  "reembolsado": "REEMBOLSADO",
  "ex-aluno": "EX_ALUNO", "ex aluno": "EX_ALUNO",
};

export type CsvParseResult = {
  preview: CustomerCsvRow[];
  totalRows: number;
  errors: { row: number; message: string }[];
};

export async function parseCustomersCsv(_: ActionResult<CsvParseResult> | null, formData: FormData): Promise<ActionResult<CsvParseResult>> {
  await requireWrite();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Selecione um arquivo CSV.");
  if (file.size > 5 * 1024 * 1024) return fail("Arquivo grande demais (limite 5MB).");

  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  if (!headers.includes("nome")) {
    return fail(`Coluna obrigatória 'nome' não encontrada. Cabeçalhos lidos: ${headers.join(", ")}`);
  }

  const colIndex = (name: string) => headers.indexOf(name);
  const idxNome = colIndex("nome");
  const idxEmail = colIndex("email");
  const idxTel = colIndex("telefone");
  const idxDoc = colIndex("documento");
  const idxEmpresa = colIndex("empresa");
  const idxStatus = colIndex("status");

  const errors: { row: number; message: string }[] = [];
  const out: CustomerCsvRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nome = (r[idxNome] ?? "").trim();
    if (!nome) { errors.push({ row: i + 2, message: "Nome vazio" }); continue; }
    out.push({
      nome,
      email: idxEmail >= 0 ? r[idxEmail]?.trim() || undefined : undefined,
      telefone: idxTel >= 0 ? r[idxTel]?.trim() || undefined : undefined,
      documento: idxDoc >= 0 ? r[idxDoc]?.trim() || undefined : undefined,
      empresa: idxEmpresa >= 0 ? r[idxEmpresa]?.trim() || undefined : undefined,
      status: idxStatus >= 0 ? r[idxStatus]?.trim() || undefined : undefined,
    });
  }

  return ok({ preview: out.slice(0, 100), totalRows: out.length, errors });
}

export async function importCustomers(rows: CustomerCsvRow[]): Promise<ActionResult<{ created: number }>> {
  await requireWrite();
  let created = 0;
  for (const r of rows) {
    const status = (r.status && customerStatusMap[r.status.toLowerCase()]) ?? "ATIVO";
    try {
      await prisma.customer.create({
        data: {
          name: r.nome,
          email: r.email || null,
          phone: r.telefone || null,
          document: r.documento || null,
          company: r.empresa || null,
          status: status as "ATIVO",
        },
      });
      created++;
    } catch { /* skip duplicate or invalid */ }
  }
  revalidatePath("/clientes");
  return ok({ created });
}
