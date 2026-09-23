// Función servidor: guarda cada finca bajo su código privado, y mantiene
// la lista de indicadores anónimos de la red INVERPRO. Usa Netlify Blobs,
// que Netlify aprovisiona solo, sin base de datos externa que configurar.
import { getStore } from "@netlify/blobs";

function limpiarCodigo(c) {
  return String(c || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 40);
}

export default async (req) => {
  const url = new URL(req.url);
  const accion = url.searchParams.get("accion");

  try {
    if (accion === "cargar") {
      const codigo = limpiarCodigo(url.searchParams.get("codigo"));
      if (!codigo) return json({ error: "Falta el código de finca" }, 400);
      const store = getStore("fincas");
      const valor = await store.get(codigo, { type: "json" });
      return json({ ok: true, datos: valor || null });
    }

    if (accion === "guardar" && req.method === "POST") {
      const body = await req.json();
      const codigo = limpiarCodigo(body.codigo);
      if (!codigo) return json({ error: "Falta el código de finca" }, 400);
      const store = getStore("fincas");
      await store.setJSON(codigo, body.datos || {});

      // Publicar (o retirar) los indicadores anónimos de la red
      const redStore = getStore("red-inverpro");
      if (body.compartirRed && body.kpisRed) {
        await redStore.setJSON(codigo, { ...body.kpisRed, act: new Date().toISOString().slice(0, 10) });
      } else {
        await redStore.delete(codigo).catch(() => {});
      }
      return json({ ok: true });
    }

    if (accion === "red") {
      const redStore = getStore("red-inverpro");
      const { blobs } = await redStore.list();
      const datos = [];
      for (const b of blobs.slice(0, 200)) {
        try {
          const v = await redStore.get(b.key, { type: "json" });
          if (v) datos.push({ alias: b.key, ...v });
        } catch (e) {}
      }
      return json({ ok: true, red: datos });
    }

    return json({ error: "Acción no reconocida. Usa ?accion=cargar|guardar|red" }, 400);
  } catch (e) {
    return json({ error: "Error del servidor: " + e.message }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export const config = { path: "/.netlify/functions/finca" };
