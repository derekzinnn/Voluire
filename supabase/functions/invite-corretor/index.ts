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

const clean = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rollback bookkeeping — anything created here is undone if a later step fails.
  let criouAuthUser: string | null = null;
  let criouCorretor: string | null = null;
  let adminClient: ReturnType<typeof createClient> | null = null;

  const rollback = async () => {
    if (!adminClient) return;
    try {
      if (criouCorretor) await adminClient.from("corretores").delete().eq("id", criouCorretor);
      if (criouAuthUser) await adminClient.auth.admin.deleteUser(criouAuthUser);
    } catch (_) {
      // rollback best-effort; original error is what matters to the caller
    }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) return json({ error: "Não autorizado" }, 401);

    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (roleData?.role !== "diretor") {
      return json({ error: "Apenas diretores podem cadastrar usuários" }, 403);
    }

    const body = await req.json();
    const nome = clean(body.nome);
    const email = clean(body.email);
    if (!nome || !email) return json({ error: "Nome e e-mail são obrigatórios" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (nome.length > 120 || email.length > 255) return json({ error: "Campos muito longos" }, 400);

    const role = ["corretor", "gerente", "diretor"].includes(body.role) ? body.role : "corretor";
    const equipeId = clean(body.equipe_id);
    const corretorExistenteId = clean(body.corretor_id_existente);
    const criarCorretor = body.criar_corretor !== false;
    const comissao = Number.isFinite(Number(body.comissao_percentual))
      ? Math.min(100, Math.max(0, Number(body.comissao_percentual)))
      : 50;

    const perfil = {
      cpf: clean(body.cpf),
      creci: clean(body.creci),
      telefone_pessoal: clean(body.telefone_pessoal),
      email_pessoal: clean(body.email_pessoal),
      data_nascimento: clean(body.data_nascimento),
    };

    adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Auth user
    const tempPassword = crypto.randomUUID().slice(0, 12) + "A1!";
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (createError || !newUser?.user) {
      return json({ error: createError?.message ?? "Falha ao criar o usuário" }, 400);
    }
    criouAuthUser = newUser.user.id;
    const userId = newUser.user.id;

    // 2. Corretor record: link the chosen existing one, match by e-mail, or create
    let corretorId: string | null = null;

    if (corretorExistenteId) {
      const { data, error } = await adminClient
        .from("corretores")
        .update({ user_id: userId, email })
        .eq("id", corretorExistenteId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Corretor selecionado não encontrado");
      corretorId = data.id as string;
    } else if (criarCorretor) {
      const { data: existente } = await adminClient
        .from("corretores")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existente) {
        const { error } = await adminClient
          .from("corretores")
          .update({ user_id: userId, email })
          .eq("id", existente.id);
        if (error) throw error;
        corretorId = existente.id as string;
      } else {
        const { data, error } = await adminClient
          .from("corretores")
          .insert({ nome, email, user_id: userId, comissao_percentual: comissao })
          .select("id")
          .single();
        if (error) throw error;
        corretorId = data.id as string;
        criouCorretor = corretorId;
      }
    }

    // 3. Team assignment
    if (corretorId && equipeId) {
      const { error } = await adminClient.from("corretores").update({ equipe_id: equipeId }).eq("id", corretorId);
      if (error) throw error;
    }

    // 4. Profile (non-sensitive) + CPF (separate protected table)
    if (corretorId) {
      const perfilValores = {
        creci: perfil.creci,
        telefone_pessoal: perfil.telefone_pessoal,
        email_pessoal: perfil.email_pessoal,
        data_nascimento: perfil.data_nascimento,
      };
      if (Object.values(perfilValores).some((v) => v !== null)) {
        const { error } = await adminClient
          .from("corretor_perfis")
          .upsert({ corretor_id: corretorId, ...perfilValores }, { onConflict: "corretor_id" });
        if (error) throw error;
      }
      if (perfil.cpf) {
        const { error } = await adminClient
          .from("corretor_documentos")
          .upsert({ corretor_id: corretorId, cpf: perfil.cpf }, { onConflict: "corretor_id" });
        if (error) throw error;
      }
    }

    // 5. Role (a trigger already inserts 'corretor')
    if (role !== "corretor") {
      const { error } = await adminClient.from("user_roles").update({ role }).eq("user_id", userId);
      if (error) throw error;
    }

    // 6. Manager of a team
    if (role === "gerente" && equipeId) {
      const { error } = await adminClient.from("equipes").update({ gestor_user_id: userId }).eq("id", equipeId);
      if (error) throw error;
    }

    return json({ success: true, tempPassword, userId, corretorId });
  } catch (err) {
    await rollback();
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `${message} — nenhum dado parcial foi mantido.` }, 500);
  }
});
