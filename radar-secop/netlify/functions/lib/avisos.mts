import type { Context } from "@netlify/functions";
import { almacen } from "./perfil.mts";

// Avisos del agente. Los secretos (token del bot, llave del correo) viven en variables
// de entorno; los destinos (chat y correo) se guardan con el perfil.

export type Destinos = { chatId: string; correo: string; soloNuevas: boolean };

export const DESTINOS_BASE: Destinos = { chatId: "", correo: "", soloNuevas: true };

export async function leerDestinos(context: Context): Promise<Destinos> {
  try {
    const d = (await almacen(context).get("destinos", { type: "json" })) as Destinos | null;
    return d ? { ...DESTINOS_BASE, ...d } : DESTINOS_BASE;
  } catch {
    return DESTINOS_BASE;
  }
}

const money = (v: number) => {
  const a = Math.abs(v || 0);
  if (!v) return "sin valor publicado";
  if (a >= 1e9) return "$" + (v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " mil millones";
  if (a >= 1e6) return "$" + (v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: a < 1e7 ? 1 : 0 }) + " millones";
  return "$" + Math.round(v).toLocaleString("es-CO");
};
const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
const cierra = (d: number) => (d === 0 ? "cierra hoy" : d === 1 ? "cierra mañana" : `cierra en ${d} días`);
const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export type InformeMin = {
  fecha: string; revisados: number; candidatos: number; nuevos: number; valorTotal: number;
  departamentos: string[];
  procesos: Array<{ entidad: string; mun: string; objeto: string; valor: number; dl: number; nuevo: boolean; veredicto?: string; url: string; modalidad: string }>;
};

// Selecciona lo que vale la pena avisar: primero lo nuevo que la IA marcó como buen encaje.
export function destacados(informe: InformeMin, soloNuevas: boolean) {
  const base = soloNuevas ? informe.procesos.filter((p) => p.nuevo) : informe.procesos;
  const buenos = base.filter((p) => (p.veredicto || "").startsWith("Sí"));
  return (buenos.length ? buenos : base).slice(0, 5);
}

export function textoTelegram(informe: InformeMin, sitio: string, soloNuevas: boolean) {
  const lista = destacados(informe, soloNuevas);
  const dptos = (informe.departamentos || []).join(", ") || "todo el país";
  const cabeza = soloNuevas
    ? `<b>Radar SECOP · ${fechaLarga(informe.fecha)}</b>\n${informe.nuevos} oportunidad${informe.nuevos === 1 ? "" : "es"} nueva${informe.nuevos === 1 ? "" : "s"} en ${esc(dptos)}.`
    : `<b>Radar SECOP · ${fechaLarga(informe.fecha)}</b>\n${informe.candidatos} oportunidades abiertas en ${esc(dptos)} por ${money(informe.valorTotal)}.`;
  const cuerpo = lista.map((p) => {
    const v = p.veredicto ? `\n<i>${esc(p.veredicto)}</i>` : "";
    const enlace = p.url ? `\n<a href="${p.url}">Ver en SECOP</a>` : "";
    return `\n\n<b>${esc(p.entidad)}</b>${p.mun ? " · " + esc(p.mun) : ""}\n${esc(p.objeto.slice(0, 170))}\n${money(p.valor)} · ${cierra(p.dl)} · ${esc(p.modalidad)}${v}${enlace}`;
  }).join("");
  return `${cabeza}${cuerpo}\n\n<a href="${sitio}/agente/">Ver el informe completo</a>`;
}

export function htmlCorreo(informe: InformeMin, sitio: string, soloNuevas: boolean) {
  const lista = destacados(informe, soloNuevas);
  const dptos = (informe.departamentos || []).join(", ") || "todo el país";
  const filas = lista.map((p) => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #D9DED6">
      <div style="font:600 15px/1.4 Arial,sans-serif;color:#15223B">${esc(p.entidad)}${p.mun ? ` · ${esc(p.mun)}` : ""}</div>
      <div style="font:400 14px/1.5 Arial,sans-serif;color:#48546B;margin:4px 0">${esc(p.objeto.slice(0, 220))}</div>
      <div style="font:700 14px/1.4 Arial,sans-serif;color:#15223B">${money(p.valor)} · ${cierra(p.dl)}</div>
      <div style="font:400 13px/1.4 Arial,sans-serif;color:#737E92">${esc(p.modalidad)}</div>
      ${p.veredicto ? `<div style="font:400 13px/1.5 Arial,sans-serif;color:#1E6B53;margin-top:5px">${esc(p.veredicto)}</div>` : ""}
      ${p.url ? `<div style="margin-top:6px"><a href="${p.url}" style="font:600 13px Arial,sans-serif;color:#1E6B53">Ver en SECOP</a></div>` : ""}
    </td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#F2F4F0;padding:18px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #D9DED6;border-radius:10px;padding:20px">
      <div style="font:700 20px/1.2 Arial,sans-serif;color:#15223B">Radar SECOP</div>
      <div style="font:400 14px/1.5 Arial,sans-serif;color:#48546B;margin:6px 0 14px">
        ${fechaLarga(informe.fecha)} · Revisé ${informe.revisados} procesos abiertos en ${esc(dptos)} y encontré
        <b>${informe.candidatos} que encajan</b> con tu perfil, de los cuales <b>${informe.nuevos}</b> son nuevos.
      </div>
      <table style="width:100%;border-collapse:collapse">${filas}</table>
      <div style="margin-top:18px">
        <a href="${sitio}/agente/" style="display:inline-block;background:#15223B;color:#fff;text-decoration:none;font:600 14px Arial,sans-serif;padding:11px 18px;border-radius:8px">Ver el informe completo</a>
      </div>
      <div style="font:400 12px/1.5 Arial,sans-serif;color:#737E92;margin-top:18px;border-top:1px solid #D9DED6;padding-top:12px">
        Agente de oportunidades de INVERPRO. Datos de SECOP II publicados por Colombia Compra Eficiente en datos.gov.co.
        Los veredictos son automáticos: verifica siempre en SECOP antes de decidir.
      </div>
    </div></body></html>`;
}

export async function enviarTelegram(texto: string, chatId: string) {
  const token = Netlify.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, error: "Falta el token del bot de Telegram" };
  if (!chatId) return { ok: false, error: "Falta el chat de destino" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const j: any = await r.json();
    return j?.ok ? { ok: true } : { ok: false, error: String(j?.description || "Telegram rechazó el mensaje") };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Busca el chat de quien ya le escribió al bot, para no tener que pedir el identificador a mano.
export async function chatsDelBot() {
  const token = Netlify.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, error: "Falta el token del bot de Telegram", chats: [] };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=30`);
    const j: any = await r.json();
    if (!j?.ok) return { ok: false, error: String(j?.description || "Telegram no respondió"), chats: [] };
    const vistos = new Map<string, string>();
    for (const u of j.result || []) {
      const c = u?.message?.chat || u?.channel_post?.chat;
      if (!c?.id) continue;
      vistos.set(String(c.id), [c.first_name, c.last_name, c.title, c.username ? "@" + c.username : ""].filter(Boolean).join(" ") || String(c.id));
    }
    return { ok: true, chats: [...vistos.entries()].map(([id, nombre]) => ({ id, nombre })) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), chats: [] };
  }
}

export async function enviarCorreo(asunto: string, html: string, destino: string) {
  const clave = Netlify.env.get("RESEND_API_KEY");
  if (!clave) return { ok: false, error: "Falta la llave del servicio de correo" };
  if (!destino) return { ok: false, error: "Falta el correo de destino" };
  const remitente = Netlify.env.get("CORREO_REMITENTE") || "Radar SECOP <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "content-type": "application/json" },
      body: JSON.stringify({ from: remitente, to: [destino], subject: asunto, html }),
    });
    if (r.ok) return { ok: true };
    const t = await r.text();
    return { ok: false, error: `El servicio de correo respondió ${r.status}: ${t.slice(0, 160)}` };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function avisar(informe: InformeMin, context: Context) {
  const destinos = await leerDestinos(context);
  const sitio = (Netlify.env.get("URL") || "https://radar-secop.netlify.app").replace(/\/+$/, "");
  const hay = destinos.soloNuevas ? informe.nuevos > 0 : informe.candidatos > 0;
  if (!hay) return { enviados: [], nota: "sin novedades que avisar" };

  const resultados: Array<{ canal: string; ok: boolean; error?: string }> = [];
  if (destinos.chatId) {
    const r = await enviarTelegram(textoTelegram(informe, sitio, destinos.soloNuevas), destinos.chatId);
    resultados.push({ canal: "telegram", ...r });
  }
  if (destinos.correo) {
    const n = destinos.soloNuevas ? informe.nuevos : informe.candidatos;
    const asunto = `${n} oportunidad${n === 1 ? "" : "es"} en SECOP · ${fechaLarga(informe.fecha)}`;
    const r = await enviarCorreo(asunto, htmlCorreo(informe, sitio, destinos.soloNuevas), destinos.correo);
    resultados.push({ canal: "correo", ...r });
  }
  return { enviados: resultados, nota: resultados.length ? "" : "sin canales configurados" };
}
