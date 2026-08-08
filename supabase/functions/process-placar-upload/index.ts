import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const TASK_NAME_MAP: Record<string, string> = {
  "presença em reunião/treinamento": "Presença em reunião/treinamento",
  "ação/participar evento": "Ação/Participar evento",
  "atualizar crm": "Atualizar CRM",
  "fazer 20 ligações leads antigos": "Fazer 20 ligações leads antigos",
  "lead de indicação": "Lead de indicação",
  "feedback 5 estrelas": "Feedback 5 estrelas",
  "agenciamento exclusivo": "Agenciamento exclusivo",
  "agenciamento com placa": "Agenciamento com placa",
  "agenciamento": "Agenciamento",
  "agendar reunião/visita": "Agendar Reunião/Visita",
  "vídeo tiktok": "Vídeo Tiktok",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const corretorId = formData.get("corretor_id") as string;
    const trimestre = Number(formData.get("trimestre"));
    const ano = Number(formData.get("ano"));
    const semanaInicio = formData.get("semana_inicio") as string;

    if (!file || !corretorId || !trimestre || !ano || !semanaInicio) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: file, corretor_id, trimestre, ano, semana_inicio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse xlsx
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Get tasks from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tarefas } = await supabase
      .from("placar_tarefas")
      .select("id, nome, pontos")
      .eq("ativa", true);

    if (!tarefas || tarefas.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma tarefa cadastrada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build name->task map
    const taskByName: Record<string, typeof tarefas[0]> = {};
    for (const t of tarefas) {
      taskByName[t.nome.toLowerCase()] = t;
    }

    // Find the "Total" column index and task rows
    // The spreadsheet has: Tipo | Pontos | ... daily columns ... | Total
    // We look for rows where column 0 matches a task name and column "Total" has the count
    const entregas: { tarefa_id: string; tarefa_nome: string; pontos: number; quantidade: number }[] = [];

    for (const row of rows) {
      if (!row[0] || typeof row[0] !== "string") continue;
      const taskName = row[0].trim().toLowerCase();
      const task = taskByName[taskName];
      if (!task) continue;

      // The "Total" column is typically the second-to-last or last populated column
      // In the standard format, totals appear in different positions
      // Look for the total: it's the column after all daily data
      // Standard layout: col0=Tipo, col1=Pontos, then pairs (Qtd,Total) per day, then Total column
      // Find the total by looking at the last numeric values
      let totalQtd = 0;

      // The total column is typically at index 12 (0-based) based on the spreadsheet format
      // But let's be more robust: scan for numeric values and use the pattern
      // col 2,3 = Mon qty,total; col 4,5 = Tue; col 6,7 = Wed; col 8,9 = Thu; col 10,11 = Fri; col 12 = Total
      const totalColIndex = 12;
      if (row[totalColIndex] !== undefined && row[totalColIndex] !== null) {
        const val = Number(row[totalColIndex]);
        if (!isNaN(val) && val > 0) {
          totalQtd = val;
        }
      }

      // Fallback: sum all daily quantities (cols 2, 4, 6, 8, 10)
      if (totalQtd === 0) {
        for (const colIdx of [2, 4, 6, 8, 10]) {
          const v = Number(row[colIdx] || 0);
          if (!isNaN(v)) totalQtd += v;
        }
      }

      if (totalQtd > 0) {
        entregas.push({
          tarefa_id: task.id,
          tarefa_nome: task.nome,
          pontos: task.pontos,
          quantidade: totalQtd,
        });
      }
    }

    if (entregas.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma tarefa encontrada na planilha", parsed_rows: rows.length }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert entries (one per unit of quantity)
    const insertRows: { corretor_id: string; tarefa_id: string; semana_inicio: string; trimestre: number; ano: number }[] = [];
    for (const e of entregas) {
      for (let i = 0; i < e.quantidade; i++) {
        insertRows.push({
          corretor_id: corretorId,
          tarefa_id: e.tarefa_id,
          semana_inicio: semanaInicio,
          trimestre,
          ano,
        });
      }
    }

    const { error: insertError } = await supabase.from("placar_entregas").insert(insertRows);
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalPontos = entregas.reduce((sum, e) => sum + e.pontos * e.quantidade, 0);

    return new Response(JSON.stringify({
      success: true,
      totalPontos,
      totalEntregas: insertRows.length,
      detalhes: entregas.map(e => ({ tarefa: e.tarefa_nome, quantidade: e.quantidade, pontos: e.pontos * e.quantidade })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
