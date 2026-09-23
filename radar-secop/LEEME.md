# Radar SECOP

Suite publicada en radar-secop.netlify.app (proyecto de Netlify `radar-secop`):

| Ruta | Herramienta |
|---|---|
| `/` | Radar SECOP: procesos abiertos del SECOP II, consultados en vivo en datos.gov.co |
| `/veeduria/` | Ojo al contrato: veeduría a la contratación estatal en Casanare, con asistente de IA |
| `/preparar/` | Preparar oferta: revisión de pliegos, banco de experiencia y capacidad residual |
| `/agente/` | Agente de oportunidades: revisión diaria del SECOP con avisos |

## Estado de esta carpeta

Contiene el **frontend tal como está publicado**, descargado del sitio el 23 de septiembre de 2026. Se retiraron los fragmentos que Netlify inserta al servir la página.

**Falta el código del servidor.** Las páginas llaman a estos cuatro servicios:

- `/api/preguntar`: asistente de IA (función de borde, con límite de uso).
- `/api/pliego`: análisis de pliegos.
- `/api/agente`: perfil e informe del agente. Detrás hay una función en segundo plano y una tarea diaria a las 6:00 a. m. de Colombia.
- `/api/visitas`: contador de visitas.

Además faltan `netlify.toml` y `package.json`.

> No enlaces esta carpeta a Netlify ni la publiques hasta agregar esos archivos. Si se publica sin ellos, dejan de funcionar el asistente, el agente, el análisis de pliegos y el contador.

Las variables secretas (`TELEGRAM_BOT_TOKEN`, `AGENTE_CLAVE`, `ANTHROPIC_API_KEY`) viven solo en Netlify y no deben subirse a este repositorio.
