const APP_ORIGIN = "https://aomarco.github.io";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === APP_ORIGIN ? APP_ORIGIN : "null",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function response(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const ip = forwarded.split(",")[0].trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (origin !== APP_ORIGIN) {
    return response({ error: "This access gate only accepts requests from Roll30." }, 403, origin);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return response({ error: "Method not allowed." }, 405, origin);
  }

  const ip = clientIp(request);
  if (!ip) {
    return response({ error: "Your network address could not be verified." }, 400, origin);
  }

  let body: { action?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return response({ error: "Invalid request." }, 400, origin);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    return response({ error: "Access gate is unavailable." }, 503, origin);
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  try {
    if (body.action === "check") {
      const check = await fetch(
        `${url}/rest/v1/authorized_ips?select=ip&ip=eq.${encodeURIComponent(ip)}&limit=1`,
        { headers },
      );
      if (!check.ok) throw new Error("Authorization lookup failed");
      const records = await check.json();
      return response({ allowed: records.length > 0 }, 200, origin);
    }

    if (body.action === "unlock" && typeof body.password === "string") {
      const verify = await fetch(`${url}/rest/v1/rpc/validate_access_password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ client_ip: ip, password_attempt: body.password }),
      });
      if (!verify.ok) throw new Error("Password validation failed");
      return response(await verify.json(), 200, origin);
    }

    return response({ error: "Invalid request." }, 400, origin);
  } catch (error) {
    console.error(error);
    return response({ error: "Access gate is temporarily unavailable." }, 503, origin);
  }
});
