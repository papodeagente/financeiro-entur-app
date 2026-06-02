/**
 * Parsers de CSV de vendas por plataforma.
 * Cada parser recebe headers (linha 0) + rows e retorna SaleImportRow[].
 */

export type SaleImportRow = {
  rowNumber: number;
  saleDate: string; // ISO yyyy-mm-dd
  customerName: string;
  customerEmail?: string;
  customerDocument?: string;
  productName: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  installmentsCount: number;
  paymentMethod?: string;
  origin?: string;
  externalId?: string;
  status: "PAID" | "REFUNDED" | "CHARGEBACK" | "PENDING";
  errors: string[];
};

export type Platform = "hotmart" | "eduzz" | "kiwify" | "generic";

export type ParseResult = { rows: SaleImportRow[]; totalRows: number; errors: { row: number; message: string }[] };

function parseLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function readCsv(text: string): { headers: string[]; rows: string[][]; sep: string } {
  const cleaned = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [], sep: ";" };
  const semi = (lines[0].match(/;/g) || []).length;
  const comma = (lines[0].match(/,/g) || []).length;
  const tab = (lines[0].match(/\t/g) || []).length;
  const sep = tab > semi && tab > comma ? "\t" : semi >= comma ? ";" : ",";
  const headers = parseLine(lines[0], sep).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((l) => parseLine(l, sep));
  return { headers, rows, sep };
}

function brl(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[R$\s]/gi, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(s: string): string {
  if (!s) return "";
  // dd/mm/yyyy ou yyyy-mm-dd ou dd-mm-yyyy ou ISO timestamp
  const trim = s.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trim)) return trim;
  const m = trim.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // fallback: try Date constructor
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h === c || h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

// ── HOTMART ──────────────────────────────
// Cabeçalho comum: "Data Transação", "Comprador", "Email Comprador", "Produto", "Preço", "Líquido", "Parcelas", "Tipo Pagamento", "Status"
function parseHotmart(headers: string[], rows: string[][]): ParseResult {
  const c = {
    date: findCol(headers, ["data transação", "data da transação", "data"]),
    name: findCol(headers, ["comprador", "nome do comprador"]),
    email: findCol(headers, ["email comprador", "e-mail comprador", "email"]),
    doc: findCol(headers, ["cpf", "documento"]),
    product: findCol(headers, ["produto"]),
    gross: findCol(headers, ["preço", "preco", "valor"]),
    net: findCol(headers, ["líquido", "liquido"]),
    fee: findCol(headers, ["taxa"]),
    installments: findCol(headers, ["parcelas"]),
    payment: findCol(headers, ["tipo pagamento", "forma de pagamento"]),
    origin: findCol(headers, ["origem", "src"]),
    extId: findCol(headers, ["código", "codigo", "transaction id", "id"]),
    status: findCol(headers, ["status"]),
  };
  return mapRows(rows, c, "hotmart");
}

// ── EDUZZ ──────────────────────────────
function parseEduzz(headers: string[], rows: string[][]): ParseResult {
  const c = {
    date: findCol(headers, ["data da compra", "data"]),
    name: findCol(headers, ["nome cliente", "cliente"]),
    email: findCol(headers, ["email cliente", "email"]),
    doc: findCol(headers, ["cpf"]),
    product: findCol(headers, ["produto"]),
    gross: findCol(headers, ["valor total", "valor bruto", "preço"]),
    net: findCol(headers, ["valor líquido", "líquido"]),
    fee: findCol(headers, ["taxa"]),
    installments: findCol(headers, ["parcelas"]),
    payment: findCol(headers, ["pagamento"]),
    origin: findCol(headers, ["origem"]),
    extId: findCol(headers, ["código transação", "id"]),
    status: findCol(headers, ["status"]),
  };
  return mapRows(rows, c, "eduzz");
}

// ── KIWIFY ──────────────────────────────
function parseKiwify(headers: string[], rows: string[][]): ParseResult {
  const c = {
    date: findCol(headers, ["data", "created_at"]),
    name: findCol(headers, ["nome do cliente", "customer name", "comprador"]),
    email: findCol(headers, ["email do cliente", "customer email", "email"]),
    doc: findCol(headers, ["cpf"]),
    product: findCol(headers, ["produto", "product"]),
    gross: findCol(headers, ["valor", "amount", "preço"]),
    net: findCol(headers, ["líquido", "net"]),
    fee: findCol(headers, ["taxa", "fee"]),
    installments: findCol(headers, ["parcelas"]),
    payment: findCol(headers, ["método", "metodo", "payment method"]),
    origin: findCol(headers, ["src", "origem", "utm_source"]),
    extId: findCol(headers, ["order id", "transaction id"]),
    status: findCol(headers, ["status"]),
  };
  return mapRows(rows, c, "kiwify");
}

// ── GENERIC ──────────────────────────────
function parseGeneric(headers: string[], rows: string[][]): ParseResult {
  const c = {
    date: findCol(headers, ["data", "data_venda"]),
    name: findCol(headers, ["cliente", "nome"]),
    email: findCol(headers, ["email"]),
    doc: findCol(headers, ["cpf", "cnpj", "documento"]),
    product: findCol(headers, ["produto"]),
    gross: findCol(headers, ["valor", "valor_bruto", "preco"]),
    net: findCol(headers, ["liquido", "valor_liquido"]),
    fee: findCol(headers, ["taxa"]),
    installments: findCol(headers, ["parcelas"]),
    payment: findCol(headers, ["pagamento", "metodo"]),
    origin: findCol(headers, ["origem", "canal"]),
    extId: findCol(headers, ["id_externo", "external_id"]),
    status: findCol(headers, ["status"]),
  };
  return mapRows(rows, c, "generic");
}

type Cols = Record<string, number>;

function mapStatus(s: string | undefined, platform: Platform): SaleImportRow["status"] {
  if (!s) return "PAID";
  const v = s.toLowerCase();
  if (v.includes("refund") || v.includes("reembols") || v.includes("estorn") || v === "canceled") return "REFUNDED";
  if (v.includes("chargeback") || v.includes("disput")) return "CHARGEBACK";
  if (v.includes("pend") || v.includes("waiting") || v.includes("aguard")) return "PENDING";
  return "PAID";
}

function mapRows(rows: string[][], c: Cols, platform: Platform): ParseResult {
  const out: SaleImportRow[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 2;
    const errs: string[] = [];

    const customerName = (c.name >= 0 ? r[c.name] : "")?.trim();
    if (!customerName) errs.push("Cliente vazio");
    const productName = (c.product >= 0 ? r[c.product] : "")?.trim();
    if (!productName) errs.push("Produto vazio");

    const saleDate = c.date >= 0 ? isoDate(r[c.date]) : "";
    if (!saleDate) errs.push("Data inválida");

    const gross = c.gross >= 0 ? brl(r[c.gross]) : 0;
    if (gross <= 0) errs.push("Valor bruto inválido");

    const fee = c.fee >= 0 ? brl(r[c.fee]) : 0;
    const net = c.net >= 0 ? brl(r[c.net]) : gross - fee;
    const installments = c.installments >= 0 ? Math.max(1, parseInt(r[c.installments] || "1", 10) || 1) : 1;

    if (errs.length > 0) {
      errors.push({ row: rowNumber, message: errs.join(", ") });
      continue;
    }

    out.push({
      rowNumber, saleDate, customerName,
      customerEmail: c.email >= 0 ? r[c.email]?.trim() || undefined : undefined,
      customerDocument: c.doc >= 0 ? r[c.doc]?.trim() || undefined : undefined,
      productName, grossAmount: gross, feeAmount: fee, netAmount: net,
      installmentsCount: installments,
      paymentMethod: c.payment >= 0 ? r[c.payment]?.trim() || undefined : undefined,
      origin: c.origin >= 0 ? r[c.origin]?.trim() || undefined : undefined,
      externalId: c.extId >= 0 ? r[c.extId]?.trim() || undefined : undefined,
      status: mapStatus(c.status >= 0 ? r[c.status] : undefined, platform),
      errors: [],
    });
  }

  return { rows: out, totalRows: out.length, errors };
}

export function parseSalesCsv(text: string, platform: Platform): ParseResult {
  const { headers, rows } = readCsv(text);
  if (headers.length === 0) return { rows: [], totalRows: 0, errors: [{ row: 1, message: "CSV vazio" }] };
  switch (platform) {
    case "hotmart": return parseHotmart(headers, rows);
    case "eduzz": return parseEduzz(headers, rows);
    case "kiwify": return parseKiwify(headers, rows);
    default: return parseGeneric(headers, rows);
  }
}

export function inferOrigin(raw?: string): string {
  if (!raw) return "OUTRO";
  const v = raw.toLowerCase();
  if (v.includes("google") || v.includes("meta") || v.includes("facebook") || v.includes("instagram") || v.includes("tiktok") || v.includes("ads") || v.includes("cpc")) return "TRAFEGO_PAGO";
  if (v.includes("organic") || v.includes("orgânic")) return "ORGANICO";
  if (v.includes("afili")) return "AFILIADO";
  if (v.includes("indic")) return "INDICACAO";
  if (v.includes("parc")) return "PARCEIRO";
  if (v.includes("event")) return "EVENTO";
  if (v.includes("email") || v.includes("inbound")) return "INBOUND";
  if (v.includes("call") || v.includes("sdr") || v.includes("outbound")) return "OUTBOUND";
  return "OUTRO";
}
