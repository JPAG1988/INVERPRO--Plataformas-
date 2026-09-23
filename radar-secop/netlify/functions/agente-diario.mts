import type { Config } from "@netlify/functions";

// Dispara la revisión diaria del agente. Corre a las 11:00 UTC, que son las 6:00 a.m. en Colombia,
// para que el informe esté listo al empezar el día.
export default async () => {
  const base = Netlify.env.get("URL") || Netlify.env.get("DEPLOY_URL") || "";
  if (!base) { console.error("No hay URL del sitio para invocar el agente"); return; }
  const r = await fetch(`${base}/.netlify/functions/agente-background`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ origen: "programado" }),
  });
  console.log("Agente invocado:", r.status);
};

export const config: Config = { schedule: "0 11 * * *" };
