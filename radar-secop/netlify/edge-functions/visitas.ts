import type { Config, Context } from "@netlify/edge-functions";
import { getStore } from "@netlify/blobs";

// Contador de visitas de Radar SECOP y Ojo al contrato.
// Cuenta una visita por navegador y por día: la página solo envía POST
// la primera vez que se abre cada día (ver marca en localStorage).
// No guarda direcciones IP, cookies ni ningún dato de la persona.

const SITIOS = new Set(["radar", "veeduria", "preparar"]);

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function claveDia() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("year")}${v("month")}${v("day")}`;
}

const almacen = (context: Context) =>
  getStore(context.deploy?.context === "production" ? "visitas" : "visitas-pruebas");

async function leer(store: ReturnType<typeof getStore>, clave: string): Promise<number> {
  try {
    const v = (await store.get(clave, { type: "json" })) as { n?: number } | null;
    return v?.n || 0;
  } catch {
    return 0;
  }
}

async function conteos(store: ReturnType<typeof getStore>, sitio: string, dia: string) {
  const [total, hoy] = await Promise.all([leer(store, `${sitio}/total`), leer(store, `${sitio}/dia/${dia}`)]);
  return { total, hoy };
}

export default async (req: Request, context: Context) => {
  const origen = req.headers.get("origin");
  if (origen && new URL(origen).host !== new URL(req.url).host) return json({ error: "origen" }, 403);

  const store = almacen(context);
  const dia = claveDia();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const sitio = url.searchParams.get("sitio");
    if (sitio && SITIOS.has(sitio)) return json({ sitio, ...(await conteos(store, sitio, dia)) });
    const todos = await Promise.all([...SITIOS].map(async (s) => [s, await conteos(store, s, dia)] as const));
    return json(Object.fromEntries(todos));
  }

  if (req.method !== "POST") return json({ error: "metodo" }, 405);

  let sitio = "";
  try {
    sitio = String(((await req.json()) as any)?.sitio || "");
  } catch {
    return json({ error: "invalido" }, 400);
  }
  if (!SITIOS.has(sitio)) return json({ error: "sitio" }, 400);

  const kTotal = `${sitio}/total`, kDia = `${sitio}/dia/${dia}`;
  try {
    const [total, hoy] = await Promise.all([leer(store, kTotal), leer(store, kDia)]);
    await Promise.all([store.setJSON(kTotal, { n: total + 1 }), store.setJSON(kDia, { n: hoy + 1 })]);
    return json({ sitio, total: total + 1, hoy: hoy + 1 });
  } catch (e) {
    console.error("No se pudo registrar la visita", e);
    return json({ sitio, ...(await conteos(store, sitio, dia)) });
  }
};

export const config: Config = { path: "/api/visitas" };
