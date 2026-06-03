import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const customer = await prisma.customer.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, document: true, status: true },
  });
  if (!customer) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(customer);
}
