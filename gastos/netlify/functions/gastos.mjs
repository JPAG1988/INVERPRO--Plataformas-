// Función servidor de Mis Gastos.
//   /api/ingresar  → lo llaman los Atajos del iPhone (SMS del banco, Apple Pay, voz).
//   /api/gastos    → lo usa la app: leer el libro, aprobar, editar, ajustes.
// Todo el libro vive en un solo blob de Netlify Blobs; cada escritura es condicional
// (etag) para que un SMS y un pago de Apple Pay que llegan a la vez no se pisen.
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { crearLibro, leerSMS, incorporar, leerTextoLibre, aprender, parseMonto, partesBogota, isoBogota } from "./lib/motor.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const claveOk = (req, esperada) => {
  const dada = req.headers.get("x-clave") || new URL(req.url).searchParams.get("clave") || "";
  if (dada.length !== esperada.length) return false;
  let dif = 0;
  for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ dada.charCodeAt(i);
  return dif === 0;
};

const almacen = () => getStore({ name: "gastos", consistency: "strong" });

async function leerLibro() {
  const r = await almacen().getWithMetadata("libro", { type: "json" });
  return { libro: r?.data || crearLibro(), etag: r?.etag };
}

// Lee, aplica el cambio y guarda solo si nadie escribió en el medio; si no, reintenta.
async function modificar(cambio) {
  for (let intento = 0; intento < 6; intento++) {
    const { libro, etag } = await leerLibro();
    const salida = await cambio(libro);
    const r = etag
      ? await almacen().setJSON("libro", libro, { onlyIfMatch: etag })
      : await almacen().setJSON("libro", libro, { onlyIfNew: true });
    if (r.modified) return { libro, salida };
  }
  throw new Error("El libro está ocupado, intenta de nuevo");
}

// Interpreta con IA un gasto dictado cuando la lectura local no basta.
async function interpretarConIA(libro, texto) {
  if (!Netlify.env.get("ANTHROPIC_API_KEY")) return null;
  const hoy = partesBogota();
  const cats = libro.categorias.map((c) => c.id);
  const cuentas = libro.cuentas.map((c) => c.id);
  const empresas = ["", ...libro.empresas.map((e) => e.id)];
  const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });
  const r = await client.beta.messages.create({
    model: Netlify.env.get("GASTOS_MODELO") || "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["tipo", "monto", "comercio", "cat", "cuenta", "empresa", "fecha"],
          properties: {
            tipo: { type: "string", enum: ["gasto", "ingreso"] },
            monto: { type: "integer", description: "Pesos colombianos, entero" },
            comercio: { type: "string", description: "Dónde o en qué, corto, con mayúscula inicial" },
            cat: { type: "string", enum: cats },
            cuenta: { type: "string", enum: cuentas },
            empresa: { type: "string", enum: empresas },
            fecha: { type: "string", description: "AAAA-MM-DD, o vacío si es hoy" },
          },
        },
      },
    },
    system:
      "Conviertes lo que una persona en Colombia dicta sobre su dinero en un movimiento. " +
      `Hoy es ${isoBogota(hoy.y, hoy.m, hoy.d).slice(0, 10)}. "mil" o "lucas" = ×1.000, "palo" o "millón" = ×1.000.000. ` +
      "Si no menciona cuenta o tarjeta, la cuenta es efectivo. Empresa vacía salvo que la nombre. " +
      `Categorías: ${libro.categorias.map((c) => `${c.id} (${c.nombre})`).join(", ")}. ` +
      `Cuentas: ${libro.cuentas.map((c) => `${c.id} (${c.nombre})`).join(", ")}. ` +
      `Empresas: ${libro.empresas.map((e) => `${e.id} (${e.nombre})`).join(", ") || "ninguna"}.`,
    messages: [{ role: "user", content: texto }],
  });
  if (r.stop_reason === "refusal") return null;
  const bloque = r.content.find((b) => b.type === "text");
  if (!bloque) return null;
  const d = JSON.parse(bloque.text);
  return {
    tipo: d.tipo, monto: d.monto, comercio: d.comercio, cat: d.cat, cuenta: d.cuenta, empresa: d.empresa || null,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) ? `${d.fecha}T12:00:00-05:00` : null, segura: true,
  };
}

async function hechoDeTexto(libro, texto) {
  const local = leerTextoLibre(libro, texto);
  if (local.segura) return local;
  try {
    return (await interpretarConIA(libro, texto)) || local;
  } catch (e) {
    console.error("IA:", e.message);
    return local;
  }
}

// Lo que llega de los Atajos: { fuente: "sms"|"applepay"|"voz", texto?, monto?, comercio?, tarjeta?, fecha? }
async function ingresar(entrada) {
  const fuente = String(entrada.fuente || (entrada.comercio ? "applepay" : "sms")).toLowerCase();
  const texto = String(entrada.texto || "").trim().slice(0, 1000);
  const recibido = entrada.fecha && !isNaN(new Date(entrada.fecha)) ? new Date(entrada.fecha) : new Date();

  if (fuente === "sms") {
    const hecho = leerSMS(texto, recibido);
    if (!hecho) return { libro: null, salida: { accion: "ignorado", mensaje: "Mensaje sin movimiento" } };
    return modificar((libro) => incorporar(libro, { ...hecho, fuente: "sms", texto }, new Date()));
  }
  if (fuente === "applepay") {
    const hecho = {
      tipo: "gasto", fuente: "applepay", monto: parseMonto(entrada.monto), comercio: String(entrada.comercio || "").trim().slice(0, 80),
      tarjeta: String(entrada.tarjeta || "").slice(0, 80), fecha: isoAhora(recibido),
    };
    return modificar((libro) => incorporar(libro, hecho, new Date()));
  }
  // voz o texto libre
  const { libro: actual } = await leerLibro();
  const hecho = await hechoDeTexto(actual, texto);
  return modificar((libro) => incorporar(libro, { ...hecho, fuente: "voz", nota: texto }, new Date()));
}

const isoAhora = (d) => { const p = partesBogota(d); return isoBogota(p.y, p.m, p.d, p.h, p.mi); };

// ——— Validación de lo que manda la app ———
const TIPOS = ["gasto", "ingreso", "traslado"];
const texto = (v, n) => String(v ?? "").trim().slice(0, n);
const esId = (lista, v) => (v && lista.some((x) => x.id === v) ? v : null);
const nuevoId = (base, lista) => { let id = base, n = 2; while (lista.some((x) => x.id === id)) id = `${base}-${n++}`; return id; };
const slug = (s) => texto(s, 40).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

function limpiarMov(libro, m, previo = {}) {
  const fecha = new Date(m.fecha);
  const tipo = TIPOS.includes(m.tipo) ? m.tipo : "gasto";
  const cats = libro.categorias.filter((c) => (tipo === "ingreso" ? c.tipo === "ingreso" : c.tipo === "gasto"));
  return {
    ...previo,
    id: previo.id || globalThis.crypto.randomUUID(),
    tipo,
    fecha: isNaN(fecha) ? isoAhora(new Date()) : isoAhora(fecha),
    monto: Math.max(0, Math.round(Number(m.monto) || 0)),
    cuenta: esId(libro.cuentas, m.cuenta),
    destino: tipo === "traslado" ? esId(libro.cuentas, m.destino) : null,
    comercio: texto(m.comercio, 80) || (tipo === "ingreso" ? "Ingreso" : tipo === "traslado" ? "Traslado" : "Gasto"),
    cat: tipo === "traslado" ? null : esId(cats, m.cat) || (tipo === "ingreso" ? "otros_ingresos" : "otros"),
    empresa: esId(libro.empresas, m.empresa),
    nota: texto(m.nota, 200),
    reembolsable: !!m.reembolsable,
    reembolsado: !!m.reembolsado,
    estado: m.estado === "pendiente" ? "pendiente" : "ok",
    fuentes: previo.fuentes || ["manual"],
    creado: previo.creado || new Date().toISOString(),
  };
}

function limpiarAjustes(libro, a) {
  if (Array.isArray(a.cuentas)) {
    libro.cuentas = a.cuentas.slice(0, 20).map((c) => {
      const previa = libro.cuentas.find((x) => x.id === c.id) || {};
      const tipo = ["debito", "credito", "efectivo"].includes(c.tipo) ? c.tipo : "debito";
      return {
        ...previa,
        id: previa.id || nuevoId(slug(c.nombre), libro.cuentas),
        nombre: texto(c.nombre, 50) || "Cuenta",
        tipo,
        ultimos: texto(c.ultimos, 4).replace(/\D/g, ""),
        claves: (Array.isArray(c.claves) ? c.claves : String(c.claves || "").split(",")).map((k) => texto(k, 30)).filter(Boolean).slice(0, 8),
        cupo: Math.max(0, Number(c.cupo) || 0),
        diaCorte: Math.min(31, Math.max(0, Number(c.diaCorte) || 0)),
        diaPago: Math.min(31, Math.max(0, Number(c.diaPago) || 0)),
      };
    });
    if (!libro.cuentas.some((c) => c.id === "efectivo")) libro.cuentas.push({ id: "efectivo", nombre: "Efectivo", tipo: "efectivo", claves: ["efectivo"], saldoInicial: 0 });
  }
  if (Array.isArray(a.empresas)) {
    libro.empresas = a.empresas.slice(0, 20).filter((e) => texto(e.nombre, 60)).map((e) => ({
      id: e.id && libro.empresas.some((x) => x.id === e.id) ? e.id : "e-" + slug(e.nombre),
      nombre: texto(e.nombre, 60),
      nit: texto(e.nit, 20),
    }));
  }
  if (Array.isArray(a.categorias)) {
    libro.categorias = a.categorias.slice(0, 40).filter((c) => texto(c.nombre, 40)).map((c) => ({
      id: c.id && libro.categorias.some((x) => x.id === c.id) ? c.id : "c-" + slug(c.nombre),
      nombre: texto(c.nombre, 40),
      tipo: c.tipo === "ingreso" ? "ingreso" : "gasto",
      presupuesto: Math.max(0, Math.round(Number(c.presupuesto) || 0)),
    }));
  }
  if (a.config) {
    libro.config = {
      umbralSalario: Math.max(0, Number(a.config.umbralSalario) || 3000000),
      umbralHormiga: Math.max(0, Number(a.config.umbralHormiga) || 30000),
      diaSalario: Math.min(31, Math.max(0, Number(a.config.diaSalario) || 0)),
    };
  }
}

async function accionApp(cuerpo) {
  switch (cuerpo.accion) {
    case "guardar":
      return modificar((libro) => {
        const i = libro.movs.findIndex((x) => x.id === cuerpo.mov?.id);
        const mov = limpiarMov(libro, cuerpo.mov || {}, i >= 0 ? libro.movs[i] : {});
        if (!mov.monto) throw new Error("El monto debe ser mayor que cero");
        if (i >= 0) libro.movs[i] = mov; else libro.movs.push(mov);
        if (mov.estado === "ok" && cuerpo.aprender !== false) aprender(libro, mov);
        return { mov };
      });
    case "aprobar":
      return modificar((libro) => {
        for (const a of (cuerpo.lista || [cuerpo]).slice(0, 200)) {
          const mov = libro.movs.find((x) => x.id === a.id);
          if (!mov) continue;
          Object.assign(mov, limpiarMov(libro, { ...mov, ...a, estado: "ok" }, mov));
          aprender(libro, mov);
        }
        return {};
      });
    case "borrar":
      return modificar((libro) => { libro.movs = libro.movs.filter((x) => x.id !== cuerpo.id); return {}; });
    case "ajustes":
      return modificar((libro) => { limpiarAjustes(libro, cuerpo); return {}; });
    case "saldo":
      // Punto de partida de una cuenta: el saldo (o la deuda) que muestra el banco hoy.
      return modificar((libro) => {
        const c = libro.cuentas.find((x) => x.id === cuerpo.cuenta);
        if (!c) throw new Error("Cuenta no encontrada");
        const valor = Math.round(Number(cuerpo.valor) || 0);
        if (c.tipo === "credito") c.deudaInicial = valor; else c.saldoInicial = valor;
        c.desde = new Date().toISOString();
        if (c.tipo === "credito" && cuerpo.proximoPago?.fecha) {
          c.proximoPago = { fecha: texto(cuerpo.proximoPago.fecha, 10), monto: Math.round(Number(cuerpo.proximoPago.monto) || 0), registrado: new Date().toISOString() };
        }
        return {};
      });
    case "texto":
      return ingresar({ fuente: "voz", texto: cuerpo.texto });
    case "sms":
      return ingresar({ fuente: "sms", texto: cuerpo.texto, fecha: cuerpo.fecha });
    default:
      throw new Error("Acción no reconocida");
  }
}

export default async (req) => {
  const esperada = Netlify.env.get("GASTOS_CLAVE");
  if (!esperada) return json({ error: "Falta configurar GASTOS_CLAVE en las variables de entorno de Netlify" }, 503);
  if (!claveOk(req, esperada)) return json({ error: "Clave incorrecta" }, 401);

  const ruta = new URL(req.url).pathname;
  try {
    if (ruta.endsWith("/ingresar")) {
      if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
      const crudo = await req.text();
      let entrada;
      try { entrada = JSON.parse(crudo); } catch { entrada = { fuente: "sms", texto: crudo }; }
      const { salida } = await ingresar(entrada || {});
      // "mensaje" es lo que el Atajo muestra en la notificación o lo que Siri lee en voz alta.
      return json({ ok: salida.accion !== "ignorado", accion: salida.accion, mensaje: salida.mensaje, id: salida.mov?.id });
    }

    if (req.method === "GET") {
      const { libro } = await leerLibro();
      return json({ libro, ia: !!Netlify.env.get("ANTHROPIC_API_KEY") });
    }
    if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
    const origen = req.headers.get("origin");
    if (origen && new URL(origen).host !== new URL(req.url).host) return json({ error: "Origen no permitido" }, 403);
    const cuerpo = await req.json().catch(() => ({}));
    const { libro, salida } = await accionApp(cuerpo);
    return json({ ok: true, ...salida, libro: libro || (await leerLibro()).libro });
  } catch (e) {
    return json({ error: e.message }, 400);
  }
};

export const config = { path: ["/api/gastos", "/api/ingresar"] };
