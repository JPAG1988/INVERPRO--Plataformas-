import type { Context, Config } from "@netlify/functions";
import { PERFIL_BASE, leerPerfil, almacen } from "./lib/perfil.mts";
import { leerDestinos, DESTINOS_BASE, chatsDelBot, enviarTelegram, enviarCorreo, textoTelegram, htmlCorreo, type Destinos } from "./lib/avisos.mts";

// Lectura del informe, edición del perfil y ejecución bajo demanda.

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const LISTAS = ["departamentos", "palabras", "excluir", "unspsc", "modalidades"] as const;
const NUMEROS = ["valorMin", "valorMax", "diasMin", "creditosMes"] as const;

// El agente es una herramienta interna: si hay clave configurada, se exige para ver
// destinos de aviso y para cualquier cambio.
const claveOk = (req: Request) => {
  const esperada = Netlify.env.get("AGENTE_CLAVE");
  if (!esperada) return true;
  const dada = req.headers.get("x-clave") || new URL(req.url).searchParams.get("clave") || "";
  if (dada.length !== esperada.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ dada.charCodeAt(i);
  return dif === 0;
};

export default async (req: Request, context: Context) => {
  const origen = req.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(req.url).host) return json({ error: "origen" }, 403);
  const store = almacen(context);
  const autorizado = claveOk(req);
  const protegido = !!Netlify.env.get("AGENTE_CLAVE");

  if (req.method === "GET") {
    const [informe, perfil, error, destinos] = await Promise.all([
      store.get("informe", { type: "json" }).catch(() => null),
      leerPerfil(context),
      store.get("error", { type: "json" }).catch(() => null),
      leerDestinos(context),
    ]);
    return json({
      informe, perfil, error,
      destinos: autorizado ? destinos : null,
      protegido, autorizado,
      iaActiva: !!Netlify.env.get("ANTHROPIC_API_KEY"),
      canales: { telegram: !!Netlify.env.get("TELEGRAM_BOT_TOKEN"), correo: !!Netlify.env.get("RESEND_API_KEY") },
    });
  }

  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  if (!autorizado) return json({ error: "clave" }, 401);

  let cuerpo: any;
  try { cuerpo = await req.json(); } catch { return json({ error: "invalido" }, 400); }

  if (cuerpo?.accion === "perfil") {
    const p: any = { ...PERFIL_BASE };
    for (const k of LISTAS) {
      if (Array.isArray(cuerpo.perfil?.[k])) p[k] = cuerpo.perfil[k].map((x: unknown) => String(x).slice(0, 60)).filter(Boolean).slice(0, 80);
    }
    for (const k of NUMEROS) {
      const v = Number(cuerpo.perfil?.[k]);
      if (Number.isFinite(v) && v >= 0) p[k] = v;
    }
    p.creditosMes = Math.min(Math.max(p.creditosMes, 0), 200);
    p.soloSinRup = !!cuerpo.perfil?.soloSinRup;
    await store.setJSON("perfil", p);
    return json({ ok: true, perfil: p });
  }

  if (cuerpo?.accion === "destinos") {
    const d: Destinos = {
      chatId: String(cuerpo.destinos?.chatId || "").trim().slice(0, 40),
      correo: String(cuerpo.destinos?.correo || "").trim().slice(0, 120),
      soloNuevas: cuerpo.destinos?.soloNuevas !== false,
    };
    if (d.correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(d.correo)) return json({ error: "correo" }, 400);
    await store.setJSON("destinos", d);
    return json({ ok: true, destinos: d });
  }

  if (cuerpo?.accion === "detectar") {
    return json(await chatsDelBot());
  }

  if (cuerpo?.accion === "probar") {
    const destinos = await leerDestinos(context);
    const informe: any = (await store.get("informe", { type: "json" }).catch(() => null)) || {
      fecha: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      revisados: 0, candidatos: 0, nuevos: 0, valorTotal: 0, departamentos: [], procesos: [],
    };
    const sitio = (Netlify.env.get("URL") || "").replace(/\/+$/, "");
    const canal = String(cuerpo.canal || "");
    if (canal === "telegram") return json(await enviarTelegram("<b>Prueba del agente</b>\nSi ves este mensaje, los avisos por Telegram quedaron funcionando.\n\n" + textoTelegram(informe, sitio, false), String(cuerpo.chatId || destinos.chatId)));
    if (canal === "correo") return json(await enviarCorreo("Prueba del agente de oportunidades", htmlCorreo(informe, sitio, false), String(cuerpo.correo || destinos.correo)));
    return json({ ok: false, error: "canal" }, 400);
  }

  if (cuerpo?.accion === "ejecutar") {
    const base = Netlify.env.get("URL") || "";
    const r = await fetch(`${base}/.netlify/functions/agente-background`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origen: "manual" }),
    });
    return json({ ok: r.status === 202 || r.ok, estado: r.status });
  }

  return json({ error: "accion" }, 400);
};

export const config: Config = { path: "/api/agente" };
