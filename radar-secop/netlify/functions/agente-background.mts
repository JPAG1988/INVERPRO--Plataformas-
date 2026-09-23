import type { Context } from "@netlify/functions";

import { PERFIL_BASE, leerPerfil, almacen, almacenIA, norm, hoyBogota, mesActual, dias, money, sq, type Perfil } from "./lib/perfil.mts";
import { avisar } from "./lib/avisos.mts";

// Agente de oportunidades: revisa los procesos abiertos en SECOP II, evalúa cada uno
// contra el perfil de la empresa y guarda un informe diario. Corre en segundo plano
// (hasta 15 minutos) porque descarga y analiza miles de procesos.

const SECOP = "https://www.datos.gov.co/resource/p6dx-8zbt.json";
const MODELO = "claude-haiku-4-5";
const TARIFAS: Record<string, [number, number, number, number]> = {
  "claude-haiku-4-5": [1, 0.1, 5, 1.25],
  "claude-sonnet-5": [2, 0.2, 10, 2.5],
};
const CREDITOS_POR_USD = 180;
const MAX_IA = 6; // procesos que se envían a la IA por ejecución

type Proceso = {
  id: string; ref: string; entidad: string; dpto: string; mun: string;
  objeto: string; valor: number; cierre: string; dl: number; modalidad: string;
  tipo: string; unspsc: string; dur: string; rup: boolean; url: string;
  puntos: number; razones: string[]; nuevo: boolean; veredicto?: string;
};

export async function traerProcesos(perfil: Perfil): Promise<any[]> {
  const hoy = hoyBogota();
  const campos = [
    "id_del_proceso", "referencia_del_proceso", "entidad", "departamento_entidad", "ciudad_entidad",
    "nombre_del_procedimiento", "descripci_n_del_procedimiento", "fecha_de_recepcion_de", "precio_base",
    "modalidad_de_contratacion", "tipo_de_contrato", "codigo_principal_de_categoria", "duracion",
    "unidad_de_duracion", "urlproceso",
  ];
  const donde = [`fecha_de_recepcion_de >= '${hoy}T00:00:00'`];
  if (perfil.departamentos.length) {
    donde.push(`departamento_entidad in(${perfil.departamentos.map(sq).join(",")})`);
  }
  const filas: any[] = [];
  for (let offset = 0; offset < 30000; offset += 5000) {
    const q = new URLSearchParams({
      $select: campos.join(","), $where: donde.join(" AND "),
      $order: ":id", $limit: "5000", $offset: String(offset),
    });
    const r = await fetch(`${SECOP}?${q}`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("SECOP respondió " + r.status);
    const page = await r.json();
    filas.push(...page);
    if (page.length < 5000) break;
  }
  return filas;
}

// Puntaje por reglas: territorio, actividad, clasificador, valor y urgencia.
export function evaluar(fila: any, perfil: Perfil, vistos: Set<string>): Proceso | null {
  const nom = String(fila.nombre_del_procedimiento || "").trim();
  const des = String(fila.descripci_n_del_procedimiento || "").trim();
  const objeto = (des.length > nom.length ? des : nom || des).slice(0, 400);
  // Se evalúa con los dos campos: SECOP reparte el contenido entre el nombre y la descripción.
  const texto = norm([nom, des, fila.entidad, fila.tipo_de_contrato, fila.referencia_del_proceso].join(" "));
  const valor = Number(fila.precio_base) || 0;
  const cierre = String(fila.fecha_de_recepcion_de || "").slice(0, 10);
  const dl = cierre ? dias(hoyBogota(), cierre) : -1;
  const mod = String(fila.modalidad_de_contratacion || "");
  const unspsc = String(fila.codigo_principal_de_categoria || "").replace(/^V\d+\./, "");

  if (perfil.excluir.some((x) => x && texto.includes(norm(x)))) return null;
  if (dl < perfil.diasMin) return null;
  if (perfil.valorMin && valor && valor < perfil.valorMin) return null;
  if (perfil.valorMax && valor > perfil.valorMax) return null;
  if (perfil.modalidades.length && !perfil.modalidades.includes(mod)) return null;
  const rup = !/m[ií]nima cuant[ií]a|directa|r[eé]gimen especial/i.test(mod);
  if (perfil.soloSinRup && rup) return null;

  const razones: string[] = [];
  let puntos = 0;

  const coincidencias = perfil.palabras.filter((x) => x && texto.includes(norm(x)));
  if (coincidencias.length) {
    puntos += Math.min(coincidencias.length, 4) * 10;
    razones.push(`coincide con ${coincidencias.slice(0, 3).join(", ")}`);
  }
  if (unspsc && perfil.unspsc.some((c) => c === unspsc || c.slice(0, 6) === unspsc.slice(0, 6))) {
    puntos += 18;
    razones.push(`clasificador ${unspsc} está en tu RUP`);
  }
  if (!coincidencias.length && puntos === 0) return null;

  if (valor >= 100e6 && valor <= 3000e6) { puntos += 8; razones.push("valor dentro de tu rango habitual"); }
  if (!rup) { puntos += 6; razones.push("no exige RUP"); }
  if (dl <= 7) { puntos += 5; razones.push(`cierra en ${dl} día${dl === 1 ? "" : "s"}`); }

  const id = String(fila.id_del_proceso || "");
  const url = fila.urlproceso && typeof fila.urlproceso === "object" ? fila.urlproceso.url : String(fila.urlproceso || "");

  return {
    id, ref: String(fila.referencia_del_proceso || ""), entidad: String(fila.entidad || "").replace(/\s*\d+$/, "").trim(),
    dpto: String(fila.departamento_entidad || ""), mun: String(fila.ciudad_entidad || ""),
    objeto, valor, cierre, dl, modalidad: mod, tipo: String(fila.tipo_de_contrato || ""),
    unspsc, dur: fila.duracion ? `${fila.duracion} ${fila.unidad_de_duracion || ""}`.trim() : "",
    rup, url, puntos, razones, nuevo: !vistos.has(id),
  };
}

async function creditosDelMes(context: Context) {
  try {
    return ((await almacenIA(context).get(`creditos/${mesActual()}`, { type: "json" })) as any)?.c || 0;
  } catch { return 0; }
}

// Un solo llamado al modelo para los mejores candidatos: devuelve un veredicto por proceso.
async function veredictos(procesos: Proceso[], perfil: Perfil, context: Context) {
  const clave = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!clave || !procesos.length) return { usados: 0, nota: clave ? "sin candidatos" : "IA no configurada" };
  const propia = clave.startsWith("sk-ant-");
  const gastados = await almacenIA(context).get(`agente/creditos/${mesActual()}`, { type: "json" }).then((x: any) => x?.c || 0).catch(() => 0);
  if (!propia && gastados >= perfil.creditosMes) return { usados: 0, nota: "presupuesto mensual del agente agotado" };

  const lista = procesos.map((p, i) => `[${i + 1}] Entidad: ${p.entidad} (${p.mun}, ${p.dpto})
Objeto: ${p.objeto}
Valor: ${p.valor ? money(p.valor) : "no publicado"} | Modalidad: ${p.modalidad} | Cierra en ${p.dl} días | Plazo: ${p.dur || "no publicado"}`).join("\n\n");

  const sistema = `Eres el analista de oportunidades de una empresa colombiana de obras civiles, agua, topografía y gestión ambiental, con sede en Casanare. Su experiencia: construcción de plantas e infraestructura, vías terciarias, canales y reservorios, pozos y potabilización, topografía y estudios de suelos, trámites ambientales, reforestación y restauración.

Para cada proceso que te den, decide si vale la pena que la empresa se presente.

Responde SOLO con un JSON válido, sin texto adicional ni bloques de código, con esta forma:
{"veredictos":[{"n":1,"encaja":"si|quizas|no","razon":"una frase de máximo 20 palabras"}]}

Reglas: "si" solo cuando el objeto está claramente dentro de esas líneas de trabajo; "quizas" cuando es afín pero requiere capacidad que no se ve; "no" cuando es de otro sector. La razón debe ser concreta y mencionar el punto decisivo. No inventes datos que no estén en el texto.`;

  const base = (propia ? "https://api.anthropic.com" : (Netlify.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com")).replace(/\/+$/, "");
  const r = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": clave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Netlify.env.get("ASISTENTE_MODELO") || MODELO,
      max_tokens: 900,
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: lista }, { role: "assistant", content: "{" }],
    }),
  });
  if (!r.ok) {
    console.error("modelo", r.status, (await r.text()).slice(0, 200));
    return { usados: 0, nota: "el modelo no respondió" };
  }
  const data: any = await r.json();

  const u = data?.usage || {};
  const t = TARIFAS[MODELO];
  const usd = ((u.input_tokens || 0) * t[0] + (u.cache_read_input_tokens || 0) * t[1] + (u.output_tokens || 0) * t[2] + (u.cache_creation_input_tokens || 0) * t[3]) / 1e6;
  const creditos = usd * CREDITOS_POR_USD;
  if (!propia && creditos > 0) {
    try {
      const s = almacenIA(context);
      await s.setJSON(`agente/creditos/${mesActual()}`, { c: gastados + creditos });
      const tot = ((await s.get(`creditos/${mesActual()}`, { type: "json" })) as any)?.c || 0;
      await s.setJSON(`creditos/${mesActual()}`, { c: tot + creditos });
    } catch (e) { console.error("créditos", e); }
  }

  try {
    const txt = "{" + (data?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const fin = txt.lastIndexOf("}");
    const j = JSON.parse(fin > 0 ? txt.slice(0, fin + 1) : txt);
    for (const v of j.veredictos || []) {
      const p = procesos[(+v.n || 0) - 1];
      if (p) p.veredicto = `${v.encaja === "si" ? "Sí encaja" : v.encaja === "no" ? "No encaja" : "Puede encajar"}: ${String(v.razon || "").slice(0, 160)}`;
    }
    return { usados: Math.round(creditos * 10) / 10, nota: "" };
  } catch (e) {
    console.error("respuesta no interpretable", e);
    return { usados: Math.round(creditos * 10) / 10, nota: "la respuesta del modelo no se pudo leer" };
  }
}

export default async (req: Request, context: Context) => {
  const inicio = Date.now();
  const store = almacen(context);
  const hoy = hoyBogota();
  try {
    const perfil = await leerPerfil(context);
    const vistosPrev = (await store.get("vistos", { type: "json" }).catch(() => null)) as { ids?: string[] } | null;
    const vistos = new Set(vistosPrev?.ids || []);

    const filas = await traerProcesos(perfil);
    // SECOP devuelve varias filas por proceso (una por lote o por versión): se deja una sola.
    const candidatos: Proceso[] = [];
    const yaVisto = new Set<string>();
    for (const f of filas) {
      const p = evaluar(f, perfil, vistos);
      if (!p) continue;
      const clave = norm(p.entidad + "|" + p.objeto.slice(0, 120) + "|" + p.cierre + "|" + Math.round(p.valor));
      if (yaVisto.has(clave)) continue;
      yaVisto.add(clave);
      candidatos.push(p);
    }
    candidatos.sort((a, b) => (b.nuevo ? 1 : 0) - (a.nuevo ? 1 : 0) || b.puntos - a.puntos || a.dl - b.dl);

    const paraIA = candidatos.filter((p) => p.nuevo).slice(0, MAX_IA);
    const ia = await veredictos(paraIA.length ? paraIA : candidatos.slice(0, MAX_IA), perfil, context);

    const informe = {
      fecha: hoy,
      generado: new Date().toISOString(),
      revisados: filas.length,
      candidatos: candidatos.length,
      nuevos: candidatos.filter((p) => p.nuevo).length,
      valorTotal: candidatos.reduce((s, p) => s + p.valor, 0),
      creditosIA: ia.usados,
      notaIA: ia.nota,
      duracionMs: Date.now() - inicio,
      procesos: candidatos.slice(0, 60),
      departamentos: perfil.departamentos,
    };
    const aviso = await avisar(informe as any, context);
    (informe as any).aviso = aviso;
    await store.setJSON("informe", informe);
    await store.setJSON(`historial/${hoy}`, informe);
    const idsHoy = filas.map((f: any) => String(f.id_del_proceso || "")).filter(Boolean);
    await store.setJSON("vistos", { ids: [...new Set([...idsHoy, ...[...vistos].slice(0, 20000)])].slice(0, 40000), fecha: hoy });
    console.log(`Agente: ${filas.length} revisados, ${candidatos.length} candidatos, ${informe.nuevos} nuevos, ${ia.usados} créditos`);
  } catch (e: any) {
    console.error("Agente falló", e);
    await store.setJSON("error", { fecha: hoy, mensaje: String(e?.message || e), cuando: new Date().toISOString() }).catch(() => {});
  }
};
