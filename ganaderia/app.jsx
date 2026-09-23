const { useState, useRef, useEffect } = React;

// ─── Paleta INVERPRO ──────────────────────────────────────────
const C = {
  fondo: "#F2F4EE", panel: "#FFFFFF", tinta: "#1E2A22", tintaSuave: "#5A6B5E",
  pasto: "#2F6B3C", pastoClaro: "#E4EEE2", sabana: "#C99A3C", arcilla: "#A9552F",
  linea: "#D8DED4", rojo: "#B03A2E", ambar: "#C9861C", marca: "#E0393E",
};
const F = {
  display: "'Bricolage Grotesque', system-ui, sans-serif",
  body: "'Instrument Sans', system-ui, sans-serif",
  mono: "'Spline Sans Mono', monospace",
};
const fmt = (n, d = 0) => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d });
const hoyISO = () => new Date().toISOString().slice(0, 10);

const PASTOS = {
  "Guaratara (sabana nativa)": { pcLluvia: 7.3, pcSeca: 5.9, aforo: 1500 },
  "Brachiaria decumbens": { pcLluvia: 9.5, pcSeca: 6.5, aforo: 2800 },
  "Brachiaria humidicola": { pcLluvia: 8.0, pcSeca: 5.5, aforo: 3000 },
  "Brachiaria brizantha (Toledo)": { pcLluvia: 10.5, pcSeca: 7.0, aforo: 3500 },
  "Mombasa / Tanzania": { pcLluvia: 12.0, pcSeca: 8.0, aforo: 4000 },
  "Estrella / Pangola": { pcLluvia: 10.0, pcSeca: 7.0, aforo: 3000 },
  "Otro / mezcla": { pcLluvia: 9.0, pcSeca: 6.5, aforo: 2500 },
};
const REGIONES = ["Casanare", "Meta", "Arauca", "Vichada", "Caquetá", "Córdoba", "Cesar", "Santander", "Antioquia", "Magdalena", "Otra región"];
const SISTEMAS = ["Ceba", "Cría", "Doble propósito", "Leche"];

// ─── Gráficas propias, sin librería externa ───────────────────
function MiniLineChart({ data, series, height = 180, formatY }) {
  const w = 600, h = height, pad = { l: 44, r: 10, t: 10, b: 22 };
  if (!data.length) return null;
  const allVals = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const minV = Math.min(0, ...allVals), maxV = Math.max(1, ...allVals);
  const xScale = (i) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * (w - pad.l - pad.r) : 0);
  const yScale = (v) => h - pad.b - ((v - minV) / (maxV - minV || 1)) * (h - pad.t - pad.b);
  const paso = Math.max(1, Math.ceil(data.length / 6));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height, display: "block" }}>
      {[0, 1, 2, 3].map((i) => {
        const v = minV + (i / 3) * (maxV - minV), y = yScale(v);
        return (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke={C.linea} strokeDasharray="3 3" />
            <text x={pad.l - 6} y={y + 3} fontSize="9" fill={C.tintaSuave} textAnchor="end" fontFamily={F.mono}>{formatY ? formatY(v) : Math.round(v)}</text>
          </g>
        );
      })}
      {data.map((d, i) => (i % paso === 0 || i === data.length - 1) && (
        <text key={i} x={xScale(i)} y={h - 5} fontSize="9" fill={C.tintaSuave} textAnchor="middle" fontFamily={F.mono}>{d.x}</text>
      ))}
      {series.map((s) => (
        <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2.5"
          points={data.map((d, i) => `${xScale(i)},${yScale(Number(d[s.key]) || 0)}`).join(" ")} />
      ))}
      {series.map((s) => data.map((d, i) => (
        <circle key={s.key + i} cx={xScale(i)} cy={yScale(Number(d[s.key]) || 0)} r="2.5" fill={s.color} />
      )))}
    </svg>
  );
}
function MiniBarChart({ data, dataKey, height = 180, highlightIndex = 0, colorMain, colorRest }) {
  const w = 600, h = height, pad = { l: 40, r: 10, t: 10, b: 24 };
  if (!data.length) return null;
  const vals = data.map((d) => Number(d[dataKey]) || 0);
  const maxV = Math.max(1, ...vals);
  const bw = (w - pad.l - pad.r) / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height, display: "block" }}>
      <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke={C.linea} />
      {data.map((d, i) => {
        const v = Number(d[dataKey]) || 0, bh = (v / maxV) * (h - pad.t - pad.b);
        const x = pad.l + i * bw + bw * 0.15, y = h - pad.b - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.7} height={bh} rx="4" fill={i === highlightIndex ? colorMain : colorRest} />
            <text x={x + bw * 0.35} y={h - 9} fontSize="8" fill={C.tintaSuave} textAnchor="middle" fontFamily={F.mono}>{String(d.n).slice(0, 7)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Monitoreo satelital (Copernicus Sentinel-2, procesado por INVERPRO) ──
const SAT_URL = "/satelite/las-marias-resumen.json";
const esLasMarias = (n) => /las\s*mar[ií]as/i.test(n || "");
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const conSigno = (v) => { const r = Number(Math.abs(v).toFixed(2)); return r === 0 ? fmt(0, 2) : (v > 0 ? "+" : "−") + fmt(r, 2); };
const fechaCorta = (iso) => { const d = new Date(iso + "T00:00:00Z"); return d.getUTCDate() + " " + MES_CORTO[d.getUTCMonth()] + " " + d.getUTCFullYear(); };
function colorNdvi(v) {
  const st = [[0.2, [185, 138, 75]], [0.4, [220, 197, 110]], [0.55, [166, 194, 90]], [0.7, [94, 157, 64]], [0.8, [43, 109, 48]]];
  if (v == null) return "#888";
  if (v <= st[0][0]) return `rgb(${st[0][1].join(",")})`;
  for (let i = 1; i < st.length; i++) {
    if (v <= st[i][0]) { const [a, ca] = st[i - 1], [b, cb] = st[i]; const u = (v - a) / (b - a); return `rgb(${ca.map((x, j) => Math.round(x + (cb[j] - x) * u)).join(",")})`; }
  }
  return `rgb(${st[st.length - 1][1].join(",")})`;
}
function resumenSatelite(sat) {
  const i = sat.fechas.length - 1, predio = sat.predio[i];
  const filas = sat.potreros.map((p) => {
    const serie = sat.ndvi[p.k] || [], v = serie[i];
    let j = i - 1; while (j >= 0 && serie[j] == null) j--;
    const ant = j >= 0 ? serie[j] : null;
    let bajo = 0, n = 0;
    for (let k = Math.max(0, i - 4); k <= i; k++) { if (serie[k] == null) continue; n++; if (serie[k] - sat.predio[k] <= -0.04) bajo++; }
    const d = v == null ? null : v - predio;
    const estado = d == null ? "Sin dato" : d <= -0.05 ? "Bajo el promedio" : d >= 0.05 ? "Sobre el promedio" : "En el promedio";
    return { ...p, v, ant, d, bajo, n, estado };
  }).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  return { i, fecha: sat.fechas[i], predio, filas };
}
function useSatelite(nombreFinca) {
  const [sat, setSat] = useState(null);
  useEffect(() => {
    if (!esLasMarias(nombreFinca)) { setSat(null); return; }
    let vivo = true;
    fetch(SAT_URL).then((r) => (r.ok ? r.json() : null)).then((d) => { if (vivo && d && d.fechas) setSat(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [nombreFinca]);
  return sat;
}

// ─── Persistencia real: servidor propio (Netlify Functions + Blobs) ──
function generarCodigo(nombre) {
  const base = (nombre || "FINCA").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "FINCA";
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}
async function cargarFincaRemota(codigo) {
  try {
    const r = await fetch(`/.netlify/functions/finca?accion=cargar&codigo=${encodeURIComponent(codigo)}`);
    const d = await r.json();
    return d && d.datos ? d.datos : null;
  } catch (e) { return null; }
}
async function guardarFincaRemota(codigo, datos, compartirRed, kpisRed) {
  try {
    const r = await fetch(`/.netlify/functions/finca?accion=guardar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, datos, compartirRed, kpisRed }),
    });
    return r.ok;
  } catch (e) { return false; }
}
async function cargarRedRemota() {
  try {
    const r = await fetch(`/.netlify/functions/finca?accion=red`);
    const d = await r.json();
    return (d && d.red) || [];
  } catch (e) { return []; }
}
function guardarCache(codigo, datos) { try { localStorage.setItem("inverpro:" + codigo, JSON.stringify(datos)); } catch (e) {} }
function leerCache(codigo) { try { const v = localStorage.getItem("inverpro:" + codigo); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

async function preguntarIA(messages, max_tokens) {
  const r = await fetch("/.netlify/functions/asesor", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: max_tokens || 1000 }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function App() {
  // ═══ Identidad y código de finca ═══
  const [perfil, setPerfil] = useState(null);
  const [paso, setPaso] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardado, setGuardado] = useState("listo");
  const [codigo, setCodigo] = useState("");
  const [entrarConCodigo, setEntrarConCodigo] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const listoRef = useRef(false);

  const [nombreFinca, setNombreFinca] = useState("");
  const [region, setRegion] = useState("Casanare");
  const [municipio, setMunicipio] = useState("");
  const [sistema, setSistema] = useState("Ceba");
  const [pastoTipo, setPastoTipo] = useState("Guaratara (sabana nativa)");
  const [compartirRed, setCompartirRed] = useState(true);

  // ═══ Operación ═══
  const [areaManejada, setAreaManejada] = useState(0);
  const [haPotrero, setHaPotrero] = useState(0);
  const [ocupacionDias, setOcupacionDias] = useState(1);
  const [descansoMeta, setDescansoMeta] = useState(0);
  const [potreroActual, setPotreroActual] = useState(1);
  const [machos, setMachos] = useState(0);
  const [hembras, setHembras] = useState(0);
  const [pesoIngreso, setPesoIngreso] = useState(0);
  const [metaGanancia, setMetaGanancia] = useState(0);
  const [cicloMeses, setCicloMeses] = useState(6);
  const [fechaIngreso, setFechaIngreso] = useState(hoyISO());
  const [gdp, setGdp] = useState(0);
  const [lluviaDias, setLluviaDias] = useState(0);
  const [aforoBase, setAforoBase] = useState(1500);
  const [utilizacion, setUtilizacion] = useState(60);
  const [consumoPV, setConsumoPV] = useState(2.7);
  const [aforos, setAforos] = useState({});
  const [supl, setSupl] = useState([{ nombre: "", dosis: 0, precio: 0, ms: 88, pc: 10 }]);
  const [precioKg, setPrecioKg] = useState(0);
  const [costoNomina, setCostoNomina] = useState(0);
  const [costoVet, setCostoVet] = useState(0);
  const [costoMant, setCostoMant] = useState(0);
  const [costoOtros, setCostoOtros] = useState(0);
  const [eventos, setEventos] = useState([]);
  const [lat, setLat] = useState(4.6515);
  const [lng, setLng] = useState(-72.0142);
  const [ultimaRotacion, setUltimaRotacion] = useState(null);
  const [red, setRed] = useState([]);

  const nAnimales = machos + hembras;
  const nPotreros = areaManejada > 0 && haPotrero > 0 ? Math.max(1, Math.round(areaManejada / haPotrero)) : 0;
  const descansoReal = nPotreros > 1 ? (nPotreros - 1) * ocupacionDias : 0;
  const diasCeba = Math.max(0, Math.round((Date.now() - new Date(fechaIngreso).getTime()) / 86400000));
  const diasCiclo = cicloMeses * 30.4;
  const gdpReq = diasCiclo > 0 ? (metaGanancia * 1000) / diasCiclo : 0;

  const pesajes = eventos.filter((e) => e.tipo === "pesaje").slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimoPesaje = pesajes.length ? pesajes[pesajes.length - 1] : null;
  let gdpReal = null;
  if (pesajes.length >= 2) {
    const a = pesajes[pesajes.length - 2], b = pesajes[pesajes.length - 1];
    const dd = (new Date(b.fecha) - new Date(a.fecha)) / 86400000;
    if (dd > 0) gdpReal = Math.round(((b.peso - a.peso) / dd) * 1000);
  }
  const pesoProm = ultimoPesaje
    ? ultimoPesaje.peso + (gdp * Math.max(0, (Date.now() - new Date(ultimoPesaje.fecha).getTime()) / 86400000)) / 1000
    : pesoIngreso + (gdp * diasCeba) / 1000;
  const pesoSalida = pesoIngreso + metaGanancia;
  const avanceCiclo = diasCiclo > 0 ? Math.min(100, (diasCeba / diasCiclo) * 100) : 0;
  const diasRestantes = Math.max(0, diasCiclo - diasCeba);
  const diasParaRotar = Math.max(0, ocupacionDias - (ultimaRotacion ? Math.floor((Date.now() - new Date(ultimaRotacion).getTime()) / 86400000) : 0));

  const ugg = (nAnimales * pesoProm) / 450;
  const carga = areaManejada > 0 ? ugg / areaManejada : 0;
  const kilosEnPie = nAnimales * pesoProm;
  const kgPorHa = areaManejada > 0 ? kilosEnPie / areaManejada : 0;
  const prodMesKg = (nAnimales * gdp * 30.4) / 1000;
  const prodAnualHa = areaManejada > 0 ? (prodMesKg * 12) / areaManejada : 0;

  const kgSuplDia = supl.reduce((s, x) => s + (x.dosis || 0), 0);
  const costoSuplDia = supl.reduce((s, x) => s + (x.dosis || 0) * (x.precio || 0), 0);
  const msSuplDia = supl.reduce((s, x) => s + (x.dosis || 0) * ((x.ms || 0) / 100), 0);
  const pcSuplDia = supl.reduce((s, x) => s + (x.dosis || 0) * ((x.ms || 0) / 100) * ((x.pc || 0) / 100), 0) * 1000;
  const costoSuplMes = costoSuplDia * nAnimales * 30.4;
  const costoSuplPorKg = gdp > 0 ? costoSuplDia / (gdp / 1000) : 0;

  const aforoDe = (n) => (aforos[n] !== undefined ? aforos[n] : aforoBase);
  const potreros = Array.from({ length: nPotreros }, (_, i) => {
    const num = i + 1;
    const atras = (potreroActual - 1 - i + nPotreros) % nPotreros;
    const dias = num === potreroActual ? 0 : atras * ocupacionDias;
    const rec = Math.min(1, descansoMeta > 0 ? dias / descansoMeta : 0);
    return { num, dias, rec, ms: aforoDe(num) * rec * haPotrero * (utilizacion / 100), listo: dias >= descansoMeta, actual: num === potreroActual };
  });
  const consumoTotalMS = nAnimales * pesoProm * (consumoPV / 100);
  const aporteSuplMS = nAnimales * msSuplDia;
  const consumoPasto = Math.max(0, consumoTotalMS - aporteSuplMS);
  const oferta = potreros.filter((p) => !p.actual).reduce((s, p) => s + p.ms, 0);
  const autonomia = consumoPasto > 0 ? oferta / consumoPasto : 0;

  const hoy = new Date();
  const mes = hoy.getMonth();
  const enSeca = mes === 11 || mes <= 2;
  const pcPasto = enSeca ? PASTOS[pastoTipo].pcSeca : PASTOS[pastoTipo].pcLluvia;
  const pcTotal = pcSuplDia + (consumoPasto / Math.max(1, nAnimales)) * (pcPasto / 100) * 1000;
  const pcReq = Math.round((consumoTotalMS / Math.max(1, nAnimales)) * 0.1 * 1000);
  let finSeca = new Date(hoy.getFullYear(), 2, 31);
  if (mes === 11) finSeca = new Date(hoy.getFullYear() + 1, 2, 31);
  const diasRestSeca = Math.max(0, Math.ceil((finSeca - hoy) / 86400000));
  const diasHastaSeca = Math.max(0, Math.ceil((new Date(hoy.getFullYear(), 11, 1) - hoy) / 86400000));
  let semaforo = "VERDE", semColor = C.pasto, semMsg = "";
  if (enSeca) {
    if (autonomia >= diasRestSeca) semMsg = `Quedan ~${diasRestSeca} días de sequía y tienes ${fmt(autonomia)} días de pasto. Vas bien.`;
    else if (autonomia >= diasRestSeca * 0.7) { semaforo = "AMARILLO"; semColor = C.ambar; semMsg = `Quedan ~${diasRestSeca} días de sequía y solo ${fmt(autonomia)} días de pasto. Ajusta carga o suplementa.`; }
    else { semaforo = "ROJO"; semColor = C.rojo; semMsg = `Déficit: ~${diasRestSeca} días de sequía y solo ${fmt(autonomia)} días de pasto. Actúa ya.`; }
  } else {
    if (autonomia >= 90) semMsg = `Faltan ~${diasHastaSeca} días para la sequía y llevas ${fmt(autonomia)} días de reserva.`;
    else if (autonomia >= 50) { semaforo = "AMARILLO"; semColor = C.ambar; semMsg = `Faltan ~${diasHastaSeca} días para la sequía y tu reserva es de ${fmt(autonomia)} días. Construye reserva.`; }
    else { semaforo = "ROJO"; semColor = C.rojo; semMsg = `Reserva baja (${fmt(autonomia)} días) con la sequía a ~${diasHastaSeca} días.`; }
  }

  const mesStr = hoyISO().slice(0, 7);
  const gastoReal = eventos.filter((e) => e.tipo === "gasto" && e.fecha.slice(0, 7) === mesStr).reduce((s, e) => s + (e.valor || 0), 0);
  const costoFijos = costoNomina + costoVet + costoMant + costoOtros;
  const costoMes = costoFijos + costoSuplMes;
  const ingresoMes = prodMesKg * precioKg;
  const margenMes = ingresoMes - costoMes;
  const costoPorKg = prodMesKg > 0 ? costoMes / prodMesKg : 0;

  const sanid = eventos.filter((e) => e.tipo === "sanidad").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultDespa = sanid.filter((e) => e.producto === "desparasitación").pop() || null;
  const diasDespa = ultDespa ? Math.floor((Date.now() - new Date(ultDespa.fecha).getTime()) / 86400000) : null;
  const limDespa = enSeca ? 90 : 60;
  const enCicloICA = mes === 4 || mes === 5 || mes === 10 || mes === 11;
  const proxCiclo = mes < 4 ? new Date(hoy.getFullYear(), 4, 4) : mes < 10 ? new Date(hoy.getFullYear(), 10, 1) : new Date(hoy.getFullYear() + 1, 4, 4);
  const diasProxCiclo = Math.max(0, Math.ceil((proxCiclo - hoy) / 86400000));
  const aftosaOk = sanid.some((e) => e.producto === "aftosa" && (Date.now() - new Date(e.fecha).getTime()) / 86400000 < 180);

  const ayerStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const eventosAyer = eventos.filter((e) => e.fecha === ayerStr);
  const hayReporteAyer = eventosAyer.length > 0;

  // ═══ Persistencia: cargar al iniciar, guardar con debounce ═══
  useEffect(() => {
    (async () => {
      let cod = "";
      try { cod = localStorage.getItem("inverpro:mi-codigo") || ""; } catch (e) {}
      if (cod) {
        const remoto = await cargarFincaRemota(cod);
        const datos = remoto || leerCache(cod);
        if (datos) {
          aplicarDatos(datos);
          setCodigo(cod);
          setPerfil(true);
        }
      }
      const r = await cargarRedRemota();
      setRed(r);
      listoRef.current = true;
      setCargando(false);
    })();
  }, []);

  function recolectarDatos() {
    return {
      nombreFinca, region, municipio, sistema, pastoTipo, compartirRed, areaManejada, haPotrero, ocupacionDias,
      descansoMeta, potreroActual, machos, hembras, pesoIngreso, metaGanancia, cicloMeses, fechaIngreso, gdp,
      lluviaDias, aforoBase, utilizacion, consumoPV, aforos, supl, precioKg, costoNomina, costoVet, costoMant,
      costoOtros, eventos, lat, lng, ultimaRotacion,
    };
  }
  function aplicarDatos(d) {
    const set = (k, f) => { if (d[k] !== undefined) f(d[k]); };
    set("nombreFinca", setNombreFinca); set("region", setRegion); set("municipio", setMunicipio);
    set("sistema", setSistema); set("pastoTipo", setPastoTipo); set("compartirRed", setCompartirRed);
    set("areaManejada", setAreaManejada); set("haPotrero", setHaPotrero); set("ocupacionDias", setOcupacionDias);
    set("descansoMeta", setDescansoMeta); set("potreroActual", setPotreroActual);
    set("machos", setMachos); set("hembras", setHembras); set("pesoIngreso", setPesoIngreso);
    set("metaGanancia", setMetaGanancia); set("cicloMeses", setCicloMeses); set("fechaIngreso", setFechaIngreso);
    set("gdp", setGdp); set("lluviaDias", setLluviaDias); set("aforoBase", setAforoBase);
    set("utilizacion", setUtilizacion); set("consumoPV", setConsumoPV); set("aforos", setAforos);
    set("supl", setSupl); set("precioKg", setPrecioKg); set("costoNomina", setCostoNomina);
    set("costoVet", setCostoVet); set("costoMant", setCostoMant); set("costoOtros", setCostoOtros);
    set("eventos", setEventos); set("lat", setLat); set("lng", setLng); set("ultimaRotacion", setUltimaRotacion);
  }

  useEffect(() => {
    if (!listoRef.current || !perfil || !codigo) return;
    setGuardado("guardando");
    const t = setTimeout(async () => {
      const datos = recolectarDatos();
      guardarCache(codigo, datos);
      const kpisRed = { region, sistema, pasto: pastoTipo, carga: Number(carga.toFixed(2)), gdp: gdpReal || gdp, kgHaAno: Math.round(prodAnualHa), costoKg: Math.round(costoPorKg), descanso: descansoReal, animales: nAnimales };
      const ok = await guardarFincaRemota(codigo, datos, compartirRed && !!nombreFinca && areaManejada > 0 && nAnimales > 0, kpisRed);
      setGuardado(ok ? "listo" : "local");
    }, 1200);
    return () => clearTimeout(t);
  }, [perfil, codigo, nombreFinca, region, municipio, sistema, pastoTipo, compartirRed, areaManejada, haPotrero, ocupacionDias, descansoMeta, potreroActual, machos, hembras, pesoIngreso, metaGanancia, cicloMeses, fechaIngreso, gdp, lluviaDias, aforoBase, utilizacion, consumoPV, aforos, supl, precioKg, costoNomina, costoVet, costoMant, costoOtros, eventos, lat, lng, ultimaRotacion]);

  function terminarOnboarding() {
    if (!nombreFinca.trim()) return;
    const nuevoCodigo = generarCodigo(nombreFinca);
    try { localStorage.setItem("inverpro:mi-codigo", nuevoCodigo); } catch (e) {}
    setCodigo(nuevoCodigo);
    listoRef.current = true;
    setPerfil(true);
  }

  async function entrarConCodigoExistente() {
    const cod = codigoInput.trim().toUpperCase();
    if (!cod) return;
    setCargando(true);
    const remoto = await cargarFincaRemota(cod);
    const datos = remoto || leerCache(cod);
    if (datos) {
      aplicarDatos(datos);
      try { localStorage.setItem("inverpro:mi-codigo", cod); } catch (e) {}
      setCodigo(cod);
      listoRef.current = true;
      setPerfil(true);
    } else {
      alert("No encontré ninguna finca con ese código. Revísalo, o crea una finca nueva.");
    }
    setCargando(false);
  }

  useEffect(() => { if (nPotreros > 0 && (potreroActual > nPotreros || potreroActual < 1)) setPotreroActual(1); }, [nPotreros]);
  useEffect(() => { document.title = "INVERPRO Ganadería · " + (nombreFinca || "Plataforma de gestión ganadera"); }, [nombreFinca]);

  const pares = red.filter((r) => r.alias !== codigo);
  const prom = (campo) => (pares.length ? pares.reduce((s, r) => s + (r[campo] || 0), 0) / pares.length : null);
  const percentil = (campo, valor, mayorMejor = true) => {
    if (!pares.length) return null;
    const vals = pares.map((r) => r[campo] || 0);
    return Math.round((vals.filter((v) => (mayorMejor ? v < valor : v > valor)).length / vals.length) * 100);
  };

  // ═══ Mapa (Leaflet) ═══
  const [vista, setVista] = useState("plano");
  const mapRef = useRef(null);
  const capaRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const sat = useSatelite(nombreFinca);
  useEffect(() => {
    if (window.L) { setMapReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => setMapReady(true);
    document.head.appendChild(s);
  }, []);
  useEffect(() => {
    if (!mapReady || !perfil || mapRef.current || !document.getElementById("mapa")) return;
    const L = window.L;
    const m = L.map("mapa", { zoomControl: true }).setView([lat, lng], 15);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Imágenes © Esri", maxZoom: 19 }).addTo(m);
    capaRef.current = L.layerGroup().addTo(m);
    m.on("click", (e) => { setLat(Number(e.latlng.lat.toFixed(5))); setLng(Number(e.latlng.lng.toFixed(5))); });
    mapRef.current = m;
  }, [mapReady, perfil, vista]);
  useEffect(() => {
    if (!mapReady || !mapRef.current || !capaRef.current) return;
    const L = window.L, g = capaRef.current;
    if (sat) {
      g.clearLayers();
      const res = resumenSatelite(sat);
      const ll = (pts) => pts.map(([lon, la]) => [la, lon]);
      const lind = L.polygon(ll(sat.lindero.ll), { color: "#FFF", weight: 2, dashArray: "6 5", fill: false }).addTo(g)
        .bindTooltip(`Lindero · ${fmt(sat.lindero.ha, 1)} ha`, { sticky: true });
      res.filas.forEach((p) => {
        L.polygon(ll(p.ll), { color: "#FFF", weight: 1.5, fillColor: colorNdvi(p.v), fillOpacity: 0.7 }).addTo(g)
          .bindTooltip(`${p.nombre} · ${fmt(p.ha, 2)} ha · NDVI ${p.v == null ? "—" : fmt(p.v, 2)}`, { sticky: true });
      });
      mapRef.current.fitBounds(lind.getBounds(), { padding: [12, 12] });
      return;
    }
    if (nPotreros === 0) return;
    g.clearLayers();
    const lado = Math.sqrt(haPotrero * 10000);
    const cols = Math.ceil(Math.sqrt(nPotreros));
    const rows = Math.ceil(nPotreros / cols);
    const dLat = lado / 111320, dLng = lado / (111320 * Math.cos((lat * Math.PI) / 180));
    const lat0 = lat + (rows * dLat) / 2, lng0 = lng - (cols * dLng) / 2;
    potreros.forEach((p, i) => {
      const row = Math.floor(i / cols), c0 = i % cols;
      const col = row % 2 === 0 ? c0 : cols - 1 - c0;
      const b = [[lat0 - (row + 1) * dLat, lng0 + col * dLng], [lat0 - row * dLat, lng0 + (col + 1) * dLng]];
      const t = Math.max(0, Math.min(1, p.dias / (descansoMeta || 1)));
      const lp = (a, z) => Math.round(a + (z - a) * t);
      const fill = p.actual ? C.sabana : `rgb(${lp(176, 47)},${lp(138, 107)},${lp(79, 60)})`;
      L.rectangle(b, { color: "#FFF", weight: p.actual ? 3 : 1, fillColor: fill, fillOpacity: 0.55 })
        .addTo(g).bindTooltip(`#${p.num} · ${p.actual ? "en pastoreo hoy" : p.dias.toFixed(0) + " d de descanso"}`, { direction: "top" });
    });
    mapRef.current.setView([lat, lng]);
  }, [mapReady, potreroActual, nPotreros, haPotrero, descansoMeta, lat, lng, aforos, aforoBase, sat, vista]);
  useEffect(() => { if (vista === "satelite" && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 80); }, [vista, mapReady]);

  function rotarSiguiente() {
    setPotreroActual((potreroActual % Math.max(1, nPotreros)) + 1);
    setUltimaRotacion(new Date().toISOString());
  }

  // ═══ Registro de campo ═══
  const [regTipo, setRegTipo] = useState("pesaje");
  const [regFecha, setRegFecha] = useState(hoyISO());
  const [regLote, setRegLote] = useState("general");
  const [regCat, setRegCat] = useState("suplemento");
  const [regValor, setRegValor] = useState("");
  const [regExtra, setRegExtra] = useState("");
  const [regNota, setRegNota] = useState("");

  function confirmarEvento(ev) {
    if (ev.tipo === "aforo" && ev.franja) setAforos((a) => ({ ...a, [ev.franja]: ev.aforo }));
    if (ev.tipo === "novedad") {
      const v = ev.cantidad || 0;
      if ((ev.clase === "venta" || ev.clase === "muerte") && ev.lote === "machos") setMachos((m) => Math.max(0, m - v));
      if ((ev.clase === "venta" || ev.clase === "muerte") && ev.lote === "hembras") setHembras((h) => Math.max(0, h - v));
      if (ev.clase === "compra" && ev.lote === "machos") setMachos((m) => m + v);
      if (ev.clase === "compra" && ev.lote === "hembras") setHembras((h) => h + v);
    }
    setEventos((ex) => [...ex, { ...ev, id: Date.now() + Math.random() }]);
  }
  function agregar() {
    const v = Number(regValor);
    if (!regFecha || !v) return;
    const b = { fecha: regFecha, tipo: regTipo };
    let ev = null;
    if (regTipo === "pesaje") ev = { ...b, lote: regLote, peso: v, n: Number(regExtra) || null };
    if (regTipo === "aforo") { const fr = Math.max(1, Math.min(nPotreros || 1, Number(regExtra) || potreroActual)); ev = { ...b, franja: fr, aforo: v }; }
    if (regTipo === "gasto") ev = { ...b, categoria: regCat, valor: v, nota: regNota };
    if (regTipo === "sanidad") ev = { ...b, producto: regCat, lote: regLote, cantidad: v, nota: regNota };
    if (regTipo === "novedad") ev = { ...b, clase: regCat, lote: regLote, cantidad: v, nota: regNota };
    if (ev) confirmarEvento(ev);
    setRegValor(""); setRegExtra(""); setRegNota("");
  }
  function borrarRegistro(id) { setEventos(eventos.filter((e) => e.id !== id)); }
  const desc = (e) => {
    if (e.tipo === "pesaje") return `Pesaje ${e.lote}: ${fmt(e.peso)} kg prom.${e.n ? ` (${e.n} animales)` : ""}`;
    if (e.tipo === "aforo") return `Aforo franja #${e.franja}: ${fmt(e.aforo)} kg MS/ha`;
    if (e.tipo === "gasto") return `Gasto ${e.categoria}: $${fmt(e.valor)}${e.nota ? " · " + e.nota : ""}`;
    if (e.tipo === "sanidad") return `Sanidad ${e.producto} (${e.lote}): ${fmt(e.cantidad)} animal(es)${e.nota ? " · " + e.nota : ""}`;
    if (e.tipo === "novedad") return `${e.clase} ${e.lote}: ${fmt(e.cantidad)} animal(es)${e.nota ? " · " + e.nota : ""}`;
    return "";
  };

  const textoReporteAyer = (() => {
    const fechaLegible = new Date(ayerStr + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" });
    const iconos = { pesaje: "⚖️", aforo: "🌱", gasto: "💰", sanidad: "💉", novedad: "🐄" };
    const lineas = [`*INVERPRO · ${nombreFinca || "Mi finca"}*`, `Reporte del ${fechaLegible}`, ""];
    eventosAyer.forEach((e) => lineas.push(`${iconos[e.tipo] || "•"} ${desc(e)}`));
    if (!hayReporteAyer) lineas.push("Sin registros de campo ese día.");
    return lineas.join("\n");
  })();

  // ═══ Registro por WhatsApp (texto libre → eventos, con confirmación) ═══
  const [textoWA, setTextoWA] = useState("");
  const [interpretando, setInterpretando] = useState(false);
  const [propuestas, setPropuestas] = useState([]);
  const [errorWA, setErrorWA] = useState("");
  async function interpretarMensajeWA() {
    const txt = textoWA.trim();
    if (!txt) return;
    setInterpretando(true); setErrorWA("");
    const prompt = `Eres un extractor de datos para una finca ganadera. Lee un mensaje informal de WhatsApp del encargado de campo y conviértelo en eventos estructurados.
CONTEXTO: ${nPotreros || "?"} franjas de rotación, franja actual #${potreroActual}, lotes "machos" (${machos} cab) y "hembras" (${hembras} cab).
FECHA DE HOY: ${hoyISO()}
Responde SOLO un array JSON, sin texto adicional, sin \`\`\`:
- {"tipo":"pesaje","fecha":"YYYY-MM-DD","lote":"machos|hembras|general","peso":numero,"n":numero_o_null}
- {"tipo":"aforo","fecha":"YYYY-MM-DD","franja":numero,"aforo":numero_kgMS_ha}
- {"tipo":"gasto","fecha":"YYYY-MM-DD","categoria":"suplemento|nómina|sanidad|mantenimiento|otros","valor":numero_COP,"nota":"texto"}
- {"tipo":"sanidad","fecha":"YYYY-MM-DD","producto":"aftosa|brucelosis|rabia|desparasitación|vitaminas|baño garrapaticida|otro","lote":"machos|hembras|general","cantidad":numero,"nota":"texto"}
- {"tipo":"novedad","fecha":"YYYY-MM-DD","clase":"venta|muerte|compra|traslado","lote":"machos|hembras","cantidad":numero,"nota":"texto, incluye guía GSMI si la menciona"}
- {"tipo":"rotacion","fecha":"YYYY-MM-DD","franja":numero}
Si algo es ambiguo, ignóralo. Si no hay nada útil, responde: []
MENSAJE: """${txt}"""`;
    try {
      let salida = await preguntarIA([{ role: "user", content: prompt }], 800);
      salida = salida.replace(/^```json\s*|^```\s*|```$/g, "").trim();
      const arr = JSON.parse(salida);
      if (Array.isArray(arr) && arr.length) setPropuestas(arr.map((p, i) => ({ ...p, _tmpId: Date.now() + i })));
      else setErrorWA("No encontré datos claros en ese mensaje.");
    } catch (e) { setErrorWA("No se pudo interpretar el mensaje: " + e.message); }
    setInterpretando(false);
  }
  function confirmarPropuesta(p) {
    if (p.tipo === "rotacion") { setPotreroActual(Math.max(1, Math.min(nPotreros || 1, p.franja || potreroActual))); setUltimaRotacion(new Date().toISOString()); }
    else confirmarEvento(p);
    setPropuestas((ps) => ps.filter((x) => x._tmpId !== p._tmpId));
  }
  function descartarPropuesta(id) { setPropuestas((ps) => ps.filter((x) => x._tmpId !== id)); }
  const descPropuesta = (p) => (p.tipo === "rotacion" ? `Rotación → franja #${p.franja}` : desc(p));

  // ═══ Cargue de documentos (PDF/texto → propuestas) ═══
  useEffect(() => {
    if (window.pdfjsLib) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js"; };
    document.head.appendChild(s);
  }, []);
  const [cargandoDoc, setCargandoDoc] = useState(false);
  const [errorDoc, setErrorDoc] = useState("");
  const [propuestasDoc, setPropuestasDoc] = useState([]);
  const [pegarTextoDoc, setPegarTextoDoc] = useState(false);
  const [textoDocManual, setTextoDocManual] = useState("");
  const [nombreDocActual, setNombreDocActual] = useState("");

  async function extraerTextoPDF(file) {
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let texto = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const contenido = await page.getTextContent();
      texto += contenido.items.map((it) => it.str).join(" ") + "\n";
    }
    return texto.trim();
  }
  async function interpretarDocumento(texto, nombreArchivo) {
    setCargandoDoc(true); setErrorDoc(""); setPropuestasDoc([]);
    const prompt = `Eres un extractor de datos para una finca ganadera. Lee el texto de un documento (bromatológico de laboratorio, ficha técnica de un insumo, o factura de compra) e identifica el tipo y extrae los datos.
INSUMOS ACTUALES: ${supl.map((s) => s.nombre).filter(Boolean).join(", ") || "ninguno todavía"}.
FECHA DE HOY: ${hoyISO()}
Responde SOLO un array JSON, sin texto adicional, sin \`\`\`:
- {"tipo":"insumo","nombre":"nombre del insumo","ms":numero_o_null,"pc":numero_o_null,"fuente":"laboratorio y fecha si aparecen"}
- {"tipo":"gasto","fecha":"YYYY-MM-DD","categoria":"suplemento|nómina|sanidad|mantenimiento|otros","valor":numero_COP,"nota":"proveedor e ítem"}
Si no hay datos útiles, responde: []
ARCHIVO: ${nombreArchivo}
TEXTO: """${texto.slice(0, 7000)}"""`;
    try {
      let salida = await preguntarIA([{ role: "user", content: prompt }], 900);
      salida = salida.replace(/^```json\s*|^```\s*|```$/g, "").trim();
      const arr = JSON.parse(salida);
      if (Array.isArray(arr) && arr.length) setPropuestasDoc(arr.map((p, i) => ({ ...p, _tmpId: Date.now() + i })));
      else setErrorDoc("No encontré datos claros en ese documento. Si es un PDF escaneado, pega el texto manualmente.");
    } catch (e) { setErrorDoc("No se pudo interpretar el documento: " + e.message); }
    setCargandoDoc(false);
  }
  async function manejarArchivoDoc(file) {
    if (!file) return;
    setNombreDocActual(file.name); setCargandoDoc(true); setErrorDoc("");
    try {
      let texto = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (!window.pdfjsLib) { setErrorDoc("Aún carga el lector de PDF, intenta de nuevo en un momento."); setCargandoDoc(false); return; }
        texto = await extraerTextoPDF(file);
      } else texto = await file.text();
      if (!texto || texto.length < 20) { setErrorDoc("No pude leer texto de ese archivo. Si es una imagen escaneada, pega el contenido manualmente."); setCargandoDoc(false); return; }
      await interpretarDocumento(texto, file.name);
    } catch (e) { setErrorDoc("No se pudo leer el archivo."); setCargandoDoc(false); }
  }
  function confirmarPropuestaDoc(p) {
    if (p.tipo === "insumo") {
      const idx = supl.findIndex((s) => s.nombre && p.nombre && (s.nombre.toLowerCase().includes(p.nombre.toLowerCase().slice(0, 5)) || p.nombre.toLowerCase().includes(s.nombre.toLowerCase().slice(0, 5))));
      if (idx >= 0) { const s2 = [...supl]; s2[idx] = { ...s2[idx], ms: p.ms != null ? p.ms : s2[idx].ms, pc: p.pc != null ? p.pc : s2[idx].pc }; setSupl(s2); }
      else setSupl([...supl, { nombre: p.nombre || "Insumo del documento", dosis: 0, precio: 0, ms: p.ms || 88, pc: p.pc || 10 }]);
    } else if (p.tipo === "gasto") confirmarEvento(p);
    setPropuestasDoc((ps) => ps.filter((x) => x._tmpId !== p._tmpId));
  }
  function descartarPropuestaDoc(id) { setPropuestasDoc((ps) => ps.filter((x) => x._tmpId !== id)); }
  const descPropuestaDoc = (p) => (p.tipo === "insumo" ? `Insumo: ${p.nombre} — MS ${p.ms != null ? p.ms + "%" : "?"} · PC ${p.pc != null ? p.pc + "%" : "?"}${p.fuente ? ` (${p.fuente})` : ""}` : desc(p));

  // ═══ Copiar resumen / CSV ═══
  function copiarResumenFinca() {
    const texto = [
      `*INVERPRO · ${nombreFinca}*`, `Resumen del ${hoy.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`, "",
      `Hato: ${fmt(nAnimales)} animales (${fmt(machos)} machos, ${fmt(hembras)} hembras) · ${fmt(pesoProm)} kg prom.`,
      `Carga: ${carga.toFixed(2)} UGG/ha · Autonomía de pasto: ${fmt(autonomia)} días (semáforo ${semaforo})`,
      `Margen del mes: $${fmt(margenMes)} · Costo/kg: $${fmt(costoPorKg)}`,
      `Registros de campo: ${eventos.length} históricos`,
    ].join("\n");
    try { navigator.clipboard.writeText(texto); alert("Resumen copiado."); } catch (e) { alert("No se pudo copiar automáticamente."); }
  }
  function descargarCSV() {
    if (!eventos.length) { alert("Todavía no hay registros para exportar."); return; }
    const cols = ["fecha", "tipo", "lote", "franja", "peso", "n", "aforo", "categoria", "valor", "producto", "clase", "cantidad", "nota"];
    const filas = eventos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((e) => cols.map((c) => {
      const v = e[c]; if (v === undefined || v === null) return "";
      const s = String(v).replace(/"/g, '""'); return /[",;\n]/.test(s) ? `"${s}"` : s;
    }).join(";"));
    const csv = [cols.join(";"), ...filas].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(nombreFinca || "finca").replace(/\s+/g, "-")}-registros-${hoyISO()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ═══ Asesor IA ═══
  const [msgs, setMsgs] = useState([{ role: "assistant", text: "Soy el asesor técnico INVERPRO. Configura tu finca y podré darte recomendaciones con tus datos reales, tu pasto y tu región." }]);
  const [input, setInput] = useState("");
  const [pensando, setPensando] = useState(false);
  const chatRef = useRef(null);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [msgs, pensando]);
  async function enviar() {
    const q = input.trim();
    if (!q || pensando) return;
    const nuevos = [...msgs, { role: "user", text: q }];
    setMsgs(nuevos); setInput(""); setPensando(true);
    const ctx = `Eres el Asesor Técnico de INVERPRO, plataforma de gestión ganadera, experto en ganadería tropical colombiana, pastoreo rotacional, nutrición y normativa ICA.
FINCA: "${nombreFinca}" · ${municipio ? municipio + ", " : ""}${region} · sistema de ${sistema} · pasto base: ${pastoTipo} (PC ${pcPasto}% en la época actual).
- ${areaManejada} ha manejadas en ${nPotreros} franjas de ${haPotrero} ha; ocupación ${ocupacionDias} día(s) → descanso real ${descansoReal} d (objetivo ${descansoMeta}). Franja actual #${potreroActual}.
- Hato: ${nAnimales} animales (${machos} machos, ${hembras} hembras), peso prom. ${pesoProm.toFixed(0)} kg → carga ${carga.toFixed(2)} UGG/ha.
- Ciclo: ingreso ${fechaIngreso} con ${pesoIngreso} kg, meta +${metaGanancia} kg en ${cicloMeses} meses. GDP requerida ${gdpReq.toFixed(0)} g vs ${gdpReal ? "REAL medida " + gdpReal : "estimada " + gdp} g.
- Suplemento/animal/día: ${supl.filter((s) => s.nombre).map((x) => `${x.nombre} ${x.dosis} kg`).join("; ") || "sin definir"} · Proteína total dieta ~${fmt(pcTotal)} g/día vs requerimiento ~${fmt(pcReq)} g.
- Pasto: aforo ${aforoBase} kg MS/ha, utilización ${utilizacion}%. Autonomía ${fmt(autonomia)} días. Semáforo: ${semaforo}.
- Finanzas/mes: margen $${fmt(margenMes)}, costo/kg $${fmt(costoPorKg)} vs precio $${fmt(precioKg)}.
- Sanidad: ${ultDespa ? `desparasitación hace ${diasDespa} d` : "sin desparasitación registrada"}. Ciclo ICA: ${enCicloICA ? "EN CURSO" : `en ~${diasProxCiclo} días`}.
${pares.length ? `- RED INVERPRO (${pares.length} fincas anónimas): carga prom. ${fmt(prom("carga"), 2)} UGG/ha, productividad ${fmt(prom("kgHaAno"))} kg/ha/año, costo/kg $${fmt(prom("costoKg"))}.` : ""}
Responde en español, directo, máximo 3 párrafos, con los datos de arriba.`;
    try {
      const texto = await preguntarIA([{ role: "user", content: ctx }, { role: "assistant", content: "Entendido, tengo los datos de la finca." }, ...nuevos.slice(-8).map((m) => ({ role: m.role, content: m.text }))]);
      setMsgs((m) => [...m, { role: "assistant", text: texto || "No recibí respuesta." }]);
    } catch (e) { setMsgs((m) => [...m, { role: "assistant", text: "Error de conexión: " + e.message }]); }
    setPensando(false);
  }

  // ═══ UI helpers ═══
  const campo = (lbl, val, set, uni, paso = 1) => (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>{lbl}</span>
      <div className="flex items-center gap-2">
        <input type="number" value={val} step={paso} onChange={(e) => set(Number(e.target.value) || 0)} className="w-full rounded-lg px-3 py-2"
          style={{ border: `1px solid ${C.linea}`, fontFamily: F.mono, fontSize: 15, color: C.tinta, background: C.fondo, outline: "none" }} />
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.tintaSuave, minWidth: 38 }}>{uni}</span>
      </div>
    </label>
  );
  const texto = (lbl, val, set, ph) => (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>{lbl}</span>
      <input type="text" value={val} placeholder={ph} onChange={(e) => set(e.target.value)} className="rounded-lg px-3 py-2"
        style={{ border: `1px solid ${C.linea}`, fontFamily: F.body, fontSize: 15, color: C.tinta, background: C.fondo, outline: "none" }} />
    </label>
  );
  const lista = (lbl, val, set, ops) => (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>{lbl}</span>
      <select value={val} onChange={(e) => set(e.target.value)} className="rounded-lg px-3 py-2"
        style={{ border: `1px solid ${C.linea}`, fontFamily: F.body, fontSize: 15, color: C.tinta, background: C.fondo, outline: "none" }}>
        {ops.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
  const stat = (lbl, val, uni, col = C.tinta) => (
    <div className="flex flex-col rounded-xl p-3" style={{ background: C.fondo }}>
      <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em", color: C.tintaSuave, textTransform: "uppercase" }}>{lbl}</span>
      <span style={{ fontFamily: F.display, fontSize: 23, fontWeight: 700, color: col, lineHeight: 1.2 }}>
        {val}<span style={{ fontSize: 12, fontWeight: 500, color: C.tintaSuave, marginLeft: 4 }}>{uni}</span>
      </span>
    </div>
  );
  const tema = (n, t) => (
    <div className="flex items-center gap-3 mt-2">
      <span style={{ fontFamily: F.mono, fontSize: 12, color: C.marca, fontWeight: 700 }}>{n}</span>
      <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", color: C.tintaSuave, textTransform: "uppercase" }}>{t}</span>
      <div style={{ flex: 1, height: 1, background: C.linea }} />
    </div>
  );
  const th = { fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase", textAlign: "right", padding: "6px 8px", borderBottom: `1px solid ${C.linea}` };
  const td = { fontFamily: F.mono, fontSize: 13, color: C.tinta, textAlign: "right", padding: "7px 8px", borderBottom: `1px solid ${C.linea}` };
  const btn = (col = C.pasto) => ({ background: col, color: col === C.sabana ? C.tinta : "#FFF", fontFamily: F.display, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" });

  const pSel = null; // (reservado)

  // ═══ ONBOARDING / ENTRADA ═══
  if (cargando) return (
    <div style={{ background: C.fondo, minHeight: "100vh", fontFamily: F.body, display: "flex", alignItems: "center", justifyContent: "center", color: C.tintaSuave }}>
      Cargando…
    </div>
  );

  if (!perfil) {
    const pasos = [
      { t: "¿Cómo se llama tu finca?", c: (
        <div className="flex flex-col gap-3">
          {texto("Nombre de la finca", nombreFinca, setNombreFinca, "Ej.: Las Marías")}
          {texto("Municipio", municipio, setMunicipio, "Ej.: Maní")}
          {lista("Departamento / región", region, setRegion, REGIONES)}
        </div>) },
      { t: "¿Qué sistema manejas?", c: (
        <div className="flex flex-col gap-3">
          {lista("Sistema productivo", sistema, setSistema, SISTEMAS)}
          {lista("Pasto base", pastoTipo, (v) => { setPastoTipo(v); setAforoBase(PASTOS[v].aforo); }, Object.keys(PASTOS))}
        </div>) },
      { t: "Tu tierra y tu ganado", c: (
        <div className="grid grid-cols-2 gap-3">
          {campo("Área en pastoreo", areaManejada, setAreaManejada, "ha")}
          {campo("Tamaño de franja", haPotrero, setHaPotrero, "ha", 0.25)}
          {campo("Días por franja", ocupacionDias, setOcupacionDias, "días")}
          {campo("Descanso objetivo", descansoMeta, setDescansoMeta, "días")}
          {campo("Machos", machos, setMachos, "cab")}
          {campo("Hembras", hembras, setHembras, "cab")}
          <div className="col-span-2" style={{ fontSize: 12.5, color: C.tintaSuave }}>
            {nPotreros > 0 ? <>Serán <b>{nPotreros} franjas</b>, carga {carga.toFixed(2)} UGG/ha, descanso real {descansoReal} d.</> : "Escribe tu área y tamaño de franja."}
          </div>
        </div>) },
      { t: "La red INVERPRO", c: (
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Tus datos son <b>privados</b>. Si aceptas, compartimos de forma <b>anónima</b> cinco indicadores para que te compares con otras fincas.
          </p>
          <label className="flex items-center gap-3 rounded-xl p-3" style={{ background: compartirRed ? C.pastoClaro : C.fondo, cursor: "pointer" }}>
            <input type="checkbox" checked={compartirRed} onChange={(e) => setCompartirRed(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.pasto }} />
            <span style={{ fontSize: 14 }}>Sí, quiero comparar mi finca con la red (anónimo)</span>
          </label>
        </div>) },
    ];
    const p = pasos[paso];
    return (
      <div style={{ background: C.fondo, minHeight: "100vh", fontFamily: F.body, color: C.tinta }}>
        <div className="max-w-lg mx-auto px-5 py-10 flex flex-col gap-5">
          <div className="text-center">
            <img src="/marca/lockup-light.webp" alt="Inverpro" style={{ height: 40, width: "auto", margin: "0 auto 6px", display: "block" }} />
            <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.28em", color: C.tintaSuave, textTransform: "uppercase" }}>Ganadería · Acciones con visión</div>
          </div>

          {entrarConCodigo ? (
            <div className="rounded-2xl p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
              <h2 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>Entrar con tu código de finca</h2>
              <p style={{ fontSize: 13, color: C.tintaSuave, margin: "0 0 14px" }}>Si ya configuraste tu finca antes (en este equipo o en otro), escribe el código que te dimos al crearla.</p>
              {texto("Código de finca", codigoInput, setCodigoInput, "Ej.: LASMA-4821")}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEntrarConCodigo(false)} className="rounded-xl px-4 py-2.5" style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Atrás</button>
                <button onClick={entrarConCodigoExistente} className="rounded-xl px-4 py-2.5 flex-1" style={btn()}>Entrar →</button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
              <div className="flex gap-1.5 mb-4">
                {pasos.map((_, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= paso ? C.pasto : C.linea }} />)}
              </div>
              <h2 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, margin: "0 0 14px" }}>{p.t}</h2>
              {p.c}
              <div className="flex gap-2 mt-5">
                {paso > 0 && <button onClick={() => setPaso(paso - 1)} className="rounded-xl px-4 py-2.5" style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Atrás</button>}
                <button onClick={() => { if (paso < pasos.length - 1) setPaso(paso + 1); else terminarOnboarding(); }}
                  disabled={paso === 0 && !nombreFinca.trim()} className="rounded-xl px-4 py-2.5 flex-1"
                  style={{ ...btn(), opacity: paso === 0 && !nombreFinca.trim() ? 0.5 : 1 }}>
                  {paso < pasos.length - 1 ? "Continuar →" : "Crear mi finca →"}
                </button>
              </div>
            </div>
          )}

          {!entrarConCodigo && (
            <button onClick={() => setEntrarConCodigo(true)} style={{ background: "none", border: "none", color: C.pasto, fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "center" }}>
              Ya tengo una finca — entrar con mi código
            </button>
          )}
          <a href="/satelite/" style={{ display: "block", textAlign: "center", color: C.pasto, fontFamily: F.display, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            Ver el monitoreo satelital de la finca piloto Las Marías →
          </a>
          <p style={{ fontSize: 12, color: C.tintaSuave, textAlign: "center", margin: 0 }}>Plataforma de gestión ganadera · desarrollada por INVERPRO</p>
        </div>
      </div>
    );
  }

  const resumen = [
    { l: "Animales", v: fmt(nAnimales), u: "cab", s: `${fmt(machos)} ♂ · ${fmt(hembras)} ♀` },
    { l: "Kilos en pie", v: fmt(kilosEnPie / 1000, 1), u: "t", s: `${fmt(kgPorHa)} kg/ha` },
    { l: "Carga", v: carga.toFixed(2), u: "UGG/ha", s: `${fmt(areaManejada)} ha · ${nPotreros} franjas` },
    { l: sistema === "Ceba" ? "Ciclo" : "Días", v: sistema === "Ceba" ? `${avanceCiclo.toFixed(0)}%` : fmt(diasCeba), u: sistema === "Ceba" ? "" : "d", s: `${fmt(pesoProm)} kg prom.` },
    { l: "Rotación", v: `${ocupacionDias}`, u: "d/franja", s: `hoy #${potreroActual} · descanso ${descansoReal} d` },
    { l: "Suplemento", v: kgSuplDia.toFixed(1), u: "kg/animal", s: `$${fmt(costoSuplDia)}/animal/día` },
    { l: "Autonomía", v: fmt(autonomia), u: "días", s: `${potreros.filter((p) => p.listo).length}/${nPotreros} listas` },
    { l: "Margen mes", v: `$${fmt(margenMes / 1e6, 1)}`, u: "M", s: margenMes >= 0 ? "estimado" : "en rojo" },
  ];
  const kpis = [
    { k: "carga", lbl: "Carga animal", val: carga, uni: "UGG/ha", d: 2, mejor: true, pre: "" },
    { k: "gdp", lbl: "Ganancia diaria", val: gdpReal || gdp, uni: "g/día", d: 0, mejor: true, pre: "" },
    { k: "kgHaAno", lbl: "Productividad", val: prodAnualHa, uni: "kg/ha/año", d: 0, mejor: true, pre: "" },
    { k: "costoKg", lbl: "Costo por kilo", val: costoPorKg, uni: "COP", d: 0, mejor: false, pre: "$" },
  ];

  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mesIngresoIdx = new Date(fechaIngreso).getMonth();
  const nMesesCiclo = Math.min(14, Math.ceil(cicloMeses) + 1);
  const proyCeba = Array.from({ length: nMesesCiclo }, (_, i) => ({
    x: MESES[(mesIngresoIdx + i) % 12], real: Math.round(pesoIngreso + (gdp * 30.4 * i) / 1000), meta: Math.round(pesoIngreso + (gdpReq * 30.4 * i) / 1000),
  }));
  const factorSeca = [0.35, 0.35, 0.5, 0.8, 1, 1, 1, 1, 1, 1, 0.9, 0.55];
  const proyeccion = Array.from({ length: 12 }, (_, i) => {
    const mIdx = (mes + i) % 12;
    const pesoM = pesoProm + (gdp * 30.4 * i) / 1000;
    const consumoM = (Math.max(0, nAnimales * pesoM * (consumoPV / 100) - aporteSuplMS) * 30.4) / 1000;
    const ofertaM = (areaManejada * aforoBase * (utilizacion / 100) * (30.4 / Math.max(1, descansoMeta || 1)) * factorSeca[mIdx]) / 1000;
    return { x: MESES[mIdx], oferta: Math.round(ofertaM * 10) / 10, consumo: Math.round(consumoM * 10) / 10, margen: Math.round(((margenMes * (i + 1)) / 1e6) * 10) / 10 };
  });

  return (
    <div style={{ background: C.fondo, minHeight: "100vh", fontFamily: F.body, color: C.tinta }}>
      <header className="px-5 pt-5 pb-4 md:px-8" style={{ borderBottom: `1px solid ${C.linea}`, background: C.panel }}>
        <div className="flex items-center gap-4 flex-wrap justify-between max-w-5xl mx-auto">
          <div>
            <img src="/marca/lockup-light.webp" alt="Inverpro" style={{ height: 26, width: "auto", display: "block", marginBottom: 4 }} />
            <div style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: "0.22em", color: C.tintaSuave, textTransform: "uppercase" }}>Ganadería · Acciones con visión</div>
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: C.linea }} className="hidden md:block" />
          <div className="flex-1">
            <h1 style={{ fontFamily: F.display, fontWeight: 700, fontSize: "clamp(20px, 4vw, 30px)", margin: 0, lineHeight: 1.1 }}>{nombreFinca}</h1>
            <div style={{ fontSize: 13, color: C.tintaSuave }}>{municipio ? municipio + ", " : ""}{region} · {sistema} · {pastoTipo}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, marginTop: 3, color: C.tintaSuave }}>
              Código: <b style={{ color: C.tinta }}>{codigo}</b> · {guardado === "guardando" ? "⟳ guardando…" : guardado === "local" ? "○ guardado solo en este equipo" : "● guardado"}
            </div>
          </div>
          <button onClick={() => { setPaso(0); setPerfil(false); }} className="rounded-lg px-3 py-1.5"
            style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
            Editar finca
          </button>
        </div>
      </header>

      <main className="px-5 py-5 md:px-8 flex flex-col gap-5 max-w-5xl mx-auto">
        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.tinta }}>
          <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.14em", color: C.sabana, textTransform: "uppercase" }}>
              Resumen · {hoy.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
            </div>
            <button onClick={copiarResumenFinca} className="rounded-lg px-3 py-1.5" style={{ background: "rgba(255,255,255,0.1)", color: "#FFF", border: "none", fontFamily: F.display, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Copiar resumen
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {resumen.map((k, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)", textTransform: "uppercase" }}>{k.l}</div>
                <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, color: "#FFF", lineHeight: 1.15 }}>
                  {k.v}{k.u && <span style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginLeft: 4 }}>{k.u}</span>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{k.s}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl p-4 md:p-5 flex items-start gap-4" style={{ background: C.panel, border: `2px solid ${semColor}` }}>
          <div className="rounded-full flex-shrink-0" style={{ width: 44, height: 44, background: semColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{enSeca ? "☀️" : "🌧️"}</div>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: C.tintaSuave, textTransform: "uppercase" }}>Semáforo forrajero · {enSeca ? "en sequía" : "en lluvias"}</div>
            <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 700, color: semColor }}>{semaforo}</div>
            <p style={{ fontSize: 13.5, margin: "3px 0 0", lineHeight: 1.5 }}>{semMsg}</p>
          </div>
        </section>

        <section className="rounded-2xl p-4 md:p-5 flex items-center justify-between flex-wrap gap-3" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <div>
            <h2 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, margin: 0 }}>Hoy en la finca</h2>
            <p style={{ fontSize: 13, color: C.tintaSuave, margin: "3px 0 0" }}>Ganado en la franja <b style={{ color: C.tinta }}>#{potreroActual}</b> de {nPotreros || "?"} · siguiente: #{nPotreros ? (potreroActual % nPotreros) + 1 : "?"}</p>
          </div>
          <button onClick={rotarSiguiente} disabled={!nPotreros} className="rounded-xl px-4 py-2.5" style={{ ...btn(), opacity: nPotreros ? 1 : 0.5 }}>
            Registrar rotación → #{nPotreros ? (potreroActual % nPotreros) + 1 : "?"}
          </button>
        </section>

        {tema("01", "Cómo vas frente a la red")}
        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 4px" }}>Comparativo INVERPRO</h2>
          {!compartirRed ? (
            <p style={{ fontSize: 13, color: C.tintaSuave, margin: 0 }}>Activaste la privacidad total. Entra a "Editar finca" para habilitar la comparación con la red.</p>
          ) : pares.length === 0 ? (
            <p style={{ fontSize: 13, color: C.tintaSuave, margin: 0 }}>Aún no hay otras fincas en la red para comparar. A medida que más ganaderos usen INVERPRO, aquí verás tu percentil frente a ellos, de forma anónima.</p>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: C.tintaSuave, margin: "0 0 12px" }}>Tu finca frente a {pares.length} finca(s) de la red.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpis.map((k) => {
                  const p = prom(k.k), pct = percentil(k.k, k.val, k.mejor);
                  const mejor = p === null ? null : k.mejor ? k.val >= p : k.val <= p;
                  return (
                    <div key={k.k} className="rounded-xl p-3" style={{ background: C.fondo, borderLeft: `3px solid ${mejor ? C.pasto : C.arcilla}` }}>
                      <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>{k.lbl}</div>
                      <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, color: mejor ? C.pasto : C.arcilla }}>{k.pre}{fmt(k.val, k.d)}<span style={{ fontSize: 11, fontWeight: 500, color: C.tintaSuave, marginLeft: 3 }}>{k.uni}</span></div>
                      <div style={{ fontSize: 11.5, color: C.tintaSuave }}>red: {k.pre}{fmt(p, k.d)} · superas al {pct}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase", margin: "14px 0 4px" }}>Productividad: tu finca vs la red (kg/ha/año)</div>
              <MiniBarChart data={[{ n: "Tú", v: Math.round(prodAnualHa) }, ...pares.slice(0, 9).map((r) => ({ n: r.alias, v: r.kgHaAno }))]} dataKey="v" colorMain={C.marca} colorRest={C.pasto} />
            </>
          )}
        </section>

        {tema("02", "La finca y la rotación")}
        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 12px" }}>Datos de la finca</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {campo("Machos", machos, setMachos, "cab")}
            {campo("Hembras", hembras, setHembras, "cab")}
            {campo("Área manejada", areaManejada, setAreaManejada, "ha")}
            {campo("Tamaño de franja", haPotrero, setHaPotrero, "ha", 0.25)}
            {campo("Ocupación", ocupacionDias, setOcupacionDias, "días")}
            {campo("Descanso objetivo", descansoMeta, setDescansoMeta, "días")}
            {campo("Franja en uso", potreroActual, setPotreroActual, "#")}
            {campo("Días de lluvia (mes)", lluviaDias, setLluviaDias, "d")}
            {lista("Pasto base", pastoTipo, (v) => { setPastoTipo(v); setAforoBase(PASTOS[v].aforo); }, Object.keys(PASTOS))}
          </div>
          <p style={{ fontSize: 12, color: C.tintaSuave, margin: "10px 0 0" }}>
            {fmt(areaManejada)} ha en franjas de {fmt(haPotrero, 2)} ha → <b>{nPotreros} divisiones</b>; con {ocupacionDias} día(s) de ocupación cada una descansa <b>{descansoReal} días</b>.
          </p>
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: 0 }}>Mapa de rotación</h2>
            <div className="flex gap-2">
              {[["plano", "Plano"], ["satelite", "Satélite"]].map(([id, l]) => (
                <button key={id} onClick={() => setVista(id)} className="rounded-lg px-3 py-1.5"
                  style={{ border: `1px solid ${vista === id ? C.pasto : C.linea}`, background: vista === id ? C.pastoClaro : C.panel, color: vista === id ? C.pasto : C.tintaSuave, fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
          </div>
          {vista === "plano" ? (
            <div className="grid grid-cols-6 md:grid-cols-10 gap-2 mt-3">
              {potreros.map((p) => {
                const t = Math.max(0, Math.min(1, p.dias / (descansoMeta || 1)));
                const lp = (a, z) => Math.round(a + (z - a) * t);
                return (
                  <div key={p.num} title={`Franja ${p.num}: ${p.dias.toFixed(0)} d`} className="rounded-lg flex flex-col items-center justify-center"
                    style={{ aspectRatio: "1", background: p.actual ? C.sabana : `rgb(${lp(176, 47)},${lp(138, 107)},${lp(79, 60)})`, outline: p.actual ? `2px solid ${C.tinta}` : "none", outlineOffset: 2 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 12, color: "#FFF" }}>{p.actual ? "🐄" : p.num}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: "rgba(255,255,255,0.85)" }}>{p.actual ? "hoy" : `${p.dias.toFixed(0)}d`}</span>
                  </div>
                );
              })}
              {nPotreros === 0 && <p style={{ fontSize: 12.5, color: C.tintaSuave, gridColumn: "1/-1" }}>Completa área manejada y tamaño de franja para ver el mapa de rotación.</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mt-3">{campo("Latitud", lat, setLat, "°", 0.001)}{campo("Longitud", lng, setLng, "°", 0.001)}</div>
              <p style={{ fontSize: 12, color: C.tintaSuave, margin: "6px 0 8px" }}>{sat ? "Potreros reales del KMZ de la finca, coloreados por NDVI de la última imagen Sentinel-2 útil." : <>Toca el mapa para ubicar tu finca; las franjas se dibujan a escala real ({fmt(haPotrero, 2)} ha c/u).</>}</p>
              <div id="mapa" className="rounded-xl" style={{ height: 380, width: "100%", background: C.fondo }} />
            </>
          )}
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 6 }}>
            <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: 0 }}>Monitoreo satelital de potreros</h2>
            <a href="/satelite/" className="rounded-lg px-3 py-1.5" style={{ border: `1px solid ${C.pasto}`, color: C.pasto, fontFamily: F.display, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>Ver mapa y serie de 12 meses →</a>
          </div>
          {sat ? (() => {
            const r = resumenSatelite(sat);
            const bajo = r.filas.filter((f) => f.d != null && f.d <= -0.05);
            return (
              <>
                <p style={{ fontSize: 12.5, color: C.tintaSuave, margin: "0 0 10px" }}>
                  NDVI (vigor del pasto) en la imagen Sentinel-2 del <b style={{ color: C.tinta }}>{fechaCorta(r.fecha)}</b>. Promedio del predio: <b style={{ color: C.tinta }}>{fmt(r.predio, 2)}</b>. {sat.imagenes.utiles} de {sat.imagenes.total} imágenes útiles en 12 meses.
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                    <thead><tr><th style={{ ...th, textAlign: "left" }}>Potrero</th><th style={th}>ha</th><th style={th}>NDVI</th><th style={th}>vs predio</th><th style={th}>vs anterior</th><th style={{ ...th, textAlign: "left" }}>Estado</th></tr></thead>
                    <tbody>
                      {r.filas.map((f) => (
                        <tr key={f.k}>
                          <td style={{ ...td, textAlign: "left", fontFamily: F.body }}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: colorNdvi(f.v), marginRight: 8, verticalAlign: "middle" }} />{f.nombre}</td>
                          <td style={td}>{fmt(f.ha, 2)}</td>
                          <td style={td}>{f.v == null ? "—" : fmt(f.v, 2)}</td>
                          <td style={{ ...td, color: f.d != null && f.d <= -0.05 ? C.rojo : C.tinta }}>{f.d == null ? "—" : conSigno(f.d)}</td>
                          <td style={td}>{f.v == null || f.ant == null ? "—" : conSigno(f.v - f.ant)}</td>
                          <td style={{ ...td, textAlign: "left", fontFamily: F.body, color: f.estado === "Bajo el promedio" ? C.rojo : C.pasto, fontWeight: 600 }}>{f.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: 13, margin: "10px 0 0", lineHeight: 1.5 }}>
                  {r.filas[0] && r.filas[0].v != null && <>Mayor vigor relativo: <b>{r.filas[0].nombre}</b> — candidato para la próxima entrada si cumple el descanso; confírmalo con un aforo. </>}
                  {bajo.map((f) => <span key={f.k}><b style={{ color: C.rojo }}>{f.nombre}</b> está {fmt(Math.abs(f.d), 2)} por debajo del predio{f.n >= 3 ? ` (${f.bajo} de las últimas ${f.n} imágenes)` : ""}: revisa carga, descanso y suelo desnudo. </span>)}
                </p>
              </>
            );
          })() : (
            <p style={{ fontSize: 13, color: C.tintaSuave, margin: "4px 0 0", lineHeight: 1.55 }}>
              INVERPRO puede seguir el vigor de cada potrero con imágenes Sentinel-2 cada vez que el cielo está despejado. Envía el KMZ de tus potreros a <b style={{ color: C.tinta }}>gerencia.inverpro@gmail.com</b> para activarlo. Mira cómo funciona con la finca piloto Las Marías.
            </p>
          )}
          <p style={{ fontSize: 11, color: C.tintaSuave, margin: "10px 0 0" }}>Contiene datos modificados de Copernicus Sentinel (2025–2026), procesados por INVERPRO. Indicativo: no reemplaza la verificación en campo.</p>
        </section>

        {tema("03", "Alimentación")}
        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 4px" }}>Suplementación</h2>
          <p style={{ fontSize: 12.5, color: C.tintaSuave, margin: "0 0 12px" }}>Escribe tus insumos con tus propios precios de proveedor.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>Ingrediente</th><th style={th}>kg</th><th style={th}>MS %</th><th style={th}>PC %</th><th style={th}>$/kg</th><th style={th}>$/día</th></tr></thead>
              <tbody>
                {supl.map((x, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: "left" }}>
                      <input type="text" value={x.nombre} onChange={(e) => { const s = [...supl]; s[i] = { ...x, nombre: e.target.value }; setSupl(s); }}
                        style={{ width: 130, border: `1px solid ${C.linea}`, borderRadius: 8, padding: "4px 6px", fontFamily: F.body, fontSize: 13, background: C.fondo, outline: "none" }} />
                    </td>
                    {["dosis", "ms", "pc", "precio"].map((k) => (
                      <td key={k} style={td}>
                        <input type="number" step={k === "dosis" ? 0.1 : k === "precio" ? 10 : 1} value={x[k]}
                          onChange={(e) => { const s = [...supl]; s[i] = { ...x, [k]: Number(e.target.value) || 0 }; setSupl(s); }}
                          style={{ width: 62, textAlign: "right", border: `1px solid ${C.linea}`, borderRadius: 8, padding: "4px 6px", fontFamily: F.mono, fontSize: 13, background: C.fondo, outline: "none" }} />
                      </td>
                    ))}
                    <td style={td}>${fmt(x.dosis * x.precio)}</td>
                  </tr>
                ))}
                <tr style={{ background: C.pastoClaro }}>
                  <td style={{ ...td, textAlign: "left", fontFamily: F.display, fontWeight: 600 }}>Total</td>
                  <td style={{ ...td, fontWeight: 600 }}>{kgSuplDia.toFixed(2)}</td>
                  <td style={td} colSpan={3}>{msSuplDia.toFixed(2)} kg MS · {fmt(pcSuplDia)} g PC</td>
                  <td style={{ ...td, fontWeight: 600 }}>${fmt(costoSuplDia)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setSupl([...supl, { nombre: "Nuevo insumo", dosis: 0, precio: 0, ms: 88, pc: 10 }])} className="rounded-lg px-3 py-1.5"
              style={{ background: "transparent", color: C.pasto, border: `1px solid ${C.pasto}`, fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>+ Ingrediente</button>
            {supl.length > 1 && <button onClick={() => setSupl(supl.slice(0, -1))} className="rounded-lg px-3 py-1.5" style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>− Quitar último</button>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {stat("Consumo mensual finca", fmt((kgSuplDia * nAnimales * 30.4) / 1000, 1), "t")}
            {stat("Costo suplemento", `$${fmt(costoSuplMes / 1e6, 1)}`, "M/mes")}
            {stat("Costo por kg ganado", `$${fmt(costoSuplPorKg)}`, "", costoSuplPorKg < precioKg ? C.pasto : C.rojo)}
            {stat("Proteína dieta", fmt(pcTotal), "g/día", pcTotal >= pcReq ? C.pasto : C.arcilla)}
          </div>
        </section>

        {/* ── Cargue de documentos ── */}
        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>📎</span>
            <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: 0 }}>Cargar documento</h2>
          </div>
          <p style={{ fontSize: 12.5, color: C.tintaSuave, margin: "6px 0 12px", lineHeight: 1.55 }}>
            Sube un bromatológico, la ficha técnica de un insumo o una factura en PDF. <b>El archivo se lee en tu dispositivo</b>: solo el texto extraído se envía a la IA.
          </p>
          {!pegarTextoDoc ? (
            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl cursor-pointer" style={{ border: `1.5px dashed ${C.pasto}`, background: C.pastoClaro, padding: "22px 16px", textAlign: "center" }}>
              <span style={{ fontSize: 24 }}>⬆️</span>
              <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: C.pasto }}>Toca aquí para cargar el PDF</span>
              <span style={{ fontSize: 12, color: C.tintaSuave }}>Bromatológico, ficha técnica o factura.</span>
              <input type="file" accept="application/pdf,.pdf,.txt" className="hidden" onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; manejarArchivoDoc(f); }} />
            </label>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea value={textoDocManual} onChange={(e) => setTextoDocManual(e.target.value)} rows={5} placeholder="Pega aquí el contenido del documento."
                className="w-full rounded-xl px-3 py-2.5" style={{ border: `1px solid ${C.linea}`, fontFamily: F.body, fontSize: 13.5, background: C.fondo, outline: "none", color: C.tinta, resize: "vertical" }} />
              <button onClick={() => { if (textoDocManual.trim()) { setNombreDocActual("texto pegado"); interpretarDocumento(textoDocManual, "texto pegado"); } }}
                disabled={cargandoDoc || !textoDocManual.trim()} className="rounded-xl px-4 py-2.5 self-start" style={{ ...btn(), opacity: cargandoDoc || !textoDocManual.trim() ? 0.6 : 1 }}>
                {cargandoDoc ? "Interpretando…" : "Analizar texto"}
              </button>
            </div>
          )}
          <button onClick={() => { setPegarTextoDoc(!pegarTextoDoc); setErrorDoc(""); }} className="mt-2" style={{ background: "none", border: "none", color: C.pasto, fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>
            {pegarTextoDoc ? "Volver a cargar un PDF" : "Pegar texto en vez de PDF"}
          </button>
          {cargandoDoc && !pegarTextoDoc && <div className="mt-3 rounded-lg px-3 py-2" style={{ background: C.fondo, fontSize: 13, color: C.tintaSuave }}>Leyendo {nombreDocActual}…</div>}
          {errorDoc && <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "#F7EDE6", color: C.arcilla, fontSize: 13 }}>{errorDoc}</div>}
          {propuestasDoc.length > 0 && (
            <div className="flex flex-col gap-2 mt-3">
              <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>Encontré esto en {nombreDocActual}:</div>
              {propuestasDoc.map((p) => (
                <div key={p._tmpId} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5" style={{ background: C.pastoClaro }}>
                  <span style={{ fontSize: 13.5 }}>{descPropuestaDoc(p)}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => confirmarPropuestaDoc(p)} className="rounded-lg px-3 py-1.5" style={{ background: C.pasto, color: "#FFF", border: "none", fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>✓ {p.tipo === "insumo" ? "Actualizar" : "Guardar"}</button>
                    <button onClick={() => descartarPropuestaDoc(p._tmpId)} className="rounded-lg px-3 py-1.5" style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 12px" }}>Pasto y balance</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {campo("Aforo base", aforoBase, setAforoBase, "kg MS/ha", 100)}
            {campo("Utilización", utilizacion, setUtilizacion, "%", 5)}
            {campo("Consumo", consumoPV, setConsumoPV, "% PV", 0.1)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {stat("Consumo de pasto", fmt(consumoPasto), "kg MS/día")}
            {stat("Oferta disponible", fmt(oferta / 1000, 1), "t MS")}
            {stat("Autonomía", fmt(autonomia), "días", semColor)}
            {stat("PC del pasto", pcPasto.toFixed(1), "%", pcPasto >= 7 ? C.pasto : C.arcilla)}
          </div>
        </section>

        {tema("04", "Finanzas y tendencias")}
        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 12px" }}>Producción</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stat("Kilos en pie", fmt(kilosEnPie / 1000, 1), "t")}
            {stat("Carga", carga.toFixed(2), "UGG/ha", carga > 2 ? C.arcilla : C.pasto)}
            {stat("Producción mensual", fmt(prodMesKg), "kg")}
            {stat("Productividad", fmt(prodAnualHa), "kg/ha/año", prodAnualHa > 150 ? C.pasto : C.tinta)}
          </div>
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 12px" }}>Costos del mes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {campo("Precio kg en pie", precioKg, setPrecioKg, "COP", 100)}
            {campo("Nómina", costoNomina, setCostoNomina, "COP", 100000)}
            {campo("Sanidad", costoVet, setCostoVet, "COP", 100000)}
            {campo("Mantenimiento", costoMant, setCostoMant, "COP", 100000)}
            {campo("Otros", costoOtros, setCostoOtros, "COP", 100000)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {stat("Ingreso estimado", `$${fmt(ingresoMes / 1e6, 1)}`, "M/mes", C.pasto)}
            {stat("Costos totales", `$${fmt(costoMes / 1e6, 1)}`, "M/mes")}
            {stat("Margen", `$${fmt(margenMes / 1e6, 1)}`, "M/mes", margenMes >= 0 ? C.pasto : C.rojo)}
            {stat("Costo por kg", `$${fmt(costoPorKg)}`, "COP", costoPorKg < precioKg ? C.pasto : C.rojo)}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {stat("Gasto real registrado", `$${fmt(gastoReal / 1e6, 1)}`, "M", gastoReal <= costoMes ? C.pasto : C.rojo)}
            {stat("Ejecución vs presupuesto", `${costoMes > 0 ? fmt((gastoReal / costoMes) * 100) : 0}%`, "", gastoReal <= costoMes ? C.pasto : C.rojo)}
          </div>
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 2px" }}>Tendencias y proyecciones</h2>
          <p style={{ fontSize: 12, color: C.tintaSuave, margin: "0 0 12px" }}>Proyección con tus datos actuales (sin ventas ni compras).</p>
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase", marginBottom: 4 }}>Ciclo: peso real vs meta (kg)</div>
          <MiniLineChart data={proyCeba} series={[{ key: "real", color: C.pasto }, { key: "meta", color: C.sabana }]} />
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase", margin: "14px 0 4px" }}>Balance de pasto mensual (t MS)</div>
          <MiniLineChart data={proyeccion} series={[{ key: "oferta", color: C.pasto }, { key: "consumo", color: C.arcilla }]} />
          <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase", margin: "14px 0 4px" }}>Margen acumulado (M COP)</div>
          <MiniLineChart data={proyeccion} series={[{ key: "margen", color: margenMes >= 0 ? C.pasto : C.rojo }]} />
        </section>

        {tema("05", "Registro de campo")}

        <section className="rounded-2xl p-4 md:p-5" style={{ background: hayReporteAyer ? C.pastoClaro : C.panel, border: `1px solid ${hayReporteAyer ? C.pasto : C.linea}` }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: 0 }}>📋 Reporte de ayer {new Date(ayerStr + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</h2>
              <p style={{ fontSize: 12.5, color: C.tintaSuave, margin: "3px 0 0" }}>{hayReporteAyer ? `${eventosAyer.length} registro(s) del día anterior.` : "Sin registros de campo ese día."}</p>
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(textoReporteAyer)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl px-4 py-2.5" style={{ background: "#25D366", color: "#FFF", fontFamily: F.display, fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>Enviar por WhatsApp →</a>
          </div>
          {hayReporteAyer && (
            <div className="flex flex-col gap-1.5 mt-3">
              {eventosAyer.map((e, i) => (
                <div key={i} style={{ fontSize: 13, background: C.panel, borderRadius: 8, padding: "6px 10px" }}>
                  {{ pesaje: "⚖️", aforo: "🌱", gasto: "💰", sanidad: "💉", novedad: "🐄" }[e.tipo] || "•"} {desc(e)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>💬</span>
            <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: 0 }}>Registro por WhatsApp</h2>
          </div>
          <p style={{ fontSize: 12.5, color: C.tintaSuave, margin: "6px 0 12px", lineHeight: 1.55 }}>Copia el mensaje del encargado y pégalo aquí. La IA lo convierte en registros — tú confirmas antes de guardar.</p>
          <textarea value={textoWA} onChange={(e) => setTextoWA(e.target.value)} placeholder='Ej.: "pesamos los machos, dieron 438. Pasamos al potrero 12."'
            className="w-full rounded-xl px-3 py-2.5" rows={3} style={{ border: `1px solid ${C.linea}`, fontFamily: F.body, fontSize: 14, background: C.fondo, outline: "none", color: C.tinta, resize: "vertical" }} />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={interpretarMensajeWA} disabled={interpretando || !textoWA.trim()} className="rounded-xl px-4 py-2.5" style={{ ...btn(), opacity: interpretando || !textoWA.trim() ? 0.6 : 1 }}>{interpretando ? "Interpretando…" : "Interpretar mensaje"}</button>
            {textoWA && !interpretando && <button onClick={() => { setTextoWA(""); setPropuestas([]); setErrorWA(""); }} className="rounded-xl px-3 py-2.5" style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Limpiar</button>}
          </div>
          {errorWA && <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "#F7EDE6", color: C.arcilla, fontSize: 13 }}>{errorWA}</div>}
          {propuestas.length > 0 && (
            <div className="flex flex-col gap-2 mt-3">
              <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>Confirma cada uno:</div>
              {propuestas.map((p) => (
                <div key={p._tmpId} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5" style={{ background: C.pastoClaro }}>
                  <span style={{ fontSize: 13.5 }}><span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.tintaSuave, marginRight: 8 }}>{p.fecha}</span>{descPropuesta(p)}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => confirmarPropuesta(p)} className="rounded-lg px-3 py-1.5" style={{ background: C.pasto, color: "#FFF", border: "none", fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>✓ Guardar</button>
                    <button onClick={() => descartarPropuesta(p._tmpId)} className="rounded-lg px-3 py-1.5" style={{ background: "transparent", color: C.tintaSuave, border: `1px solid ${C.linea}`, fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <div className="rounded-xl p-3 mb-3" style={{ background: C.fondo, border: `1px solid ${C.linea}` }}>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: "0.08em", color: C.tintaSuave, textTransform: "uppercase", marginBottom: 6 }}>Calendario sanitario · ICA</div>
            <div className="flex flex-col gap-1.5" style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: enCicloICA && !aftosaOk ? C.rojo : C.tinta }}>
                {enCicloICA ? (aftosaOk ? "✓ Ciclo ICA en curso: aftosa ya registrada." : "⚠ Ciclo de vacunación ICA EN CURSO: agenda la brigada y guarda el RUV.") : `Próximo ciclo ICA en ~${fmt(diasProxCiclo)} días (may-jun y nov-dic).`}
              </span>
              <span style={{ color: diasDespa === null || diasDespa > limDespa ? C.arcilla : C.tinta }}>
                {diasDespa === null ? `Sin desparasitación registrada (cada ${enSeca ? "90" : "45-60"} días).` : diasDespa > limDespa ? `⚠ Última desparasitación hace ${diasDespa} días.` : `✓ Desparasitación al día: hace ${diasDespa} días.`}
              </span>
              <span style={{ color: C.tintaSuave, fontSize: 12 }}>Toda venta o traslado requiere guía GSMI (SINIGAN/SIGMA).</span>
            </div>
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, margin: "0 0 4px" }}>Registro de datos reales</h2>
          <div className="flex gap-2 flex-wrap">
            {[["pesaje", "⚖️ Pesaje"], ["aforo", "🌱 Aforo"], ["gasto", "💰 Gasto"], ["sanidad", "💉 Sanidad"], ["novedad", "🐄 Novedad"]].map(([id, l]) => (
              <button key={id} onClick={() => { setRegTipo(id); setRegCat(id === "novedad" ? "venta" : id === "sanidad" ? "aftosa" : "suplemento"); }} className="rounded-lg px-3 py-1.5"
                style={{ border: `1px solid ${regTipo === id ? C.pasto : C.linea}`, background: regTipo === id ? C.pastoClaro : C.panel, color: regTipo === id ? C.pasto : C.tintaSuave, fontFamily: F.display, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <label className="flex flex-col gap-1">
              <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>Fecha</span>
              <input type="date" value={regFecha} onChange={(e) => setRegFecha(e.target.value)} className="rounded-lg px-3 py-2" style={{ border: `1px solid ${C.linea}`, fontFamily: F.mono, fontSize: 14, background: C.fondo, outline: "none", color: C.tinta }} />
            </label>
            {(regTipo === "pesaje" || regTipo === "novedad" || regTipo === "sanidad") && lista("Lote", regLote, setRegLote, ["general", "machos", "hembras"])}
            {(regTipo === "gasto" || regTipo === "novedad" || regTipo === "sanidad") && lista(
              regTipo === "gasto" ? "Categoría" : regTipo === "sanidad" ? "Producto" : "Novedad", regCat, setRegCat,
              regTipo === "gasto" ? ["suplemento", "nómina", "sanidad", "mantenimiento", "otros"] : regTipo === "sanidad" ? ["aftosa", "brucelosis", "rabia", "desparasitación", "vitaminas", "baño garrapaticida", "otro"] : ["venta", "muerte", "compra", "traslado"])}
            {regTipo === "aforo" && campo("Franja", regExtra, setRegExtra, "#")}
            <label className="flex flex-col gap-1">
              <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>{regTipo === "pesaje" ? "Peso prom. (kg)" : regTipo === "aforo" ? "Aforo (kg MS/ha)" : regTipo === "gasto" ? "Valor (COP)" : "Cantidad (cab)"}</span>
              <input type="number" value={regValor} onChange={(e) => setRegValor(e.target.value)} className="rounded-lg px-3 py-2" style={{ border: `1px solid ${C.linea}`, fontFamily: F.mono, fontSize: 15, background: C.fondo, outline: "none", color: C.tinta }} />
            </label>
            {(regTipo === "gasto" || regTipo === "novedad" || regTipo === "sanidad") && (
              <label className="flex flex-col gap-1 col-span-2">
                <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>{regTipo === "novedad" && (regCat === "venta" || regCat === "traslado") ? "Nº guía GSMI y nota" : "Nota (opcional)"}</span>
                <input type="text" value={regNota} onChange={(e) => setRegNota(e.target.value)} className="rounded-lg px-3 py-2" style={{ border: `1px solid ${C.linea}`, fontFamily: F.body, fontSize: 14, background: C.fondo, outline: "none", color: C.tinta }} />
              </label>
            )}
          </div>
          <button onClick={agregar} className="rounded-xl px-4 py-2.5 mt-3" style={btn()}>+ Agregar registro</button>
          {gdpReal !== null && (
            <div className="mt-3 rounded-lg px-3 py-2 flex items-center justify-between flex-wrap gap-2" style={{ background: gdpReal >= gdpReq ? C.pastoClaro : "#F7EDE6", fontSize: 13 }}>
              <span style={{ color: gdpReal >= gdpReq ? C.pasto : C.arcilla }}><b>GDP real medida: {fmt(gdpReal)} g/día</b> (requerida {fmt(gdpReq)} g)</span>
              {gdpReal !== gdp && <button onClick={() => setGdp(gdpReal)} className="rounded-lg px-3 py-1.5" style={{ ...btn(), fontSize: 12.5 }}>Usar en el tablero</button>}
            </div>
          )}
          {pesajes.length >= 2 && (
            <>
              <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase", margin: "14px 0 4px" }}>Curva de pesajes reales (kg)</div>
              <MiniLineChart data={pesajes.map((p) => ({ x: p.fecha.slice(5), peso: p.peso }))} series={[{ key: "peso", color: C.marca }]} />
            </>
          )}
          {eventos.length > 0 && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2" style={{ margin: "14px 0 6px" }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: C.tintaSuave, textTransform: "uppercase" }}>Últimos registros ({eventos.length})</div>
                <button onClick={descargarCSV} className="rounded-lg px-3 py-1.5" style={{ background: "transparent", color: C.pasto, border: `1px solid ${C.pasto}`, fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>Descargar CSV</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {eventos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8).map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: C.fondo }}>
                    <span style={{ fontSize: 13 }}><span style={{ fontFamily: F.mono, fontSize: 11.5, color: C.tintaSuave, marginRight: 8 }}>{e.fecha}</span>{desc(e)}</span>
                    <button onClick={() => borrarRegistro(e.id)} style={{ background: "none", border: "none", color: C.tintaSuave, cursor: "pointer", fontSize: 15 }}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {tema("06", "Asesor técnico")}
        <section className="rounded-2xl overflow-hidden" style={{ background: C.tinta }}>
          <div className="px-4 pt-4 md:px-5">
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.14em", color: C.sabana, textTransform: "uppercase" }}>Incluido en tu plan</div>
            <h2 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 600, color: "#FFF", margin: "2px 0 0" }}>Asesor INVERPRO · 24/7</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "4px 0 0" }}>Conoce tu pasto, tu hato, tus costos y la normativa ICA.</p>
          </div>
          <div ref={chatRef} className="px-4 md:px-5 py-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 320 }}>
            {msgs.map((m, i) => (
              <div key={i} className="rounded-xl px-3.5 py-2.5" style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? C.pasto : "rgba(255,255,255,0.08)", color: "#FFF", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.text}</div>
            ))}
            {pensando && <div className="rounded-xl px-3.5 py-2.5" style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Analizando tu finca…</div>}
          </div>
          <div className="flex gap-2 p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} placeholder="Ej.: ¿me alcanza el pasto hasta abril?"
              className="flex-1 rounded-xl px-3.5 py-2.5" style={{ background: "rgba(255,255,255,0.1)", border: "none", outline: "none", color: "#FFF", fontSize: 14, fontFamily: F.body }} />
            <button onClick={enviar} disabled={pensando} className="rounded-xl px-4 py-2.5" style={{ ...btn(C.sabana), opacity: pensando ? 0.6 : 1 }}>Enviar</button>
          </div>
        </section>

        <section className="rounded-2xl p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.linea}` }}>
          <h2 style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Tu código de finca</h2>
          <p style={{ fontSize: 13, color: C.tintaSuave, margin: "0 0 10px", lineHeight: 1.55 }}>
            Guárdalo para volver a entrar desde otro equipo, o compártelo con tu encargado para que ambos vean la misma finca: <b style={{ fontFamily: F.mono, color: C.tinta }}>{codigo}</b>
          </p>
          <button onClick={() => { try { navigator.clipboard.writeText(codigo); alert("Código copiado."); } catch (e) {} }} className="rounded-lg px-3 py-1.5"
            style={{ background: "transparent", color: C.pasto, border: `1px solid ${C.pasto}`, fontFamily: F.display, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
            Copiar código
          </button>
        </section>

        <footer className="pb-8 pt-2 flex flex-col items-center gap-2 text-center" style={{ fontFamily: F.mono, fontSize: 11, color: C.tintaSuave }}>
          <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.tinta }}>inver<span style={{ color: C.marca }}>pro</span></span>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase" }}>Acciones con visión</span>
          <span style={{ maxWidth: 480, lineHeight: 1.6 }}>
            Desarrollado por INVERPRO · INVERPRO Ganadería Versión 1, septiembre de 2026<br />
            © 2026 INVERPRO COL S.A.S., NIT 901.006.761-2. Derechos reservados sobre el código, el diseño y la marca.
          </span>
          <span style={{ maxWidth: 480, lineHeight: 1.6, fontSize: 10.5 }}>
            Los datos de referencia técnica (pasto, normativa ICA, requerimientos) son orientativos. El asesor con IA puede equivocarse: verifica decisiones importantes con un profesional.
          </span>
          <span style={{ marginTop: 4 }}>
            Otras herramientas: <a href="https://radar-secop.netlify.app/" style={{ color: C.pasto }}>Radar SECOP</a> · <a href="https://radar-secop.netlify.app/veeduria/" style={{ color: C.pasto }}>Ojo al contrato</a> · <a href="https://radar-secop.netlify.app/preparar/" style={{ color: C.pasto }}>Preparar oferta</a>
          </span>
        </footer>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
