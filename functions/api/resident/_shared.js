const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE = "bentgrass_resident_session";
const SESSION_DAYS = 14;

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

export function text(value, max = 500) {
  const result = String(value || "").trim();
  return result ? result.slice(0, max) : null;
}

export function randomToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cookieValue(request, name) {
  return (request.headers.get("Cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || null;
}

export function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function requireResident(request, env) {
  if (!env.RESIDENT_DB) return { error: json({ error: "Resident directory is not configured." }, 503) };
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return { error: json({ error: "Authentication required." }, 401) };
  const sessionHash = await sha256(token);
  const session = await env.RESIDENT_DB.prepare(
    `SELECT r.* FROM resident_sessions s
     JOIN residents r ON r.id = s.resident_id
     WHERE s.session_hash = ? AND s.expires_at > ? AND r.status = 'approved'`
  ).bind(sessionHash, new Date().toISOString()).first();
  if (!session) return { error: json({ error: "Authentication required." }, 401, { "Set-Cookie": sessionCookie("", 0) }) };
  return { resident: session };
}

export async function sendMagicLink(env, email, link) {
  if (!env.RESEND_API_KEY || !env.RESIDENT_EMAIL_FROM) {
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESIDENT_EMAIL_FROM,
      to: [email],
      subject: "Your Bent Grass resident directory sign-in link",
      text: `Use this one-time link to sign in to the private Bent Grass resident directory:\n\n${link}\n\nThis link expires in 15 minutes.`,
    }),
  });
  return response.ok;
}

export { SESSION_COOKIE };
