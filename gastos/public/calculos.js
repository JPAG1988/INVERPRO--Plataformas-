// Cálculos de Mis Gastos: saldos por cuenta, disponible real, salario, indicadores y tendencias.
// Módulo puro (sin DOM): lo usan la app y las pruebas.

const DIA = 86400000;
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const llaveComercio = (s) => norm(s).replace(/[*#.,]/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();

// Fecha de hoy en Bogotá como "AAAA-MM-DD".
export const hoyBogota = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const mesDe = (fecha) => String(fecha).slice(0, 7);
const diaDe = (fecha) => String(fecha).slice(0, 10);
const aDate = (ymd) => new Date(ymd + "T12:00:00-05:00");
export const diasEntre = (a, b) => Math.round((aDate(b) - aDate(a)) / DIA);
export const diasDelMes = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
export function sumarMeses(ym, n) {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const fechaCorta = (f) => `${+String(f).slice(8, 10)} ${MESES[+String(f).slice(5, 7) - 1]}`;
const suma = (lista, f = (x) => x.monto) => lista.reduce((a, x) => a + (f(x) || 0), 0);
const pesos = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export const enAmbito = (m, ambito) => !ambito || ambito === "todo" || (ambito === "personal" ? !m.empresa : m.empresa === ambito);

// ——— Saldos ———
export function saldos(libro, hoy = hoyBogota()) {
  const movs = libro.movs || [];
  return (libro.cuentas || []).map((c) => {
    // Los movimientos guardan la hora al minuto: el punto de partida también.
    const desde = c.desde ? new Date(Math.floor(Date.parse(c.desde) / 60000) * 60000) : null;
    const vale = (m) => !desde || new Date(m.fecha) >= desde;
    const propios = movs.filter(vale);
    const ing = suma(propios.filter((m) => m.tipo === "ingreso" && m.cuenta === c.id));
    const gas = suma(propios.filter((m) => m.tipo === "gasto" && m.cuenta === c.id));
    const sale = suma(propios.filter((m) => m.tipo === "traslado" && m.cuenta === c.id));
    const entra = suma(propios.filter((m) => m.tipo === "traslado" && m.destino === c.id));
    if (c.tipo === "credito") {
      const deuda = (c.deudaInicial || 0) + gas - ing - entra + sale;
      let pago = null;
      if (c.proximoPago?.fecha) {
        const desdeAviso = new Date(c.proximoPago.registrado || 0);
        const pagado = suma(movs.filter((m) => m.tipo === "traslado" && m.destino === c.id && new Date(m.fecha) >= desdeAviso));
        const pendiente = Math.max(0, (c.proximoPago.monto || 0) - pagado);
        pago = { fecha: c.proximoPago.fecha, monto: c.proximoPago.monto, pagado, pendiente, dias: diasEntre(hoy, c.proximoPago.fecha) };
      }
      return { id: c.id, nombre: c.nombre, tipo: c.tipo, deuda, cupo: c.cupo || 0, uso: c.cupo ? deuda / c.cupo : null, pago, iniciada: !!c.desde };
    }
    return { id: c.id, nombre: c.nombre, tipo: c.tipo, saldo: (c.saldoInicial || 0) + ing - gas - sale + entra, iniciada: !!c.desde };
  });
}

// ——— Salario: último abono y fecha estimada del próximo ———
export function salario(libro, hoy = hoyBogota()) {
  const pagos = (libro.movs || []).filter((m) => m.tipo === "ingreso" && m.cat === "salario").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimo = pagos.at(-1) || null;
  const diaFijo = Number(libro.config?.diaSalario) || 0;
  let proximo = null;
  if (diaFijo) {
    let ym = mesDe(hoy);
    for (let i = 0; i < 3 && !proximo; i++, ym = sumarMeses(ym, 1)) {
      const f = `${ym}-${String(Math.min(diaFijo, diasDelMes(ym))).padStart(2, "0")}`;
      if (f > hoy && (!ultimo || diasEntre(diaDe(ultimo.fecha), f) > 5)) proximo = f;
    }
  } else if (ultimo) {
    const difs = pagos.slice(-4).map((p, i, a) => (i ? diasEntre(diaDe(a[i - 1].fecha), diaDe(p.fecha)) : null)).filter((x) => x);
    const quincenal = difs.length && mediana(difs) < 20;
    let f = diaDe(ultimo.fecha);
    while (f <= hoy) {
      if (quincenal) f = new Date(aDate(f).getTime() + 15 * DIA).toISOString().slice(0, 10);
      else { const ym = sumarMeses(mesDe(f), 1); f = `${ym}-${String(Math.min(+diaDe(ultimo.fecha).slice(8), diasDelMes(ym))).padStart(2, "0")}`; }
    }
    proximo = f;
  }
  return { ultimo, proximo, dias: proximo ? diasEntre(hoy, proximo) : null };
}

// ——— Lo que de verdad hay para gastar ———
export function disponible(libro, hoy = hoyBogota()) {
  const s = saldos(libro, hoy);
  const liquido = suma(s.filter((c) => c.tipo !== "credito"), (c) => c.saldo);
  const tarjetas = suma(s.filter((c) => c.pago && c.pago.dias <= 40), (c) => c.pago.pendiente);
  const sal = salario(libro, hoy);
  const real = liquido - tarjetas;
  const dias = sal.dias && sal.dias > 0 ? sal.dias : diasDelMes(mesDe(hoy)) - +hoy.slice(8) + 1;
  return { liquido, tarjetas, real, dias, porDia: Math.max(0, real) / Math.max(1, dias), salario: sal, cuentas: s };
}

// ——— Indicadores del mes ———
export function resumenMes(libro, ym, ambito = "todo", hoy = hoyBogota()) {
  const movs = (libro.movs || []).filter((m) => mesDe(m.fecha) === ym && enAmbito(m, ambito));
  const gastos = movs.filter((m) => m.tipo === "gasto");
  const ingresos = movs.filter((m) => m.tipo === "ingreso");
  const totalG = suma(gastos), totalI = suma(ingresos);
  const actual = ym === mesDe(hoy);
  const diasMes = diasDelMes(ym);
  const transcurridos = actual ? +hoy.slice(8) : diasMes;

  // Promedio de los 3 meses anteriores por categoría, para comparar
  const previos = [1, 2, 3].map((n) => sumarMeses(ym, -n));
  const antes = (libro.movs || []).filter((m) => m.tipo === "gasto" && previos.includes(mesDe(m.fecha)) && enAmbito(m, ambito));
  const mesesConDatos = new Set(antes.map((m) => mesDe(m.fecha))).size || 1;

  const porCat = (libro.categorias || []).filter((c) => c.tipo === "gasto").map((c) => {
    const total = suma(gastos.filter((m) => m.cat === c.id));
    const promedio = suma(antes.filter((m) => m.cat === c.id)) / mesesConDatos;
    return { id: c.id, nombre: c.nombre, total, presupuesto: c.presupuesto || 0, promedio, uso: c.presupuesto ? total / c.presupuesto : null };
  }).filter((c) => c.total || c.presupuesto).sort((a, b) => b.total - a.total);

  const porDiaSemana = [0, 0, 0, 0, 0, 0, 0]; // lunes a domingo
  gastos.forEach((m) => { porDiaSemana[(aDate(diaDe(m.fecha)).getUTCDay() + 6) % 7] += m.monto; });

  const comercios = {};
  gastos.forEach((m) => {
    const k = llaveComercio(m.comercio) || "sin nombre";
    comercios[k] = comercios[k] || { comercio: m.comercio, total: 0, veces: 0 };
    comercios[k].total += m.monto; comercios[k].veces++;
  });

  const umbral = Number(libro.config?.umbralHormiga) || 30000;
  const hormiga = gastos.filter((m) => m.monto < umbral);

  // Gastos grandes frente a lo normal de su categoría
  const inusuales = gastos.filter((m) => {
    const hist = antes.filter((x) => x.cat === m.cat).map((x) => x.monto);
    return m.monto >= 100000 && hist.length >= 3 && m.monto > 3 * mediana(hist);
  });

  const presupuestoTotal = suma(porCat, (c) => c.presupuesto);
  return {
    ym, ingresos: totalI, gastos: totalG, ahorro: totalI - totalG, tasaAhorro: totalI ? (totalI - totalG) / totalI : null,
    proyeccion: actual && transcurridos ? (totalG / transcurridos) * diasMes : totalG,
    promedioDiario: transcurridos ? totalG / transcurridos : 0,
    presupuestoTotal, porCat, porDiaSemana,
    topComercios: Object.values(comercios).sort((a, b) => b.total - a.total).slice(0, 6),
    hormiga: { n: hormiga.length, total: suma(hormiga), umbral },
    inusuales,
    movimientos: movs.length,
  };
}

// ——— Tendencia de los últimos n meses ———
export function tendencia(libro, ymFin, n = 6, ambito = "todo") {
  return Array.from({ length: n }, (_, i) => sumarMeses(ymFin, i - n + 1)).map((ym) => {
    const movs = (libro.movs || []).filter((m) => mesDe(m.fecha) === ym && enAmbito(m, ambito));
    return { ym, gastos: suma(movs.filter((m) => m.tipo === "gasto")), ingresos: suma(movs.filter((m) => m.tipo === "ingreso")) };
  });
}

// ——— Suscripciones y cobros que se repiten cada mes ———
export function suscripciones(libro, hoy = hoyBogota()) {
  const desde = sumarMeses(mesDe(hoy), -3);
  const grupos = {};
  (libro.movs || []).filter((m) => m.tipo === "gasto" && mesDe(m.fecha) >= desde).forEach((m) => {
    const k = llaveComercio(m.comercio);
    (grupos[k] = grupos[k] || []).push(m);
  });
  return Object.values(grupos).map((lista) => {
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const meses = new Set(lista.map((m) => mesDe(m.fecha)));
    const ultimo = lista.at(-1);
    const parecidos = lista.filter((m) => Math.abs(m.monto - ultimo.monto) <= ultimo.monto * 0.15).length;
    const esSuscripcion = ultimo.cat === "suscripciones" || (meses.size >= 2 && parecidos >= 2 && lista.length <= meses.size + 1);
    return esSuscripcion ? { comercio: ultimo.comercio, monto: ultimo.monto, ultimo: diaDe(ultimo.fecha), meses: meses.size, cuenta: ultimo.cuenta } : null;
  }).filter(Boolean).sort((a, b) => b.monto - a.monto);
}

// ——— Empresas: gasto del mes y lo que te deben por reembolsos ———
export function empresas(libro, ym) {
  return (libro.empresas || []).map((e) => {
    const propios = (libro.movs || []).filter((m) => m.empresa === e.id);
    return {
      id: e.id, nombre: e.nombre,
      gastoMes: suma(propios.filter((m) => m.tipo === "gasto" && mesDe(m.fecha) === ym)),
      porCobrar: suma(propios.filter((m) => m.tipo === "gasto" && m.reembolsable && !m.reembolsado)),
      pendientes: propios.filter((m) => m.reembolsable && !m.reembolsado).length,
    };
  });
}

// ——— Alertas para la pantalla de inicio ———
export function alertas(libro, hoy = hoyBogota()) {
  const out = [];
  const d = disponible(libro, hoy);
  d.cuentas.filter((c) => c.pago && c.pago.pendiente > 0).forEach((c) => {
    if (c.pago.dias < 0) out.push({ nivel: "critico", texto: `${c.nombre}: el pago venció hace ${-c.pago.dias} días` });
    else if (c.pago.dias <= 5) out.push({ nivel: c.pago.dias <= 2 ? "critico" : "aviso", texto: `${c.nombre}: pagar ${pesos(c.pago.pendiente)} antes del ${fechaCorta(c.pago.fecha)} (${c.pago.dias === 0 ? "hoy" : `en ${c.pago.dias} días`})` });
  });
  d.cuentas.filter((c) => c.uso != null && c.uso > 0.3).forEach((c) =>
    out.push({ nivel: c.uso > 0.7 ? "critico" : "aviso", texto: `${c.nombre}: usas el ${Math.round(c.uso * 100)} % del cupo (lo sano es menos del 30 %)` }));
  if (d.real < 0) out.push({ nivel: "critico", texto: "Lo que debes pagar en tarjetas supera lo que tienes en cuenta y efectivo" });
  const mes = resumenMes(libro, mesDe(hoy), "todo", hoy);
  mes.porCat.filter((c) => c.uso != null && c.uso >= 0.8).forEach((c) =>
    out.push({ nivel: c.uso >= 1 ? "critico" : "aviso", texto: `${c.nombre}: ${Math.round(c.uso * 100)} % del presupuesto del mes` }));
  mes.inusuales.forEach((m) => out.push({ nivel: "aviso", texto: `Gasto inusual: ${m.comercio}` }));
  const pendientes = (libro.movs || []).filter((m) => m.estado === "pendiente").length;
  if (pendientes) out.push({ nivel: "info", texto: `${pendientes} movimiento${pendientes > 1 ? "s" : ""} por aprobar` });
  return out;
}

// ——— Exportar a Excel (CSV con ; y BOM, como lo abre Excel en español) ———
export function csv(libro, { desde, hasta, ambito = "todo" } = {}) {
  const nom = (lista, id) => (lista || []).find((x) => x.id === id)?.nombre || "";
  const filas = (libro.movs || [])
    .filter((m) => (!desde || diaDe(m.fecha) >= desde) && (!hasta || diaDe(m.fecha) <= hasta) && enAmbito(m, ambito))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => [diaDe(m.fecha), m.fecha.slice(11, 16), m.tipo, m.comercio, nom(libro.categorias, m.cat), m.tipo === "gasto" ? -m.monto : m.monto,
      nom(libro.cuentas, m.cuenta), nom(libro.cuentas, m.destino), nom(libro.empresas, m.empresa) || "Personal",
      m.reembolsable ? (m.reembolsado ? "Reembolsado" : "Por cobrar") : "", m.nota || ""]);
  const esc = (v) => (typeof v === "number" ? String(v) : `"${String(v).replace(/"/g, '""')}"`);
  return "﻿" + [["Fecha", "Hora", "Tipo", "Comercio", "Categoría", "Monto", "Cuenta", "Destino", "Empresa", "Reembolso", "Nota"], ...filas]
    .map((f) => f.map(esc).join(";")).join("\r\n");
}
