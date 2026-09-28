// Pruebas del motor con mensajes reales de Davivienda y Tarjeta Alkosto (Tuya).
// Correr con: node --test gastos/pruebas
import test from "node:test";
import assert from "node:assert/strict";
import { leerSMS, incorporar, crearLibro, parseMonto, leerTextoLibre, aprender, categorizar } from "../netlify/functions/lib/motor.mjs";

const llego = (iso) => new Date(iso);

test("montos en los formatos de cada banco", () => {
  assert.equal(parseMonto("$8,124,000"), 8124000);
  assert.equal(parseMonto("$54.900"), 54900);
  assert.equal(parseMonto("$2.038.181"), 2038181);
  assert.equal(parseMonto("COP 54.950,00"), 54950);
  assert.equal(parseMonto("54950"), 54950);
});

test("compra Davivienda", () => {
  const h = leerSMS("DAVIVIENDA . Compra   en Establecimiento, $54,950,Cta de Ahorros *6578,Hora 14:29,Lugar FARMATODO.", llego("2026-08-29T14:32:00-05:00"));
  assert.equal(h.tipo, "gasto");
  assert.equal(h.monto, 54950);
  assert.equal(h.ultimos, "6578");
  assert.equal(h.comercio, "FARMATODO");
  assert.equal(h.fecha, "2026-08-29T14:29:00-05:00");
});

test("abono de nómina Davivienda", () => {
  const h = leerSMS("DAVIVIENDA   Abono Transferencia ACH, $8,124,000,Cta de Ahorros *6578,Hora 15:05,Lugar 000000000000000000000000.", llego("2026-08-28T15:08:00-05:00"));
  assert.equal(h.tipo, "ingreso");
  assert.equal(h.monto, 8124000);
  assert.equal(h.comercio, "Abono Transferencia ACH");
});

test("compra de las 23:50 que llega pasada la medianoche queda el día anterior", () => {
  const h = leerSMS("DAVIVIENDA . Compra en Establecimiento, $10,800,Cta de Ahorros *6578,Hora 23:50,Lugar OMA BARRA DE CAFE BTA.", llego("2026-08-30T00:02:00-05:00"));
  assert.equal(h.fecha, "2026-08-29T23:50:00-05:00");
});

test("compra con Tarjeta Alkosto", () => {
  const h = leerSMS("TAR ALKOSTO: COMPRA APROBADA en DISNEY PLUS por $54.900 el 2026-08-28 17:03 con tu T.cred Alkosto Mastercard 2836 Info 018000915555");
  assert.equal(h.tipo, "gasto");
  assert.equal(h.monto, 54900);
  assert.equal(h.ultimos, "2836");
  assert.equal(h.comercio, "DISNEY PLUS");
  assert.equal(h.fecha, "2026-08-28T17:03:00-05:00");
});

test("recordatorios de pago de la tarjeta", () => {
  for (const t of [
    "TARJETA ALKOSTO: Hola Juan, organiza tus pagos. El 3 de septiembre de 2026 es tu fecha limite de pago por $2.038.181. Mantente al dia pagando facil en la App Tuya",
    "TARJETA ALKOSTO: Hola Juan, ¿Sabias que 8 de cada 10 clientes realizan los pagos de su Tarjeta Alkosto Mastercard antes o en su fecha limite de pago? ¡Se uno de ellos! La tuya es el proximo 3 de septiembre de 2026 por $2.038.181. Puedes hacerlo aqui: https://d.sfmsg.co/XM8aFw1pa",
  ]) {
    const h = leerSMS(t);
    assert.equal(h.tipo, "recordatorio");
    assert.equal(h.monto, 2038181);
    assert.equal(h.fechaLimite, "2026-09-03");
  }
});

test("el libro asigna cuentas, categorías y guarda el próximo pago", () => {
  const libro = crearLibro();
  const sms = (t, cuando) => incorporar(libro, { ...leerSMS(t, llego(cuando)), fuente: "sms", texto: t }, llego(cuando));

  const nomina = sms("DAVIVIENDA   Abono Transferencia ACH, $8,124,000,Cta de Ahorros *6578,Hora 15:05,Lugar 000000000000000000000000.", "2026-08-28T15:08:00-05:00");
  assert.equal(nomina.mov.cuenta, "davivienda");
  assert.equal(nomina.mov.cat, "salario");
  assert.equal(nomina.mov.estado, "ok");

  const disney = sms("TAR ALKOSTO: COMPRA APROBADA en DISNEY PLUS por $54.900 el 2026-08-28 17:03 con tu T.cred Alkosto Mastercard 2836 Info 018000915555", "2026-08-28T20:22:00-05:00");
  assert.equal(disney.mov.cuenta, "tuya");
  assert.equal(disney.mov.cat, "suscripciones");
  assert.equal(disney.mov.estado, "pendiente");

  const burger = sms("DAVIVIENDA . Compra en Establecimiento, $132,000,Cta de Ahorros *6578,Hora 14:50,Lugar HOME BURGERS 13.", "2026-08-29T14:51:00-05:00");
  assert.equal(burger.mov.cat, "restaurantes");

  sms("TARJETA ALKOSTO: Hola Juan, organiza tus pagos. El 3 de septiembre de 2026 es tu fecha limite de pago por $2.038.181.", "2026-09-01T12:56:00-05:00");
  assert.deepEqual(libro.cuentas.find((c) => c.id === "tuya").proximoPago.monto, 2038181);

  const repetido = sms("DAVIVIENDA . Compra en Establecimiento, $132,000,Cta de Ahorros *6578,Hora 14:50,Lugar HOME BURGERS 13.", "2026-08-29T14:55:00-05:00");
  assert.equal(repetido.accion, "duplicado");
  assert.equal(libro.movs.length, 3);
});

test("lo aprendido: al aprobar Home Burgers, la siguiente sucursal ya entra aprobada", () => {
  const libro = crearLibro();
  aprender(libro, { tipo: "gasto", comercio: "HOME BURGERS 13", cat: "restaurantes", empresa: null });
  const c = categorizar(libro, "HOME BURGERS 7");
  assert.equal(c.cat, "restaurantes");
  assert.equal(c.segura, true);
});

test("Apple Pay y el SMS de la misma compra quedan como un solo movimiento", () => {
  const libro = crearLibro();
  const ap = incorporar(libro, { tipo: "gasto", fuente: "applepay", monto: parseMonto("$54.950,00"), comercio: "Farmatodo", tarjeta: "Davivienda", fecha: "2026-08-29T14:29:30-05:00" });
  assert.equal(ap.mov.cuenta, "davivienda");
  const t = "DAVIVIENDA . Compra en Establecimiento, $54,950,Cta de Ahorros *6578,Hora 14:29,Lugar FARMATODO.";
  const s = incorporar(libro, { ...leerSMS(t, llego("2026-08-29T14:32:00-05:00")), fuente: "sms", texto: t });
  assert.equal(s.accion, "fusionado");
  assert.equal(libro.movs.length, 1);
  assert.deepEqual(libro.movs[0].fuentes, ["applepay", "sms"]);
});

test("pago de tarjeta: el débito en Davivienda y el aviso de la tarjeta forman un traslado", () => {
  const libro = crearLibro();
  const t = "DAVIVIENDA . Pago Tarjeta de Credito, $2,038,181,Cta de Ahorros *6578,Hora 09:10,Lugar TUYA.";
  const a = incorporar(libro, { ...leerSMS(t, llego("2026-09-02T09:11:00-05:00")), fuente: "sms", texto: t });
  assert.equal(a.mov.tipo, "traslado");
  assert.equal(a.mov.cuenta, "davivienda");
  const b = incorporar(libro, { tipo: "pago_recibido", monto: 2038181, fuente: "sms", texto: "TARJETA ALKOSTO: Recibimos tu pago por $2.038.181", fecha: "2026-09-02T10:00:00-05:00" });
  assert.equal(b.accion, "fusionado");
  assert.equal(libro.movs[0].destino, "tuya");
  assert.equal(libro.movs[0].estado, "ok");
});

test("efectivo por voz", () => {
  const libro = crearLibro();
  const a = leerTextoLibre(libro, "20 mil almuerzo");
  assert.equal(a.monto, 20000);
  assert.equal(a.cuenta, "efectivo");
  assert.equal(a.tipo, "gasto");
  const b = leerTextoLibre(libro, "pagué 35.000 de taxi");
  assert.equal(b.monto, 35000);
  assert.equal(b.cat, "transporte");
  const c = leerTextoLibre(libro, "1,5 millones arriendo");
  assert.equal(c.monto, 1500000);
  assert.equal(c.cat, "hogar");
  const d = leerTextoLibre(libro, "15 lucas café con tarjeta alkosto");
  assert.equal(d.monto, 15000);
  assert.equal(d.cuenta, "tuya");
  assert.equal(d.cat, "restaurantes");
});

test("la nómina repite el mismo SMS cada mes y no se toma como duplicado", () => {
  const libro = crearLibro();
  const t = "DAVIVIENDA   Abono Transferencia ACH, $8,124,000,Cta de Ahorros *6578,Hora 15:05,Lugar 000000000000000000000000.";
  for (const cuando of ["2026-07-28T15:08:00-05:00", "2026-08-28T15:08:00-05:00"]) {
    incorporar(libro, { ...leerSMS(t, new Date(cuando)), fuente: "sms", texto: t }, new Date(cuando));
  }
  assert.equal(libro.movs.length, 2);
});

test("las palabras clave no se cuelan dentro de otras", () => {
  const libro = crearLibro();
  assert.equal(categorizar(libro, "ARRIENDO INMOBILIARIA").cat, "hogar");
  assert.equal(categorizar(libro, "HOME BURGERS 13").cat, "restaurantes");
  assert.equal(categorizar(libro, "OMA BARRA DE CAFE BTA").cat, "restaurantes");
  assert.equal(categorizar(libro, "TERPEL EDS 25").cat, "transporte");
  assert.equal(categorizar(libro, "MERCADOLIBRE*COMPRA").cat, "compras");
  assert.equal(categorizar(libro, "DOLLARCITY AV 4").cat, "compras");
});
