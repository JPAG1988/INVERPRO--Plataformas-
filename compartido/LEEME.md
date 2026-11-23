# Componente legal de INVERPRO IA

`inverpro-legal.js` agrega a cualquier herramienta:

- Un pie de página con el titular (razón social, NIT, ciudad y correo), el crédito «Desarrollado por INVERPRO IA», © y enlaces a los términos y a la política de datos.
- En modo `herramienta`, una ventana la primera vez que se usa, con casilla obligatoria «He leído y acepto…». La aceptación se guarda en el navegador con la fecha y la versión, y se vuelve a pedir si cambia la versión.

Se configura con un bloque JSON antes del script:

```html
<script type="application/json" id="inverpro-legal-config">
{"id":"inverpro-ganaderia","herramienta":"INVERPRO Ganadería","modo":"herramienta","version":"2026-11-23",
 "titular":{"nombre":"Inverpro Col S.A.S.","nit":"901.006.761-2","ciudad":"Yopal, Casanare","correo":"gerencia.inverpro@gmail.com"},
 "puntos":["Cómo trata los datos esta herramienta…"]}
</script>
```

Por defecto enlaza a https://inverpro-col.netlify.app/terminos y /privacidad (campos `terminos` y `politica` para cambiarlos). Cambie `version` cuando cambien las condiciones para pedir aceptación de nuevo.
