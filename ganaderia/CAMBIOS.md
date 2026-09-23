# INVERPRO Ganadería: módulo de monitoreo satelital

Versión del 23 de septiembre de 2026. Cambios sobre el sitio publicado en inverpro-ganaderia.netlify.app (deploy del 14 de septiembre de 2026).

## Qué cambia

1. **Sección nueva «Monitoreo satelital de potreros»**, dentro de «La finca y la rotación».
   - Si la finca se llama Las Marías, muestra el NDVI real de cada potrero en la última imagen Sentinel-2 útil.
   - Para cada potrero muestra la diferencia frente al promedio del predio, el cambio frente a la imagen anterior y el estado.
   - Recomienda qué potrero tiene más vigor relativo y cuál está por debajo del promedio de forma persistente.
   - Para otras fincas explica cómo activar el servicio y enlaza a la finca piloto.
2. **Mapa satelital con potreros reales.** En la vista «Satélite», Las Marías dibuja el lindero y los 5 potreros del KML (P1 a P4 y recepción), coloreados por NDVI, en lugar de la cuadrícula teórica.
3. **Página nueva `/satelite/`** con el visor completo para Las Marías:
   - Mapa de píxeles de 10 m.
   - NDVI, NDRE y NDMI.
   - Serie de 12 meses.
   - Alertas y reporte mensual.
   - Pestaña «Datos y uso», con el origen de los datos, las limitaciones y la Ley 1581 de 2012.
4. **Logo oficial de Inverpro** (archivos WebP en `/marca/`) en el encabezado y la pantalla de entrada. Reemplaza el logotipo hecho con texto.
5. **Enlace en la pantalla de entrada:** «Ver el monitoreo satelital de la finca piloto Las Marías».

## Archivos

| Archivo | Estado |
|---|---|
| `app.jsx` | Modificado (el resto del código sigue igual) |
| `index.html` | Sin cambios |
| `marca/*.webp` | Nuevos |
| `satelite/index.html` | Nuevo |
| `satelite/las-marias-s2.json` | Nuevo (1,25 MB): datos por píxel para el visor |
| `satelite/las-marias-resumen.json` | Nuevo (3 KB): resumen por potrero para la app |

## Estado de la publicación

Este paquete es el proyecto completo y listo para publicar. Incluye las funciones `finca` y `asesor`, `netlify.toml` y `package.json`, tomados del zip del 23 de septiembre de 2026.

El `index.html` es la versión nueva, que compila `app.jsx` en el navegador. Se sube a `?v=3` para que los navegadores no usen la copia anterior guardada.

El 23 de septiembre de 2026 se intentó publicar y Netlify lo omitió por falta de créditos de la cuenta («Skipped due to account credit usage exceeded»). El sitio en línea no cambió.

## Datos satelitales

- **Fuente:** Copernicus Sentinel-2 L2A, tesela 18NZL, obtenida del catálogo Earth Search (Element 84) en AWS Open Data.
- **Periodo:** 1 de septiembre de 2025 a 21 de septiembre de 2026. Son 108 imágenes, de las que 23 son útiles tras la máscara de nubes SCL (umbral: 60 % del predio despejado).
- **Atribución obligatoria:** «Contiene datos modificados de Copernicus Sentinel (2025–2026), procesados por INVERPRO».
