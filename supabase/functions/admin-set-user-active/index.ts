import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Desativa/reativa o acesso de um usuário sem apagar nada (histórico preservado).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "Não autorizado" }, 401);
    const { data: pode } = await userClient.rpc("has_permission", { _permission: "usuarios.gerenciar" });
    if (!pode) return json({ error: "Sem permissão" }, 403);

    const { user_id, ativo } = await req.json();
    if (typeof user_id !== "string" || typeof ativo !== "boolean") return json({ error: "Dados inválidos" }, 400);
    if (user_id === caller.id) return json({ error: "Você não pode desativar a própria conta" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.auth.admin.updateUserById(user_id, { ban_duration: ativo ? "none" : "876000h" });
    if (error) return json({ error: error.message }, 400);
    await admin.from("corretores").update({ ativo }).eq("user_id", user_id);
    const { data: alvo } = await admin.auth.admin.getUserById(user_id);
    await admin.from("system_logs").insert({
      user_id: caller.id, user_email: caller.email, acao: ativo ? "reativou" : "desativou",
      entidade: "acesso", entidade_id: user_id, descricao: `Acesso de ${alvo?.user?.email ?? user_id}`,
    });
    return json({ success: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
