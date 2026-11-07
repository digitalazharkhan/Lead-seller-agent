import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const BACKEND_ORIGIN = "http://127.0.0.1:8000";
const MAX_BODY_BYTES = 16_384;
const TASK_ID_PATTERN = /^[0-9a-f]{32}$/;
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function isAllowedPath(path: string[], method: string): boolean {
  if (path.length === 1 && path[0] === "events") return method === "GET";
  if (path.length === 1 && path[0] === "tasks") {
    return method === "GET" || method === "POST";
  }
  if (path.length === 1 && path[0] === "drafts") {
    return method === "GET" || method === "POST";
  }
  if (path.length === 2 && path[0] === "tasks" && TASK_ID_PATTERN.test(path[1])) {
    return method === "GET";
  }
  return (
    path.length === 3 &&
    path[0] === "tasks" &&
    TASK_ID_PATTERN.test(path[1]) &&
    path[2] === "events" &&
    method === "GET"
  );
}

async function proxyOfficeRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const method = request.method;

  if (!isAllowedPath(path, method)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const headers = new Headers();
  for (const header of ["accept", "content-type", "last-event-id", "x-desk"]) {
    const value = request.headers.get(header);
    if (value) headers.set(header, value);
  }

  let body: ArrayBuffer | undefined;
  if (method === "POST") {
    if (request.headers.get("x-desk") !== "1") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }

    const requestBody = await request.arrayBuffer();
    if (requestBody.byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = requestBody;
  }

  const target = new URL(`/api/office/${path.join("/")}`, BACKEND_ORIGIN);
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
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== "content-length") {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("Cache-Control", "no-cache, no-store");

    if (path[0] === "events") {
      responseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
      responseHeaders.set("X-Accel-Buffering", "no");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "Office backend is unavailable. Check that the local desk is running." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = proxyOfficeRequest;
export const POST = proxyOfficeRequest;
