import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Perfil de búsqueda del agente: qué territorios, actividades y filtros le interesan a la empresa.

export type Perfil = {
  departamentos: string[];
  palabras: string[];
  excluir: string[];
  unspsc: string[];
  valorMin: number;
  valorMax: number;
  diasMin: number;
  soloSinRup: boolean;
  modalidades: string[];
  creditosMes: number;
};

export const PERFIL_BASE: Perfil = {
  departamentos: ["Casanare"],
  palabras: [
    "obra civil", "vía terciaria", "placa huella", "pavimenta", "alcantarill", "acueduct",
    "agua potable", "potabiliza", "ptap", "ptar", "pozo profundo", "reservorio", "canal",
    "drenaje", "distrito de riego", "saneamiento", "topograf", "estudio de suelos",
    "interventor", "consultoría", "ambiental", "reforesta", "restauración", "vivero",
    "silvopastoril", "compensación", "residuos sólidos", "vertimiento", "mantenimiento vial",
    "infraestructura", "construcción", "pago por servicios ambientales",
  ],
  excluir: ["ambiental sanitaria", "gestión ambiental escolar", "vigilancia", "cafetería"],
  unspsc: ["72141100", "72141000", "81101500", "77101700", "70141600", "72102900"],
  valorMin: 20000000,
  valorMax: 0,
  diasMin: 2,
  soloSinRup: false,
  modalidades: [],
  creditosMes: 30,
};

export const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const hoyBogota = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const mesActual = () => hoyBogota().slice(0, 7).replace("-", "");
export const dias = (a: string, b: string) => Math.round((+new Date(b + "T00:00:00Z") - +new Date(a + "T00:00:00Z")) / 86400000);
export const money = (v: number) => "$" + Math.round(v).toLocaleString("es-CO");
export const sq = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";


export const almacen = (context: Context) => getStore(context.deploy?.context === "production" ? "agente" : "agente-pruebas");
export const almacenIA = (context: Context) => getStore(context.deploy?.context === "production" ? "asistente-limites" : "asistente-limites-pruebas");

export async function leerPerfil(context: Context): Promise<Perfil> {
  try {
    const p = (await almacen(context).get("perfil", { type: "json" })) as Perfil | null;
    return p ? { ...PERFIL_BASE, ...p } : PERFIL_BASE;
  } catch {
    return PERFIL_BASE;
  }
}
