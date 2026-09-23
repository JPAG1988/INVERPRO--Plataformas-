# Radar SECOP — INVERPRO

Cuatro herramientas sobre datos abiertos de contratación pública (datos.gov.co / SECOP).
Publicadas en https://radar-secop.netlify.app

| Ruta | Herramienta | Qué hace |
|---|---|---|
| `/` | **Radar SECOP** | Busca procesos abiertos y filtra oportunidades por perfil. |
| `/veeduria/` | **Ojo al contrato** | Veeduría ciudadana: indicadores, señales de alerta y asistente de consulta. |
| `/preparar/` | **Preparar oferta** | Lee los anexos en PDF del proceso y arma el resumen y los documentos a entregar. |
| `/agente/` | **Agente de oportunidades** | Revisa el SECOP todos los días y avisa por Telegram y correo. |

## Estructura

```
netlify.toml                         publish = "public"
package.json
public/
  index.html                         Radar SECOP
  veeduria/index.html                Ojo al contrato
  preparar/index.html                Preparar oferta
  agente/index.html                  Agente de oportunidades
netlify/edge-functions/
  preguntar.ts                       /api/preguntar  — asistente de la veeduría
  pliego.ts                          /api/pliego     — lectura asistida de pliegos
  visitas.ts                         /api/visitas    — contador de visitas
netlify/functions/
  agente-background.mts              revisión del SECOP y armado del informe
  agente-diario.mts                  disparo programado (cron 0 11 * * *)
  agente-api.mts                     /api/agente     — informe, perfil, destinos, ejecución
  lib/perfil.mts                     tipo Perfil, PERFIL_BASE, almacenes y utilidades
  lib/avisos.mts                     envío por Telegram y correo
```

## Variables de entorno

Se configuran en Netlify (Site settings → Environment variables). **Ninguna va en el código.**

| Variable | Para qué | Obligatoria |
|---|---|---|
| `ANTHROPIC_API_KEY` | Asistente de la veeduría y lectura de pliegos. La inyecta el AI Gateway de Netlify. | Para la IA |
| `ANTHROPIC_BASE_URL` | La inyecta el AI Gateway de Netlify. | No |
| `TELEGRAM_BOT_TOKEN` | Avisos del agente por Telegram. | Para Telegram |
| `RESEND_API_KEY` | Avisos del agente por correo. | Para correo |
| `CORREO_REMITENTE` | Remitente de los correos. | No |
| `AGENTE_CLAVE` | Protege `/api/agente`. Si no se define, la API queda abierta. | Recomendada |
| `ASISTENTE_MODELO` | Modelo a usar. Por defecto `claude-haiku-4-5`. | No |
| `ASISTENTE_CREDITOS_MES` | Tope mensual de gasto en IA. | No |
| `ASISTENTE_LIMITE_HORA` / `ASISTENTE_LIMITE_DIA` | Preguntas por IP en el asistente. | No |
| `PLIEGO_LIMITE_HORA` / `PLIEGO_LIMITE_DIA` | Lecturas de pliego por IP. | No |

## Desplegar

```bash
npm install
netlify deploy --prod
```

Los blobs (`@netlify/blobs`) guardan el perfil del agente, el último informe, los destinos
de aviso y los contadores. No hay base de datos.

## Aviso

Versión de prueba. La información proviene de fuentes abiertas y puede contener errores;
se recomienda validarla siempre contra el SECOP. Comentarios: gerencia.inverpro@gmail.com

Desarrollado por INVERPRO COL S.A.S. — NIT 901.006.761-2. Derechos reservados y uso libre.
