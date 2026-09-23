import type { Config, Context } from "@netlify/edge-functions";
import { getStore } from "@netlify/blobs";

// Revisión con IA de los datos que la lectura por reglas no logró extraer de un pliego.
// Recibe solo fragmentos del documento, nunca el archivo. Devuelve JSON estructurado.
// Comparte el presupuesto mensual de créditos con el asistente de veeduría.

const MODELO_DEFECTO = "claude-haiku-4-5";
const TARIFAS: Record<string, [number, number, number, number]> = {
  "claude-haiku-4-5": [1, 0.1, 5, 1.25],
  "claude-sonnet-5": [2, 0.2, 10, 2.5],
};
const CREDITOS_POR_USD = 180;
const MAX_EXTRACTO = 16000;
const MAX_TOKENS = 1400;

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const claveTiempo = (f: "hora" | "dia" | "mes") => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  if (f === "mes") return `${v("year")}${v("month")}`;
  return f === "dia" ? `${v("year")}${v("month")}${v("day")}` : `${v("year")}${v("month")}${v("day")}${v("hour")}`;
};
async function hashIp(ip: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ojo-al-contrato:" + ip));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const almacen = (context: Context) => getStore(context.deploy?.context === "production" ? "asistente-limites" : "asistente-limites-pruebas");
const limites = () => ({
  porHora: Number(Netlify.env.get("PLIEGO_LIMITE_HORA") || 10),
  porDia: Number(Netlify.env.get("PLIEGO_LIMITE_DIA") || 60),
  creditosMes: Number(Netlify.env.get("ASISTENTE_CREDITOS_MES") || 100),
});

async function leer(store: ReturnType<typeof getStore>, k: string) {
  try { return ((await store.get(k, { type: "json" })) as any)?.n || 0; } catch { return 0; }
}

const SISTEMA = `Eres un analista de pliegos de contratación pública colombiana. Recibes fragmentos del texto de un pliego y extraes datos concretos.

Respondes ÚNICAMENTE con un objeto JSON válido, sin explicaciones, sin texto antes ni después y sin bloques de código. Usa exactamente esta forma, omitiendo las claves cuyo dato no aparezca con claridad en el texto:

{
  "objeto": "texto del objeto del proceso",
  "presupuesto": 1850000000,
  "plazo": { "n": 6, "u": "mes" },
  "cronograma": [ { "etapa": "Cierre y presentación de ofertas", "fecha": "2026-10-02", "hora": "10:00", "cierre": true } ],
  "indicadores": [ { "k": "liquidez", "t": "Índice de liquidez", "cmp": ">=", "exigido": 1.5, "unidad": "veces" } ],
  "experiencia": { "contratos": 3, "smmlv": 1585, "porcentaje": 150, "unspsc": ["72141100"] }
}

Reglas:
- Las claves válidas de indicadores son: liquidez, endeudamiento, cobertura, rentPat, rentAct, capital. El endeudamiento se expresa en porcentaje y usa cmp "<="; los demás usan ">=".
- Las fechas van en formato AAAA-MM-DD y las horas en formato de 24 horas. Marca "cierre": true solo en la fecha límite para presentar ofertas.
- "presupuesto" es un número entero en pesos, sin puntos ni símbolos.
- En experiencia, "smmlv" es el número de salarios mínimos exigidos y "porcentaje" el porcentaje del presupuesto, si el pliego lo expresa así.
- No inventes ningún dato: si algo no está explícito en el texto, omite esa clave. Es preferible devolver poco a devolver algo incorrecto.
- Si el texto no contiene ninguno de estos datos, responde {}.`;

export default async (req: Request, context: Context) => {
  const origen = req.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(req.url).host) return json({ error: "origen" }, 403);

  const clave = Netlify.env.get("ANTHROPIC_API_KEY");
  if (req.method === "GET") return json({ activo: !!clave });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  if (!clave) return json({ error: "no_configurado" }, 503);

  let cuerpo: any;
  try { cuerpo = await req.json(); } catch { return json({ error: "invalido" }, 400); }
  const extracto = String(cuerpo?.extracto || "").slice(0, MAX_EXTRACTO);
  if (extracto.length < 200) return json({ error: "invalido" }, 400);
  const faltantes = Array.isArray(cuerpo?.faltantes) ? cuerpo.faltantes.slice(0, 8).map(String) : [];

  const propia = clave.startsWith("sk-ant-");
  const store = almacen(context);
  const lim = limites();

  if (!propia) {
    const creditos = ((await store.get(`creditos/${claveTiempo("mes")}`, { type: "json" })) as any)?.c || 0;
    if (creditos >= lim.creditosMes) return json({ error: "limite_mes" }, 429);
  }
  try {
    const kIp = `pliego/${await hashIp(context.ip || "?")}/${claveTiempo("hora")}`;
    const kDia = `pliego/dia/${claveTiempo("dia")}`;
    const [nIp, nDia] = await Promise.all([leer(store, kIp), leer(store, kDia)]);
    if (nIp >= lim.porHora) return json({ error: "limite_ip" }, 429);
    if (nDia >= lim.porDia) return json({ error: "limite_dia" }, 429);
    await Promise.all([store.setJSON(kIp, { n: nIp + 1 }), store.setJSON(kDia, { n: nDia + 1 })]);
  } catch (e) { console.error("límite", e); }

  const modelo = Netlify.env.get("ASISTENTE_MODELO") || MODELO_DEFECTO;
  const base = (propia ? "https://api.anthropic.com" : (Netlify.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com")).replace(/\/+$/, "");
  const pregunta = `Del siguiente pliego necesito${faltantes.length ? ", sobre todo, " + faltantes.join(", ") : " los datos que encuentres"}.\n\n<pliego>\n${extracto}\n</pliego>`;

  let r: Response;
  try {
    r = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": clave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modelo, max_tokens: MAX_TOKENS,
        system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: pregunta }, { role: "assistant", content: "{" }],
      }),
    });
  } catch (e) {
    console.error("fetch modelo", e);
    return json({ error: "modelo" }, 502);
  }
  if (!r.ok) {
    console.error("modelo", r.status, (await r.text()).slice(0, 300));
    return json({ error: [403, 429, 529].includes(r.status) ? "ocupado" : "modelo" }, r.status === 429 ? 503 : 502);
  }
  const data: any = await r.json();

  // Registro del consumo en créditos
  if (!propia) {
    const u = data?.usage || {};
    const t = TARIFAS[modelo] || TARIFAS[MODELO_DEFECTO];
    const usd = ((u.input_tokens || 0) * t[0] + (u.cache_read_input_tokens || 0) * t[1] + (u.output_tokens || 0) * t[2] + (u.cache_creation_input_tokens || 0) * t[3]) / 1e6;
    if (usd > 0) {
      const k = `creditos/${claveTiempo("mes")}`;
      const guardar = (async () => {
        try {
          const previo = ((await store.get(k, { type: "json" })) as any)?.c || 0;
          await store.setJSON(k, { c: previo + usd * CREDITOS_POR_USD });
        } catch (e) { console.error("créditos", e); }
      })();
      (context as any).waitUntil ? (context as any).waitUntil(guardar) : guardar.catch(() => {});
    }
  }

  const texto = "{" + (data?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  try {
    const limpio = texto.replace(/```json|```/g, "").trim();
    const fin = limpio.lastIndexOf("}");
    return json(JSON.parse(fin > 0 ? limpio.slice(0, fin + 1) : limpio));
  } catch {
    console.error("respuesta no interpretable", texto.slice(0, 200));
    return json({ error: "formato" }, 502);
  }
};

export const config: Config = { path: "/api/pliego" };
