import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Increase max duration for AI generation calls (Vercel/edge: up to 300s on Pro)
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }): Promise<NextResponse> {
  return proxyRequest(request, params.path, "GET");
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }): Promise<NextResponse> {
  return proxyRequest(request, params.path, "POST");
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }): Promise<NextResponse> {
  return proxyRequest(request, params.path, "PUT");
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }): Promise<NextResponse> {
  return proxyRequest(request, params.path, "DELETE");
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
): Promise<NextResponse> {
  const path = pathSegments.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${API_BASE}/${path}${searchParams ? `?${searchParams}` : ""}`;

  // Forward NextAuth session cookie so auth-middleware on Express can verify the JWT
  const token = await getToken({ req: request });
  const headers: Record<string, string> = {};

  // Forward content-type
  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  // Forward session cookie from the original request
  const cookie = request.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  // Forward authorization if present
  const auth = request.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  // If we have a decoded token, pass userId as a header fallback
  if (token?.sub) headers["x-user-id"] = token.sub;

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "DELETE") {
    try {
      body = await request.arrayBuffer();
    } catch {
      // no body
    }
  }

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers,
      ...(body !== undefined && (body as ArrayBuffer).byteLength > 0 ? { body } : {}),
      // fetch has no built-in timeout; rely on the runtime's maxDuration above.
      // The signal from the incoming request ensures client disconnects are respected.
      signal: request.signal
    });

    // Stream the response body back
    const responseHeaders: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      // Skip headers that Next.js manages itself
      if (!["content-encoding", "transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Proxy error";
    const isAborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { success: false, data: null, error: { code: isAborted ? "REQUEST_ABORTED" : "PROXY_ERROR", message } },
      { status: isAborted ? 499 : 502 }
    );
  }
}
