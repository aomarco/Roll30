// Supabase "soft gate" client.
//
// The password is NOT here — it lives only inside a server-side Postgres
// function (public.authorize_ip). This module just calls two RPC endpoints:
//   - authorize_ip(pw, client_ip) -> records the IP if the password is right
//   - is_ip_authorized(check_ip)  -> true if this IP has been authorized before
//
// The publishable key below is safe to ship in the browser (that's its purpose).

// Dedicated Roll30 Supabase project (separate from the 'chara' project).
const SUPABASE_URL = "https://eujhtcnnjtwsthscdfqk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_N0AviKRP_IyMGQMtKo0ZlQ_uuD-2dnq";

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${fn} failed: ${res.status}`);
  return res.json();
}

/** Best-effort lookup of the visitor's public IP address. */
export async function getMyIp(): Promise<string | null> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    return typeof j.ip === "string" ? j.ip : null;
  } catch {
    return null;
  }
}

/** True if this IP previously entered the password. */
export async function isIpAuthorized(ip: string): Promise<boolean> {
  try {
    return await rpc<boolean>("is_ip_authorized", { check_ip: ip });
  } catch {
    return false;
  }
}

/** Verify the password server-side; on success the IP is remembered. */
export async function authorize(password: string, ip: string | null): Promise<boolean> {
  try {
    return await rpc<boolean>("authorize_ip", {
      pw: password,
      client_ip: ip ?? "unknown",
    });
  } catch {
    return false;
  }
}
