# Mis Gastos

Control de gastos personal y de empresas que se registra solo:

| Qué pasa | Cómo llega | Acción del usuario |
|---|---|---|
| Compra o abono en Davivienda | SMS → automatización de Atajos | Ninguna |
| Compra con Tarjeta Alkosto (Tuya) y recordatorio de pago | SMS → automatización de Atajos | Ninguna |
| Pago con Apple Pay (Davivienda, Tuya, Falabella) | Automatización "Transacción" de Atajos | Ninguna |
| Gasto en efectivo | "Oye Siri, gasto en efectivo" → "20 mil almuerzo" | Hablar |
| Categoría dudosa | Bandeja "Por aprobar" | Un toque |

- Apple Pay y el SMS de la misma compra se unen en un solo movimiento.
- El pago de una tarjeta es un traslado, no un gasto: no se cuenta dos veces.
- Un retiro en cajero pasa el dinero de Davivienda a Efectivo.
- Lo que se aprueba se aprende: la próxima compra en ese comercio entra aprobada.
- **Disponible real** = cuentas + efectivo − lo que falta pagar de las tarjetas, repartido por día hasta el próximo salario, que se estima con la fecha del último abono de nómina.
- Indicadores: gasto contra presupuesto por categoría, comparación con el promedio de 3 meses, proyección de fin de mes, tasa de ahorro, tendencia de 6 meses, días de la semana, comercios, gastos hormiga, suscripciones, uso del cupo, gastos inusuales, empresas y reembolsos. Exporta a Excel por empresa y mes.

## Estructura

```
gastos/
├── public/                     App web instalable (se abre en Safari → Compartir → Agregar a inicio)
│   ├── index.html              Interfaz
│   ├── calculos.js             Saldos, disponible real, indicadores (sin DOM; lo usan la app y las pruebas)
│   └── sw.js, manifest, íconos
├── netlify/functions/
│   ├── gastos.mjs              /api/gastos (la app) y /api/ingresar (los Atajos)
│   └── lib/motor.mjs           Lectura de SMS, Apple Pay y voz; categorías; duplicados
└── pruebas/                    node --test, con SMS reales
```

Todo el libro vive en un solo blob de Netlify Blobs (`gastos/libro`). Cada escritura es condicional (etag), así un SMS y un pago de Apple Pay que llegan al mismo tiempo no se pisan.

## Netlify

- Proyecto nuevo con carpeta base `gastos/`, publicación `public`, funciones `netlify/functions`.
- Variables de entorno:
  - `GASTOS_CLAVE` (obligatoria): clave larga y aleatoria. Protege la app y la usan los Atajos en el encabezado `x-clave`.
  - `ANTHROPIC_API_KEY` (opcional): con ella la voz entiende cualquier frase. Sin ella, entiende frases simples como "20 mil almuerzo".
  - `GASTOS_MODELO` (opcional): otro modelo de Claude para interpretar la voz.

## Pruebas

```
cd gastos && npm install && npm test
```

## Agregar otro banco

Pega uno de sus SMS en Ajustes → Probar un SMS. Si no lo reconoce, agrega su formato en `leerSMS` (`lib/motor.mjs`) con una prueba en `pruebas/motor.test.mjs`.
