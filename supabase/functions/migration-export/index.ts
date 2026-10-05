// TEMPORÁRIA: exporta os dados para a migração. Apagar logo após o uso.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const sameToken = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  const expected = Deno.env.get("MIGRATION_EXPORT_TOKEN") ?? "";
  const given = req.headers.get("x-export-token") ?? "";
  if (req.method !== "POST" || expected.length < 32 || !sameToken(given, expected)) {
    return json({ error: "Não autorizado" }, 401);
  }

  const { action, bucket, path } = await req.json();

  if (action === "file") {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error) return json({ error: error.message }, 400);
    return new Response(data, { headers: { "Content-Type": "application/octet-stream" } });
  }

  if (action !== "dump") return json({ error: "Ação inválida" }, 400);

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return json({ error: "SUPABASE_DB_URL indisponível" }, 500);
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    // Valores saem como texto JSON para não perder precisão numérica no caminho.
    const dumpOf = async (schema: string, table: string) => {
      const [r] = await sql.unsafe(
        `SELECT COALESCE(json_agg(t), '[]'::json)::text AS rows FROM ${schema}.${table} t`,
      );
      return r.rows as string;
    };
    const tables = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
    const out: Record<string, string> = {};
    for (const { tablename } of tables) out[`public.${tablename}`] = await dumpOf("public", `"${tablename}"`);
    // Sem senhas nem identidades: só o necessário para recriar cada usuário com o mesmo id.
    const [users] = await sql`
      SELECT COALESCE(json_agg(json_build_object(
        'id', id, 'email', email, 'created_at', created_at, 'email_confirmed_at', email_confirmed_at,
        'banned_until', banned_until, 'raw_user_meta_data', raw_user_meta_data, 'raw_app_meta_data', raw_app_meta_data
      )), '[]'::json)::text AS rows
      FROM auth.users`;
    out["auth.users"] = users.rows;
    const [objs] = await sql`
      SELECT COALESCE(json_agg(json_build_object('bucket_id', bucket_id, 'name', name, 'metadata', metadata)), '[]'::json)::text AS rows
      FROM storage.objects`;
    out["storage.objects"] = objs.rows;
    return json(out);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  } finally {
    await sql.end();
  }
});
