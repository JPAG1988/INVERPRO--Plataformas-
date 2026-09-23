// Función servidor: intermediario con la API de Anthropic.
// La clave nunca viaja al navegador: vive como variable de entorno en Netlify.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "JSON inválido en la solicitud" }), { status: 400 });
  }

  const { messages, max_tokens } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Falta el arreglo 'messages'" }), { status: 400 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "El sitio no tiene configurada ANTHROPIC_API_KEY. Agrégala en Netlify → Site settings → Environment variables." }),
      { status: 500 }
    );
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: max_tokens || 1000,
        messages,
      }),
    });
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error al conectar con la IA: " + e.message }), { status: 502 });
  }
};

export const config = { path: "/.netlify/functions/asesor" };
