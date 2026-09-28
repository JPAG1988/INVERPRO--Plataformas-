// Motor de Mis Gastos: lee los SMS del banco, los pagos de Apple Pay y lo que se
// dicta por voz, los convierte en movimientos, les pone categoría y evita duplicados.
// No toca el almacenamiento: recibe el libro y lo modifica en memoria.

export const ZONA = "-05:00"; // Colombia no tiene horario de verano

export const CATEGORIAS_BASE = [
  { id: "mercado", nombre: "Mercado", tipo: "gasto", presupuesto: 0 },
  { id: "restaurantes", nombre: "Restaurantes y café", tipo: "gasto", presupuesto: 0 },
  { id: "transporte", nombre: "Transporte y gasolina", tipo: "gasto", presupuesto: 0 },
  { id: "salud", nombre: "Salud y droguería", tipo: "gasto", presupuesto: 0 },
  { id: "hogar", nombre: "Hogar y servicios", tipo: "gasto", presupuesto: 0 },
  { id: "suscripciones", nombre: "Suscripciones", tipo: "gasto", presupuesto: 0 },
  { id: "compras", nombre: "Compras", tipo: "gasto", presupuesto: 0 },
  { id: "educacion", nombre: "Educación", tipo: "gasto", presupuesto: 0 },
  { id: "ocio", nombre: "Ocio", tipo: "gasto", presupuesto: 0 },
  { id: "viajes", nombre: "Viajes", tipo: "gasto", presupuesto: 0 },
  { id: "finca", nombre: "Finca y agro", tipo: "gasto", presupuesto: 0 },
  { id: "bancos", nombre: "Bancos, intereses e impuestos", tipo: "gasto", presupuesto: 0 },
  { id: "otros", nombre: "Otros gastos", tipo: "gasto", presupuesto: 0 },
  { id: "salario", nombre: "Salario", tipo: "ingreso", presupuesto: 0 },
  { id: "otros_ingresos", nombre: "Otros ingresos", tipo: "ingreso", presupuesto: 0 },
];

// Palabras que delatan la categoría de un comercio. Lo que el usuario corrige
// queda en libro.reglas y pesa más que esta lista.
const PALABRAS = {
  suscripciones: ["disney", "netflix", "spotify", "youtube", "apple.com", "apple com", "icloud", "prime video", "amazon prime", "hbo", " max.com ", "paramount", "crunchyroll", "chatgpt", "openai", "anthropic", "claude.ai", "google one", "microsoft", "adobe", "canva", "deezer"],
  salud: ["farmatodo", "drogueria", "drogas", "cruz verde", "locatel", "farmacia", "pasteur", "colsubsidio drog", "clinica", "hospital", "laboratorio", "odontolog", "optica", " eps "],
  restaurantes: ["almuerzo", "desayuno", "comida", "cena", "onces", "tinto", "empanada", "corrientazo", "domicilio", "cerveza", "helado", "burger", "restaurante", " rest ", "pizza", "cafe", "coffee", "juan valdez", "tostao", " oma ", "crepes", "frisby", "kfc", "mcdonald", "el corral", "subway", "sushi", "asadero", "panaderia", "rappi", "ifood", "domicilios", "parrilla", " bar ", "wok", "starbucks", "dunkin", "presto"],
  compras: ["dollarcity", "alkosto", "ktronix", "falabella", "homecenter", "mercadolibre", "mercado libre", "amazon", "arturo calle", "zara", "koaj", "tennis", "studio f", "decathlon", "miniso", "panamericana", "jumbo home", " easy ", "pepe ganga", "flamingo"],
  mercado: ["exito", "carulla", " d1 ", " ara ", "tiendas ara", "olimpica", "jumbo", "makro", "surtimax", "isimo", " metro ", "colsubsidio", "mercado", "fruver", "carniceria", "superm", "euro supermercados", "pricesmart", "zapatoca"],
  transporte: ["bus", "buseta", "mototaxi", "colectivo", "pasaje", "gopass", "flypass", "terpel", "primax", "texaco", "biomax", "esso", "mobil", "uber", "didi", "cabify", "indriver", "peaje", "parqueadero", "parking", "gasolina", " eds ", "estacion de servicio", "taxi", "transmilenio", "tullave"],
  hogar: ["recibo", " luz ", " agua ", " gas ", "arriendo", "claro", "movistar", " tigo ", " wom ", " etb ", "epm", "enel", "codensa", "vanti", "gases", "acueducto", "energia", "enerca", "administracion", "arriendo", "aseo", "internet"],
  ocio: ["cinemark", "cine colombia", "procinal", "cinepolis", "teatro", "tuboleta", "eticket", "museo", "gimnasio", "smart fit", "bodytech", "playstation", "steam", "xbox"],
  viajes: ["avianca", "latam", "wingo", "satena", "clic air", "hotel", "airbnb", "booking", "despegar", "expedia", "terminal", "copa airlines"],
  educacion: ["universidad", "colegio", "platzi", "coursera", "udemy", "libreria", "matricula"],
  finca: ["agro", "veterinari", "concentrado", "fedegan", "semillas", "insumos", "ferreteria", "almacen agro", "ganad"],
  bancos: ["cuota de manejo", "cuota manejo", "interes", "gmf", "4x1000", "4 x 1000", "comision", "impuesto", "dian", "predial", "seguro", " iva "],
};

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

export const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Llave de un comercio para aprender su categoría: sin números de sucursal.
export const llaveComercio = (s) => norm(s).replace(/[*#.,]/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();

const dos = (n) => String(n).padStart(2, "0");
const id = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));

// "$8,124,000" (Davivienda), "$54.900" (Tuya), "54.950,00" o "COP 54950" (Apple Pay).
export function parseMonto(txt) {
  const s = String(txt ?? "").replace(/[^\d.,]/g, "");
  if (!s) return 0;
  const ult = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (ult >= 0 && s.length - ult - 1 <= 2 && s.length - ult - 1 > 0) {
    return Math.round(Number(s.slice(0, ult).replace(/[.,]/g, "") + "." + s.slice(ult + 1)));
  }
  return Number(s.replace(/[.,]/g, "")) || 0;
}

// Fecha y hora de Bogotá de un instante, como partes.
export function partesBogota(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

export const isoBogota = (y, m, d, h = 12, mi = 0) => `${y}-${dos(m)}-${dos(d)}T${dos(h)}:${dos(mi)}:00${ZONA}`;

// Un SMS de Davivienda no trae fecha, solo hora: se toma el día en que llegó,
// y si la hora del SMS es posterior a la de llegada, la compra fue el día anterior.
function fechaConHora(recibido, hh, mm) {
  const r = partesBogota(recibido);
  let base = new Date(Date.UTC(r.y, r.m - 1, r.d));
  if (hh * 60 + mm > r.h * 60 + r.mi + 60) base = new Date(base.getTime() - 86400000);
  return isoBogota(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hh, mm);
}

const limpiarComercio = (s) => String(s || "").replace(/\.\s*$/, "").replace(/\s+/g, " ").trim();

// Convierte un SMS en un hecho. Devuelve null si no es un mensaje de movimiento.
export function leerSMS(texto, recibido = new Date()) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  const n = norm(t);

  // Davivienda: "DAVIVIENDA . Compra en Establecimiento, $54,950,Cta de Ahorros *6578,Hora 14:29,Lugar FARMATODO."
  const dav = t.match(/DAVIVIENDA\s*\.?\s*(.+?),\s*\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}(?!\d))?)\s*,\s*(.+?)\*\s*(\d{3,4})\s*,\s*Hora\s*(\d{1,2}):(\d{2})\s*(?:,\s*Lugar\s*(.*))?$/i);
  if (dav) {
    const [, tipoTxt, montoTxt, , ultimos, hh, mm, lugarTxt] = dav;
    const lugar = limpiarComercio(lugarTxt);
    const tn = norm(tipoTxt);
    const hecho = {
      monto: parseMonto(montoTxt),
      fecha: fechaConHora(recibido, +hh, +mm),
      ultimos,
      comercio: /^0+$/.test(lugar) || !lugar ? limpiarComercio(tipoTxt) : lugar,
      detalle: limpiarComercio(tipoTxt),
      banco: "davivienda",
    };
    if (/abono|consignacion|deposito|reintegro|devolucion|reverso|recibiste/.test(tn)) return { ...hecho, tipo: "ingreso" };
    if (/retiro/.test(tn)) return { ...hecho, tipo: "retiro" };
    if (/pago.*(tarjeta|tc|credito)/.test(tn)) return { ...hecho, tipo: "pago_tarjeta" };
    return { ...hecho, tipo: "gasto" };
  }

  // Tuya / Alkosto: "TAR ALKOSTO: COMPRA APROBADA en DISNEY PLUS por $54.900 el 2026-08-28 17:03 con tu T.cred Alkosto Mastercard 2836"
  const compra = t.match(/COMPRA APROBADA en (.+?) por \$\s*([\d.,]+)\s+el (\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}).*?(\d{4})\b/i);
  if (compra) {
    const [, comercio, montoTxt, y, m, d, hh, mm, ultimos] = compra;
    return { tipo: "gasto", monto: parseMonto(montoTxt), fecha: isoBogota(+y, +m, +d, +hh, +mm), ultimos, comercio: limpiarComercio(comercio), detalle: "Compra con tarjeta de crédito", banco: n.includes("alkosto") ? "alkosto" : "" };
  }

  // Pago recibido en la tarjeta
  if (/(pago|abono) (recibido|aplicado|exitoso)|recibimos tu pago|aplicamos tu pago/.test(n)) {
    const monto = parseMonto((t.match(/\$\s*([\d.,]+)/) || [])[1]);
    if (monto) {
      const ultimos = (t.match(/\b(\d{4})\b(?!-)/) || [])[1] || "";
      return { tipo: "pago_recibido", monto, fecha: fechaConHora(recibido, partesBogota(recibido).h, partesBogota(recibido).mi), ultimos, comercio: "Pago de tarjeta", detalle: "Pago recibido" };
    }
  }

  // Recordatorio de pago: "...el 3 de septiembre de 2026 es tu fecha limite de pago por $2.038.181"
  if (/pago|pagar/.test(n)) {
    const f = n.match(/(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?/);
    const monto = parseMonto((t.match(/\$\s*([\d.,]+\d)/) || [])[1]);
    if (f && monto) {
      const y = f[3] ? +f[3] : partesBogota(recibido).y;
      return { tipo: "recordatorio", monto, fechaLimite: `${y}-${dos(MESES[f[2]])}-${dos(+f[1])}`, detalle: "Fecha límite de pago" };
    }
  }
  return null;
}

// ¿A qué cuenta del libro pertenece? Por los últimos 4 dígitos o por palabras clave.
export function cuentaPara(libro, { ultimos, texto }) {
  const n = norm(texto);
  const cuentas = libro.cuentas || [];
  if (ultimos) {
    const c = cuentas.find((c) => c.ultimos && String(c.ultimos) === String(ultimos));
    if (c) return c.id;
  }
  const porClave = cuentas.find((c) => (c.claves || []).some((k) => k && n.includes(norm(k))));
  return porClave ? porClave.id : null;
}

// Categoría de un comercio: primero lo aprendido, luego la lista de palabras.
export function categorizar(libro, comercio, tipo = "gasto") {
  const llave = (tipo === "ingreso" ? "ingreso:" : "") + llaveComercio(comercio);
  const regla = llave && libro.reglas?.[llave];
  if (regla) return { cat: regla.cat, empresa: regla.empresa ?? null, segura: true };
  if (tipo === "ingreso") return { cat: "otros_ingresos", empresa: null, segura: false };
  // Cada palabra debe empezar una palabra del comercio ("mobil" no cuenta dentro de "inmobiliaria");
  // con espacio al final, además debe terminarla.
  const n = " " + norm(comercio).replace(/[*#,;:()/-]/g, " ") + " ";
  for (const [cat, palabras] of Object.entries(PALABRAS)) {
    if (palabras.some((p) => n.includes(" " + p.trim() + (p.endsWith(" ") ? " " : "")))) return { cat, empresa: null, segura: false };
  }
  return { cat: "otros", empresa: null, segura: false };
}

export function aprender(libro, mov) {
  if (!mov.comercio || !mov.cat || (mov.tipo !== "gasto" && mov.tipo !== "ingreso")) return;
  const llave = (mov.tipo === "ingreso" ? "ingreso:" : "") + llaveComercio(mov.comercio);
  if (!llave || llave === "ingreso:") return;
  libro.reglas = libro.reglas || {};
  libro.reglas[llave] = { cat: mov.cat, empresa: mov.empresa || null };
}

// "20 mil almuerzo", "pagué 35.000 de taxi", "1,5 millones arriendo", "15 lucas café".
export function leerTextoLibre(libro, texto) {
  const original = String(texto || "").trim();
  const n = norm(original);
  const m = n.match(/\$?\s*(\d+(?:[.,]\d+)*)\s*(mil|k|lucas|luquitas|millones|millon|palos?)?\b/);
  let monto = 0;
  if (m) {
    const mult = !m[2] ? 1 : /mill|palo/.test(m[2]) ? 1e6 : 1e3;
    const num = mult > 1 ? Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) : parseMonto(m[1]);
    monto = Math.round(num * mult);
  }
  const tipo = /me pagaron|recibi|ingreso|me consignaron|me devolvieron|me reembolsaron|me transfirieron|salario|nomina/.test(n) ? "ingreso" : "gasto";

  let cuenta = "efectivo";
  const porCuenta = (libro.cuentas || []).find((c) => c.id !== "efectivo" && [c.nombre, ...(c.claves || [])].some((k) => k && n.includes(norm(k).split(" ")[0])));
  if (porCuenta) cuenta = porCuenta.id;

  const empresa = (libro.empresas || []).find((e) => e.nombre && n.includes(norm(e.nombre)))?.id || null;

  const relleno = /\b(gaste|gasto|pague|pago|compre|en|de|del|la|el|los|las|un|una|por|con|para|efectivo|pesos|plata|me|pagaron|recibi|hoy|ayer|mil|k|lucas|luquitas|millones|millon|y|al|a)\b/g;
  let resto = n.replace(m ? m[0] : "", " ").replace(relleno, " ").replace(/\s+/g, " ").trim();
  (libro.cuentas || []).forEach((c) => (c.claves || []).forEach((k) => (resto = resto.replace(norm(k), " "))));
  (libro.empresas || []).forEach((e) => (resto = resto.replace(norm(e.nombre), " ")));
  resto = resto.replace(/\s+/g, " ").trim();
  const comercio = resto ? resto.charAt(0).toUpperCase() + resto.slice(1) : tipo === "ingreso" ? "Ingreso" : "Gasto en efectivo";

  let fecha = null;
  if (/\bayer\b/.test(n)) {
    const p = partesBogota(new Date(Date.now() - 86400000));
    fecha = isoBogota(p.y, p.m, p.d, 12, 0);
  }
  const c = categorizar(libro, comercio, tipo);
  return { tipo, monto, cuenta, comercio, cat: c.cat, empresa: empresa ?? c.empresa, fecha, segura: !!monto && (c.segura || c.cat !== "otros") };
}

const minutos = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
const nombreCat = (libro, cat) => (libro.categorias || CATEGORIAS_BASE).find((c) => c.id === cat)?.nombre || cat;
export const pesos = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");

// Incorpora un hecho al libro. Devuelve qué pasó y un mensaje corto para Siri o la notificación.
// hecho: { tipo: gasto|ingreso|retiro|pago_tarjeta|pago_recibido|recordatorio|traslado, monto, fecha,
//          comercio, cuenta?, destino?, ultimos?, texto?, fuente, cat?, empresa?, nota? }
export function incorporar(libro, hecho, ahora = new Date()) {
  libro.movs = libro.movs || [];
  const fuente = hecho.fuente || "manual";
  const texto = hecho.texto || "";
  const cuenta = hecho.cuenta !== undefined ? hecho.cuenta : cuentaPara(libro, { ultimos: hecho.ultimos, texto: [texto, hecho.tarjeta, hecho.banco].filter(Boolean).join(" ") });

  if (hecho.tipo === "recordatorio") {
    const destino = cuenta || (libro.cuentas || []).find((c) => c.tipo === "credito" && (c.claves || []).some((k) => norm(texto).includes(norm(k))))?.id;
    const c = (libro.cuentas || []).find((x) => x.id === destino);
    if (!c) return { accion: "ignorado", mensaje: "Recordatorio de pago sin tarjeta reconocida" };
    c.proximoPago = { fecha: hecho.fechaLimite, monto: hecho.monto, registrado: ahora.toISOString() };
    return { accion: "recordatorio", mensaje: `${c.nombre}: pagar ${pesos(hecho.monto)} antes del ${hecho.fechaLimite}` };
  }

  if (!hecho.monto || hecho.monto <= 0) return { accion: "ignorado", mensaje: "No encontré el monto" };
  const fecha = hecho.fecha || (() => { const p = partesBogota(ahora); return isoBogota(p.y, p.m, p.d, p.h, p.mi); })();

  // El mismo SMS reenviado dos veces (la nómina repite texto cada mes, por eso cuenta la fecha)
  if (texto && libro.movs.some((x) => x.texto === texto && minutos(x.fecha, fecha) < 2)) {
    return { accion: "duplicado", mensaje: "Ese mensaje ya estaba registrado" };
  }

  // Apple Pay y el SMS del banco describen la misma compra: se funden en un solo movimiento.
  if (hecho.tipo === "gasto" && (fuente === "sms" || fuente === "applepay")) {
    const par = libro.movs.find((x) => x.tipo === "gasto" && x.monto === hecho.monto && !x.fuentes?.includes(fuente)
      && (x.fuentes || []).some((f) => f === "sms" || f === "applepay")
      && (!x.cuenta || !cuenta || x.cuenta === cuenta) && minutos(x.fecha, fecha) <= 30);
    if (par) {
      par.fuentes = [...(par.fuentes || []), fuente];
      if (!par.cuenta && cuenta) par.cuenta = cuenta;
      if (fuente === "sms") { par.texto = texto; par.fecha = fecha; }
      if (fuente === "applepay" && hecho.comercio) par.comercioApplePay = hecho.comercio;
      return { accion: "fusionado", mov: par, mensaje: `Ya estaba: ${pesos(par.monto)} en ${par.comercio}` };
    }
  }

  const base = { id: id(), fecha, monto: Math.round(hecho.monto), fuentes: [fuente], texto: texto || undefined, nota: hecho.nota || "", creado: ahora.toISOString(), empresa: hecho.empresa ?? null, reembolsable: false, reembolsado: false };

  if (hecho.tipo === "retiro") {
    const mov = { ...base, tipo: "traslado", cuenta, destino: "efectivo", comercio: "Retiro de efectivo", cat: null, estado: cuenta ? "ok" : "pendiente" };
    libro.movs.push(mov);
    return { accion: "nuevo", mov, mensaje: `Retiro de ${pesos(mov.monto)} pasado a efectivo` };
  }

  if (hecho.tipo === "pago_tarjeta" || hecho.tipo === "pago_recibido") {
    // Un pago de tarjeta es un traslado entre cuentas propias, nunca un gasto.
    const esDestino = hecho.tipo === "pago_recibido";
    const par = libro.movs.find((x) => x.tipo === "traslado" && x.monto === hecho.monto && minutos(x.fecha, fecha) <= 4 * 1440
      && (esDestino
        ? !x.destino || (x.destino === cuenta && !x.fuentes?.includes(fuente))
        : !x.cuenta || (x.cuenta === cuenta && !x.fuentes?.includes(fuente))));
    if (par) {
      if (esDestino) par.destino = par.destino || cuenta; else par.cuenta = cuenta;
      par.fuentes = [...new Set([...(par.fuentes || []), fuente])];
      par.estado = par.cuenta && par.destino ? "ok" : "pendiente";
      return { accion: "fusionado", mov: par, mensaje: `Pago de tarjeta de ${pesos(par.monto)} registrado` };
    }
    const mov = { ...base, tipo: "traslado", cuenta: esDestino ? null : cuenta, destino: esDestino ? cuenta : null, comercio: "Pago de tarjeta", cat: null, estado: "pendiente" };
    libro.movs.push(mov);
    return { accion: "nuevo", mov, mensaje: `Pago de tarjeta de ${pesos(mov.monto)}: confirma la tarjeta en la app` };
  }

  if (hecho.tipo === "traslado") {
    const mov = { ...base, tipo: "traslado", cuenta, destino: hecho.destino || null, comercio: hecho.comercio || "Traslado", cat: null, estado: cuenta && hecho.destino ? "ok" : "pendiente" };
    libro.movs.push(mov);
    return { accion: "nuevo", mov, mensaje: `Traslado de ${pesos(mov.monto)}` };
  }

  const tipo = hecho.tipo === "ingreso" ? "ingreso" : "gasto";
  const comercio = hecho.comercio || (tipo === "ingreso" ? "Ingreso" : "Gasto");
  const sugerida = categorizar(libro, comercio, tipo);
  let cat = hecho.cat || sugerida.cat;
  let segura = !!hecho.cat && hecho.segura !== false ? true : sugerida.segura;
  const umbral = Number(libro.config?.umbralSalario) || 3000000;
  if (tipo === "ingreso" && !sugerida.segura && !hecho.cat && hecho.monto >= umbral && fuente === "sms") { cat = "salario"; segura = true; }

  const mov = { ...base, tipo, cuenta, comercio, cat, empresa: hecho.empresa ?? sugerida.empresa ?? null, estado: segura && cuenta ? "ok" : "pendiente" };
  if (fuente === "applepay" && hecho.comercio) mov.comercioApplePay = hecho.comercio;
  libro.movs.push(mov);
  const verbo = tipo === "ingreso" ? "Ingreso" : "Anotado";
  const aviso = mov.estado === "pendiente" ? " · por aprobar" : "";
  return { accion: "nuevo", mov, mensaje: `${verbo}: ${pesos(mov.monto)} en ${comercio} (${nombreCat(libro, cat)})${aviso}` };
}

export function crearLibro() {
  return {
    version: 1,
    cuentas: [
      { id: "davivienda", nombre: "Davivienda Ahorros", tipo: "debito", ultimos: "6578", claves: ["davivienda"], saldoInicial: 0, desde: null },
      { id: "tuya", nombre: "Tarjeta Alkosto (Tuya)", tipo: "credito", ultimos: "2836", claves: ["alkosto", "tuya"], cupo: 0, deudaInicial: 0, desde: null, proximoPago: null },
      { id: "falabella", nombre: "CMR Falabella", tipo: "credito", ultimos: "", claves: ["falabella", "cmr"], cupo: 0, deudaInicial: 0, desde: null, proximoPago: null },
      { id: "efectivo", nombre: "Efectivo", tipo: "efectivo", ultimos: "", claves: ["efectivo"], saldoInicial: 0, desde: null },
    ],
    empresas: [],
    categorias: CATEGORIAS_BASE.map((c) => ({ ...c })),
    reglas: {},
    config: { umbralSalario: 3000000, umbralHormiga: 30000, diaSalario: 0 },
    movs: [],
  };
}
