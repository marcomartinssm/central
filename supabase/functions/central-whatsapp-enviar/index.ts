// Central do Marco — envia UMA mensagem de texto pela Evolution, para uma conversa que já existe na Central.
// Só o dono logado chama (quem clica em Enviar na tela); o agendador e o Claude da triagem não têm acesso. Tudo fica registrado em central_wa_envios.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const EVOLUTION = "https://dinastia-evolution.saxddq.easypanel.host";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: dono } = await usuario.rpc("central_e_dono");
  if (!dono) return resposta({ erro: "sem permissão" }, 403);

  const { conversa_id, texto } = await req.json().catch(() => ({}));
  const msg = String(texto ?? "").trim();
  if (!conversa_id || !msg) return resposta({ erro: "faltou a conversa ou o texto" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: c } = await admin.from("central_wa_conversas").select("id, instancia, jid, numero").eq("id", conversa_id).maybeSingle();
  if (!c) return resposta({ erro: "conversa não encontrada" }, 404);
  const destino = c.numero || c.jid;

  let evolution_id: string | null = null, erro: string | null = null;
  try {
    const r = await fetch(`${EVOLUTION}/message/sendText/${encodeURIComponent(c.instancia)}`, {
      method: "POST", headers: { apikey: Deno.env.get("EVOLUTION_API_KEY") ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ number: destino, text: msg }), signal: AbortSignal.timeout(30000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) evolution_id = d?.key?.id ?? null; else erro = `Evolution respondeu ${r.status}`;
  } catch (e) {
    erro = String((e as Error).message ?? e).slice(0, 200);
  }
  await admin.from("central_wa_envios").insert({ conversa_id: c.id, instancia: c.instancia, destino, texto: msg, evolution_id, erro });
  if (erro) return resposta({ erro }, 502);
  await admin.from("central_wa_conversas").update({ ultima_minha: true, visto: true }).eq("id", c.id);
  return resposta({ ok: true, id: evolution_id });
});
