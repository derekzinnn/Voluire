import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "Não autorizado" }, 401);

    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", caller.id);
    const isDiretor = (roles ?? []).some((r: any) => r.role === "diretor");
    if (!isDiretor) return json({ error: "Apenas o diretor pode excluir usuários" }, 403);

    const body = await req.json();
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (!userId) return json({ error: "Usuário não informado" }, 400);
    if (userId === caller.id) return json({ error: "Você não pode excluir a sua própria conta" }, 400);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: alvo } = await admin.auth.admin.getUserById(userId);
    if (!alvo?.user) return json({ error: "Usuário não encontrado" }, 404);

    // Desvincula corretor e remove funções antes de excluir o acesso
    await admin.from("corretores").update({ user_id: null }).eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);

    await admin.from("system_logs").insert({
      user_id: caller.id,
      user_email: caller.email,
      acao: "excluiu",
      entidade: "acesso",
      entidade_id: userId,
      descricao: `Acesso de ${alvo.user.email ?? userId} excluído pelo diretor`,
    });

    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
