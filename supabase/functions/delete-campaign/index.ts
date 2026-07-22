import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const APP_ORIGIN = "https://aomarco.github.io";

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin === APP_ORIGIN ? APP_ORIGIN : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function reply(origin: string | null, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin !== APP_ORIGIN) return reply(origin, 403, { error: "This operation only accepts requests from Roll30." });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "POST") return reply(origin, 405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return reply(origin, 401, { error: "A signed-in Roll30 account is required." });
  }

  let body: { campaignId?: string; confirmation?: string };
  try { body = await request.json(); }
  catch { return reply(origin, 400, { error: "Invalid request." }); }
  if (!body.campaignId || body.confirmation !== "DELETE") {
    return reply(origin, 400, { error: "Permanent deletion was not confirmed." });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply(origin, 401, { error: "Your session is no longer valid." });

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .select("id,name,owner_id,deleted_at")
    .eq("id", body.campaignId)
    .maybeSingle();
  if (campaignError) return reply(origin, 503, { error: "The campaign could not be checked." });
  if (!campaign || campaign.owner_id !== authData.user.id) return reply(origin, 403, { error: "Only the campaign owner can delete it." });
  if (!campaign.deleted_at) return reply(origin, 409, { error: "Move the campaign to trash before deleting it permanently." });

  const [{ data: assets, error: assetError }, { data: tiles, error: tileError }] = await Promise.all([
    admin.from("campaign_assets").select("storage_path").eq("campaign_id", campaign.id),
    admin.from("scene_map_tiles").select("storage_path,scenes!inner(campaign_id)").eq("scenes.campaign_id", campaign.id),
  ]);
  if (assetError || tileError) return reply(origin, 503, { error: "Campaign files could not be inventoried safely." });

  const paths = [...new Set([...(assets ?? []), ...(tiles ?? [])].map((entry) => entry.storage_path).filter(Boolean))];
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from("campaign-media").remove(paths.slice(index, index + 100));
    if (error) return reply(origin, 503, { error: "Campaign deletion stopped before the database record was removed. Some files may already be gone; retry to finish safely." });
  }

  const { error: deleteError } = await admin.from("campaigns").delete().eq("id", campaign.id).eq("owner_id", authData.user.id);
  if (deleteError) return reply(origin, 503, { error: "The files were removed, but the campaign record could not be deleted. Try again." });
  return reply(origin, 200, { deleted: true, name: campaign.name, filesRemoved: paths.length });
});
