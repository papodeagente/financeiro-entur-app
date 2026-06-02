import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { reportBySlug } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { slug } = await params;
  const def = reportBySlug.get(slug);
  if (!def) return new Response("Report not found", { status: 404 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const rows = await def.load({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  const content = toCsv(rows, def.csvColumns);
  const filename = `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, content);
}
