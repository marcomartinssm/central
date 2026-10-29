// Central do Marco — lê o Google Agenda pelo endereço secreto iCal (guardado em central_config)
// e devolve os compromissos de um período. Só o dono da Central (central_usuarios) pode chamar.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import ICAL from "npm:ical.js@1.5.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// guarda o arquivo da agenda por 2 minutos para não baixar a cada clique
let cache: { link: string; quando: number; texto: string } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: dono } = await usuario.rpc("central_e_dono");
    if (!dono) return resposta({ erro: "sem permissão" }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await admin.from("central_config").select("valor").eq("chave", "google_ical").maybeSingle();
    if (!cfg?.valor) return resposta({ conectada: false, eventos: [] });

    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const inicio = new Date(corpo.inicio ?? new Date().toISOString().slice(0, 10) + "T00:00:00-03:00");
    let fim = new Date(corpo.fim ?? inicio.getTime() + 8 * 864e5);
    if (fim.getTime() - inicio.getTime() > 62 * 864e5) fim = new Date(inicio.getTime() + 62 * 864e5);

    if (!cache || cache.link !== cfg.valor || Date.now() - cache.quando > 120_000) {
      const r = await fetch(cfg.valor);
      if (!r.ok) return resposta({ conectada: true, erro: `Google respondeu ${r.status}. O endereço pode ter sido trocado.`, eventos: [] });
      cache = { link: cfg.valor, quando: Date.now(), texto: await r.text() };
    }

    const cal = new ICAL.Component(ICAL.parse(cache.texto));
    for (const tz of cal.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

    const vevents = cal.getAllSubcomponents("vevent");
    // exceções de eventos repetidos (um dia que foi mudado) ficam ligadas ao evento principal
    const excecoes = new Map<string, ICAL.Component[]>();
    for (const v of vevents) {
      if (v.hasProperty("recurrence-id")) {
        const uid = v.getFirstPropertyValue("uid");
        excecoes.set(uid, [...(excecoes.get(uid) ?? []), v]);
      }
    }

    const eventos: unknown[] = [];
    const adiciona = (ev: ICAL.Event, ini: ICAL.Time, fimEv: ICAL.Time) => {
      const a = ini.toJSDate(), b = fimEv.toJSDate();
      if (b <= inicio || a >= fim) return;
      eventos.push({
        titulo: ev.summary || "(sem título)",
        inicio: ini.isDate ? ini.toString() : a.toISOString(),
        fim: fimEv.isDate ? fimEv.toString() : b.toISOString(),
        dia_todo: ini.isDate,
        local: ev.location || null,
      });
    };

    for (const v of vevents) {
      if (v.hasProperty("recurrence-id")) continue;
      if ((v.getFirstPropertyValue("status") ?? "").toString().toUpperCase() === "CANCELLED") continue;
      const ev = new ICAL.Event(v, { exceptions: excecoes.get(v.getFirstPropertyValue("uid")) ?? [] });
      if (!ev.isRecurring()) { adiciona(ev, ev.startDate, ev.endDate); continue; }
      const it = ev.iterator();
      let prox: ICAL.Time | null, voltas = 0;
      while ((prox = it.next()) && voltas++ < 5000) {
        if (prox.toJSDate() >= fim) break;
        const o = ev.getOccurrenceDetails(prox);
        adiciona(o.item, o.startDate, o.endDate);
      }
    }
    eventos.sort((x: any, y: any) => String(x.inicio).localeCompare(String(y.inicio)));
    return resposta({ conectada: true, eventos });
  } catch (e) {
    return resposta({ erro: String((e as Error).message ?? e) }, 500);
  }
});
