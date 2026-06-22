import type { Actor, Env } from "./types";

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}

export function error(status: number, message: string, details?: unknown) {
  return json({ error: message, details }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return error(err.status, err.message, err.details);
  console.error(err);
  return error(500, "Internal server error");
}

export function requireAccess(request: Request, env: Env): Actor {
  const emailHeader = request.headers.get("Cf-Access-Authenticated-User-Email");
  const jwtHeader = request.headers.get("Cf-Access-Jwt-Assertion");
  const url = new URL(request.url);
  const localEmail = isLocalhost(url.hostname) ? env.DEV_AUTH_EMAIL : undefined;
  const email = emailHeader || localEmail;

  if (!email || (!jwtHeader && !localEmail)) {
    throw new HttpError(401, "Cloudflare Access login is required");
  }

  const allowed = parseEmailList(env.ACCESS_ALLOWED_EMAILS);
  if (allowed.length > 0 && !allowed.includes(email.toLowerCase())) {
    throw new HttpError(403, "This account is not allowed to use this log");
  }

  return { email };
}

function parseEmailList(value?: string) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function notFound() {
  return error(404, "Route not found");
}

export function noContent() {
  return new Response(null, { status: 204 });
}
