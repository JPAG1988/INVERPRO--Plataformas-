// Pruebas de saldos e indicadores con un mes parecido al real.
import test from "node:test";
import assert from "node:assert/strict";
import { crearLibro, incorporar, leerSMS } from "../netlify/functions/lib/motor.mjs";
import { saldos, disponible, salario, resumenMes, tendencia, suscripciones, empresas, alertas, csv } from "../public/calculos.js";

function mesDePrueba() {
  const libro = crearLibro();
  const dav = libro.cuentas.find((c) => c.id === "davivienda");
  dav.saldoInicial = 500000; dav.desde = "2026-08-01T00:00:00-05:00";
  const sms = (t, cuando) => incorporar(libro, { ...leerSMS(t, new Date(cuando)), fuente: "sms", texto: t }, new Date(cuando));
  sms("DAVIVIENDA   Abono Transferencia ACH, $8,124,000,Cta de Ahorros *6578,Hora 15:05,Lugar 000000000000000000000000.", "2026-08-28T15:08:00-05:00");
  sms("DAVIVIENDA . Compra en Establecimiento, $54,950,Cta de Ahorros *6578,Hora 14:29,Lugar FARMATODO.", "2026-08-29T14:32:00-05:00");
  sms("DAVIVIENDA . Compra en Establecimiento, $132,000,Cta de Ahorros *6578,Hora 14:50,Lugar HOME BURGERS 13.", "2026-08-29T14:51:00-05:00");
  sms("DAVIVIENDA . Compra en Establecimiento, $10,800,Cta de Ahorros *6578,Hora 15:27,Lugar OMA BARRA DE CAFE BTA.", "2026-08-29T15:28:00-05:00");
  sms("TAR ALKOSTO: COMPRA APROBADA en DISNEY PLUS por $54.900 el 2026-07-28 17:03 con tu T.cred Alkosto Mastercard 2836 Info 018000915555", "2026-07-28T17:05:00-05:00");
  sms("TAR ALKOSTO: COMPRA APROBADA en DISNEY PLUS por $54.900 el 2026-08-28 17:03 con tu T.cred Alkosto Mastercard 2836 Info 018000915555", "2026-08-28T20:22:00-05:00");
  sms("TAR ALKOSTO: COMPRA APROBADA en GOPASS por $7.381 el 2026-08-28 11:38 con tu T.cred Alkosto Mastercard 2836 Info 018000915555", "2026-08-28T20:22:00-05:00");
  sms("TARJETA ALKOSTO: Hola Juan, organiza tus pagos. El 3 de septiembre de 2026 es tu fecha limite de pago por $2.038.181.", "2026-09-01T12:56:00-05:00");
  incorporar(libro, { tipo: "gasto", fuente: "voz", monto: 20000, comercio: "Almuerzo", cuenta: "efectivo", cat: "restaurantes" }, new Date("2026-08-30T13:00:00-05:00"));
  return libro;
}

test("saldo de Davivienda y deuda de la tarjeta", () => {
  const s = saldos(mesDePrueba(), "2026-09-01");
  assert.equal(s.find((c) => c.id === "davivienda").saldo, 500000 + 8124000 - 54950 - 132000 - 10800);
  const tuya = s.find((c) => c.id === "tuya");
  assert.equal(tuya.pago.pendiente, 2038181);
  assert.equal(tuya.pago.dias, 2);
});

test("disponible real descuenta el pago de la tarjeta y reparte hasta el próximo salario", () => {
  const d = disponible(mesDePrueba(), "2026-09-01");
  assert.equal(d.tarjetas, 2038181);
  assert.equal(d.salario.proximo, "2026-09-28");
  assert.equal(d.dias, 27);
  assert.equal(d.real, d.liquido - 2038181);
  assert.ok(Math.abs(d.porDia - d.real / 27) < 1);
});

test("salario con día fijo configurado", () => {
  const libro = mesDePrueba();
  libro.config.diaSalario = 30;
  assert.equal(salario(libro, "2026-09-01").proximo, "2026-09-30");
});

test("indicadores de agosto", () => {
  const r = resumenMes(mesDePrueba(), "2026-08", "todo", "2026-09-01");
  assert.equal(r.ingresos, 8124000);
  assert.equal(r.gastos, 54950 + 132000 + 10800 + 54900 + 7381 + 20000);
  assert.equal(r.porCat[0].id, "restaurantes");
  assert.equal(r.hormiga.n, 3);
  assert.equal(r.topComercios[0].comercio, "HOME BURGERS 13");
  const t = tendencia(mesDePrueba(), "2026-08", 6);
  assert.equal(t.length, 6);
  assert.equal(t.at(-1).ingresos, 8124000);
});

test("Disney aparece como suscripción", () => {
  const s = suscripciones(mesDePrueba(), "2026-09-01");
  assert.ok(s.some((x) => x.comercio === "DISNEY PLUS" && x.meses === 2));
});

test("empresas y reembolsos", () => {
  const libro = mesDePrueba();
  libro.empresas = [{ id: "e-inverpro", nombre: "INVERPRO" }];
  const burger = libro.movs.find((m) => m.comercio === "HOME BURGERS 13");
  burger.empresa = "e-inverpro"; burger.reembolsable = true;
  const e = empresas(libro, "2026-08")[0];
  assert.equal(e.porCobrar, 132000);
  assert.equal(resumenMes(libro, "2026-08", "personal", "2026-09-01").gastos, 54950 + 10800 + 54900 + 7381 + 20000);
  assert.match(csv(libro, { ambito: "e-inverpro" }), /HOME BURGERS 13.*INVERPRO.*Por cobrar/);
});

test("alertas: pago de tarjeta cerca y pendientes por aprobar", () => {
  const a = alertas(mesDePrueba(), "2026-09-01");
  assert.ok(a.some((x) => x.nivel === "critico" && /Alkosto/.test(x.texto)));
  assert.ok(a.some((x) => /por aprobar/.test(x.texto)));
});
