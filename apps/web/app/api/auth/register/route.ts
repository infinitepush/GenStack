import { hash } from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { name, email, password } = await request.json() as { name?: string; email?: string; password?: string };

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return NextResponse.json({ success: false, error: "A user with this email already exists." }, { status: 409 });
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });

    return NextResponse.json({ success: true, user });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal registration error.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
