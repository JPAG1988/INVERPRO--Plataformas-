# Plataforma INVERPRO

Código fuente de las herramientas web de INVERPRO COL S.A.S. (NIT 901.006.761-2), Yopal, Casanare.

| Carpeta | Herramienta | Publicación |
|---|---|---|
| `ganaderia/` | INVERPRO Ganadería: rotación, ceba, suplementación, finanzas, asesor con IA y monitoreo satelital de potreros | inverpro-ganaderia.netlify.app |
| `monitor-predial/` | Monitor Predial: seguimiento satelital para agricultores y empresas con obligaciones de siembra | Artifact de Claude |
| `radar-secop/` | Radar SECOP, Ojo al contrato, Preparar oferta y Agente de oportunidades (solo frontend; ver LEEME) | radar-secop.netlify.app |
| `diagnostico-predial/` | Diagnóstico Predial: Módulo 1 del Kit de Ganadería Regenerativa (app y formato Word) | Sin publicar |
| `datos/las-marias/` | KML de la finca y scripts que descargan y procesan Sentinel-2 | — |

## Reglas

- Este repositorio es la única fuente de verdad. No se publica nada que no esté aquí.
- Las llaves (`ANTHROPIC_API_KEY` y otras) van solo en las variables de entorno de Netlify, nunca en el código.
- Datos satelitales: «Contiene datos modificados de Copernicus Sentinel, procesados por INVERPRO».

## Netlify

- Proyecto `inverpro-ganaderia`: carpeta base `ganaderia/`, publicación `.`, funciones `netlify/functions`.
- En el plan gratuito, cada publicación gasta créditos; conviene agrupar los cambios.
