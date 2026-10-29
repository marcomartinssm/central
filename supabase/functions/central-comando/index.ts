// Central do Marco — recebe um pedido falado (já em texto), o Claude entende e a função executa nas tarefas.
// Ações possíveis: criar, concluir, reabrir, alterar. Apagar NÃO é feito por voz (só pela tela).
// Só o dono da Central (central_usuarios) pode chamar. Cada pedido fica em central_comandos.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import Anthropic from "npm:@anthropic-ai/sdk";

const MODELO = "claude-opus-5-5";
const PRECO: [number, number] = [4, 20]; // US$ por milhão de tokens (entrada, saída)
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["acoes", "resposta"],
  properties: {
    acoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "tarefa_id", "titulo", "area_id", "data", "hora", "importante", "notas"],
        properties: {
          tipo: { type: "string", enum: ["criar", "concluir", "reabrir", "alterar"] },
          tarefa_id: { type: "string", description: "id da tarefa existente (concluir/reabrir/alterar); vazio ao criar" },
          titulo: { type: "string", description: "vazio = não mudar" },
          area_id: { type: "string", description: "id da área; vazio = não mudar / sem área; 'nenhuma' = tirar a área" },
          data: { type: "string", description: "AAAA-MM-DD; vazio = não mudar; 'nenhuma' = tirar a data" },
          hora: { type: "string", description: "HH:MM; vazio = não mudar; 'nenhuma' = tirar a hora" },
          importante: { type: "string", enum: ["", "sim", "nao"] },
          notas: { type: "string", description: "vazio = não mudar" },
        },
      },
    },
    resposta: { type: "string", description: "o que dizer ao Marco, curto, em português" },
  },
};

const BASE = `Você é o assistente pessoal do Marco dentro da "Central do Marco", onde ficam as tarefas da vida pessoal e das empresas dele.
O Marco fala um pedido (às vezes com erros de transcrição de voz) e você transforma em ações nas tarefas.

Regras:
- Interprete datas relativas ("amanhã", "sexta", "semana que vem", "dia 5") a partir de HOJE informado no contexto. "Semana que vem" sem dia = segunda-feira seguinte.
- Escolha a área que melhor combina pelo assunto (aluguel/inquilino/proprietário → Aluguel; lead/visita de locação → Comercial de locação; obra → Construtora/obra; seguro/apólice → Seguralta; clínica/procedimento → Estética Morgana; casamento → Casamento; contas pessoais → Finanças pessoais). Se não der pra saber, deixe sem área.
- Para concluir/alterar/reabrir, use SOMENTE ids da lista de tarefas do contexto. Se mais de uma tarefa combinar e não der pra saber qual, não faça nada e pergunte na resposta.
- Pode fazer várias ações num pedido só.
- Pedidos para apagar: não apague; diga que apagar é só pela tela.
- Perguntas ("o que tenho hoje?", "o que está atrasado?") não geram ações: responda usando as tarefas e a agenda do contexto.
- Títulos curtos e claros, começando com verbo quando fizer sentido ("Ligar para o proprietário do 302"). Detalhes extras vão em notas.
- A resposta é curta (1 a 3 frases), em português do Brasil, confirmando o que foi feito com dia e hora quando houver. Nada de markdown.
- Campos que não se aplicam ficam como string vazia.`;

const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const diaSemana = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: dono } = await usuario.rpc("central_e_dono");
  if (!dono) return resposta({ erro: "sem permissão" }, 403);

  const corpo = await req.json().catch(() => ({}));
  const texto = String(corpo.texto ?? "").trim().slice(0, 2000);
  const canal = ["microfone", "texto", "whatsapp"].includes(corpo.canal) ? corpo.canal : "microfone";
  if (!texto) return resposta({ erro: "pedido vazio" }, 400);

  const log = { canal, texto } as Record<string, unknown>;
  try {
    // contexto: áreas, tarefas (abertas + feitas nos últimos 2 dias) e agenda dos próximos dias
    const corte = new Date(Date.now() - 2 * 864e5).toISOString();
    const [ra, rt, rg] = await Promise.all([
      usuario.from("central_areas").select("id, nome, pai_id").eq("ativo", true),
      usuario.from("central_tarefas").select("id, titulo, area_id, data, hora, importante, feita, notas").or(`feita.eq.false,feita_em.gte.${corte}`),
      fetch(`${url}/functions/v1/central-agenda`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: "{}" })
        .then((r) => r.json()).catch(() => ({})),
    ]);
    if (ra.error || rt.error) throw new Error((ra.error ?? rt.error)!.message);
    const areas = ra.data!, tarefas = rt.data!;
    const nomeArea = (id: string | null) => {
      const a = areas.find((x) => x.id === id); if (!a) return "sem área";
      const p = a.pai_id && areas.find((x) => x.id === a.pai_id);
      return p ? `${p.nome} › ${a.nome}` : a.nome;
    };
    const hoje = hojeBRT();
    const eventos = (rg?.eventos ?? []).map((e: any) =>
      e.dia_todo ? `- ${e.inicio} (dia inteiro): ${e.titulo}`
        : `- ${new Date(e.inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}: ${e.titulo}${e.local ? ` (${e.local})` : ""}`);
    const contexto = [
      `HOJE: ${hoje} (${diaSemana(hoje)}). Agora: ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.`,
      `\nÁREAS (id: nome):\n` + areas.map((a) => `${a.id}: ${nomeArea(a.id)}`).join("\n"),
      `\nTAREFAS:\n` + (tarefas.map((t) =>
        `${t.id} | ${t.feita ? "FEITA" : "aberta"} | ${t.titulo} | ${nomeArea(t.area_id)} | ${t.data ? `${t.data} (${diaSemana(t.data)})` : "sem data"}${t.hora ? " " + t.hora.slice(0, 5) : ""}${t.importante ? " | importante" : ""}`).join("\n") || "(nenhuma)"),
      `\nGOOGLE AGENDA (próximos 8 dias, só leitura):\n` + (eventos.join("\n") || (rg?.conectada === false ? "(agenda ainda não ligada)" : "(nada)")),
    ].join("\n");

    const resp = await (anthropic.beta.messages.create as any)({
      model: MODELO,
      max_tokens: 3000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
      system: [{ type: "text", text: BASE, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `<contexto>\n${contexto}\n</contexto>\n\nPedido do Marco: ${texto}` }],
    });
    if (resp.stop_reason === "refusal") throw new Error("o modelo recusou responder");
    const saida = JSON.parse((resp.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(""));
    const u = resp.usage ?? {};
    log.custo_usd = (((u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1) * PRECO[0] + (u.output_tokens ?? 0) * PRECO[1]) / 1e6;

    // executa (com conferência: só ids que existem, datas e horas válidas)
    const idsArea = new Set(areas.map((a) => a.id)), idsTarefa = new Set(tarefas.map((t) => t.id));
    const feitas: unknown[] = [];
    for (const a of saida.acoes ?? []) {
      const campos: Record<string, unknown> = {};
      if (a.titulo) campos.titulo = a.titulo.slice(0, 300);
      if (a.area_id === "nenhuma") campos.area_id = null; else if (idsArea.has(a.area_id)) campos.area_id = a.area_id;
      if (a.data === "nenhuma") campos.data = null; else if (/^\d{4}-\d{2}-\d{2}$/.test(a.data)) campos.data = a.data;
      if (a.hora === "nenhuma") campos.hora = null; else if (/^\d{2}:\d{2}$/.test(a.hora)) campos.hora = a.hora;
      if (a.importante) campos.importante = a.importante === "sim";
      if (a.notas) campos.notas = a.notas.slice(0, 2000);

      let r;
      if (a.tipo === "criar") {
        if (!campos.titulo) continue;
        r = await usuario.from("central_tarefas").insert({ ...campos, origem: canal === "whatsapp" ? "whatsapp" : "claude" }).select().single();
      } else {
        if (!idsTarefa.has(a.tarefa_id)) continue;
        if (a.tipo === "concluir") Object.assign(campos, { feita: true });
        if (a.tipo === "reabrir") Object.assign(campos, { feita: false });
        if (!Object.keys(campos).length) continue;
        r = await usuario.from("central_tarefas").update(campos).eq("id", a.tarefa_id).select().single();
      }
      if (r.error) throw new Error(r.error.message);
      feitas.push({ tipo: a.tipo, tarefa: r.data });
    }
    log.resposta = saida.resposta;
    log.acoes = feitas;
    await admin.from("central_comandos").insert(log);
    return resposta({ resposta: saida.resposta, acoes: feitas });
  } catch (e) {
    log.erro = String((e as Error).message ?? e);
    await admin.from("central_comandos").insert(log);
    return resposta({ erro: "Não consegui fazer agora: " + log.erro }, 500);
  }
});
