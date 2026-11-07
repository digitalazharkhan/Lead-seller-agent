import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const BACKEND_ORIGIN = "http://127.0.0.1:8000";
const MAX_BODY_BYTES = 16_384;

function isAllowedPath(path: string[], method: string): boolean {
  return (
    (path.length === 1 && path[0] === "leads" && method === "GET") ||
    (path.length === 1 && path[0] === "optout" && method === "POST")
  );
}

async function proxyLocalRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const method = request.method;

  if (!isAllowedPath(path, method)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const headers = new Headers();
  for (const header of ["accept", "content-type", "x-desk"]) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }

  let body: ArrayBuffer | undefined;
  if (method === "POST") {
    if (request.headers.get("x-desk") !== "1") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return Response.json({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
  }

  const target = new URL(`/api/${path[0]}`, BACKEND_ORIGIN);
  target.search = new URL(request.url).search;

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: request.signal,
    });
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "Local lead API is unavailable. Check that the local desk is running." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxyLocalRequest;
export const POST = proxyLocalRequest;
