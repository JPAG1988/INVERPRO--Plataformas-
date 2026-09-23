import { useState, useMemo } from "react";

const C = {
  bg: "#F5F7F2",
  ink: "#1F2A24",
  green: "#24513B",
  greenSoft: "#E4EFE7",
  gold: "#C89B3C",
  soil: "#6B4A2F",
  soilSoft: "#EFE6DC",
  line: "#D8DFD8",
};

const CRITERIA = [
  {
    id: "suelo",
    label: "Suelo",
    field: "Cave un hueco de 30 cm en un potrero típico. ¿Qué encuentra?",
    options: [
      { pts: 1, text: "Duro de cavar, suelo claro, sin lombrices, zonas peladas" },
      { pts: 2, text: "Regular: algo de vida, capa oscura delgada" },
      { pts: 3, text: "Suelto, oscuro, con lombrices y raíces profundas" },
    ],
  },
  {
    id: "agua",
    label: "Agua",
    field: "¿Cómo está el agua para los animales durante el año?",
    options: [
      { pts: 1, text: "Escasea varios meses; beben directo a fuentes sin proteger" },
      { pts: 2, text: "Alcanza casi todo el año, pero sin bebederos ni protección" },
      { pts: 3, text: "Disponible todo el año, con bebederos o fuentes protegidas" },
    ],
  },
  {
    id: "potreros",
    label: "Potreros",
    field: "¿Cómo maneja los potreros hoy?",
    options: [
      { pts: 1, text: "1 a 4 potreros; el ganado permanece semanas en el mismo" },
      { pts: 2, text: "5 a 10 potreros; roto pero sin descansos definidos" },
      { pts: 3, text: "Más de 10 potreros con días de descanso planificados" },
    ],
  },
  {
    id: "forraje",
    label: "Forraje",
    field: "¿Cómo está el pasto y la comida en época seca?",
    options: [
      { pts: 1, text: "Una sola especie, mucho suelo desnudo, crisis en verano" },
      { pts: 2, text: "Variedad regular; el verano se sufre pero se pasa" },
      { pts: 3, text: "Varias especies y reserva (heno, ensilaje, caña) para el verano" },
    ],
  },
  {
    id: "arboles",
    label: "Árboles y sombra",
    field: "¿Tienen sombra los animales en las horas de calor?",
    options: [
      { pts: 1, text: "Potreros pelados, casi sin árboles" },
      { pts: 2, text: "Algunos árboles dispersos, sombra insuficiente" },
      { pts: 3, text: "Sombra adecuada: cercas vivas, árboles o silvopastoril" },
    ],
  },
  {
    id: "insumos",
    label: "Insumos",
    field: "¿Qué tanto depende de fertilizantes y herbicidas comprados?",
    options: [
      { pts: 1, text: "Todos los años compro fertilizante y herbicida" },
      { pts: 2, text: "Aplico de vez en cuando, según el bolsillo" },
      { pts: 3, text: "Casi no compro insumos de síntesis" },
    ],
  },
  {
    id: "registros",
    label: "Registros",
    field: "¿Lleva registros de su ganadería?",
    options: [
      { pts: 1, text: "No llevo registros; todo de memoria" },
      { pts: 2, text: "Anoto algunas cosas (ventas, vacunas)" },
      { pts: 3, text: "Registro pesos, natalidad y costos" },
    ],
  },
];

const PRIORITY_ACTIONS = {
  suelo: "Reducir sobrepastoreo y dejar descansar los potreros más degradados",
  agua: "Proteger las fuentes de agua e instalar bebederos",
  potreros: "Dividir potreros (cerca eléctrica) y arrancar rotación con descansos",
  forraje: "Diversificar especies forrajeras y planear la reserva de verano",
  arboles: "Sembrar cercas vivas y respetar la regeneración natural en potreros",
  insumos: "Sustituir insumos de síntesis gradualmente con manejo del pastoreo",
  registros: "Arrancar un registro simple: pesos, nacimientos y gastos del mes",
};

function bracket(total) {
  if (total <= 11)
    return {
      name: "Punto de partida convencional",
      msg: "Su finca está donde arranca la mayoría. Las palancas más rápidas y baratas son la división de potreros y la protección del agua. Con eso solo, en 12 meses se ve el cambio.",
      pct: 0.25,
    };
  if (total <= 16)
    return {
      name: "Transición iniciada",
      msg: "Ya tiene bases. El siguiente paso es formalizar la rotación con días de descanso definidos e ir metiendo el componente arbóreo.",
      pct: 0.6,
    };
  return {
    name: "Base regenerativa",
    msg: "Su finca ya trabaja con la naturaleza. La prioridad ahora es afinar la carga animal, medir resultados y capturar valor: diferenciación, certificaciones o pagos por servicios ambientales.",
    pct: 0.92,
  };
}

// Potrero progress: little paddocks that green up as sections complete
function Potreros({ done, total, current }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-3 flex-1 rounded-sm transition-all duration-500"
          style={{
            backgroundColor: i < done ? C.green : i === current ? C.gold : C.soilSoft,
            border: `1px solid ${i < done ? C.green : C.line}`,
          }}
        />
      ))}
    </div>
  );
}

export default function DiagnosticoPredial() {
  const [step, setStep] = useState(-1); // -1 datos finca, 0..6 criterios, 7 resultado
  const [finca, setFinca] = useState({ nombre: "", municipio: "", area: "", animales: "" });
  const [answers, setAnswers] = useState({});
  const [copied, setCopied] = useState(false);

  const total = useMemo(
    () => CRITERIA.reduce((s, c) => s + (answers[c.id] || 0), 0),
    [answers]
  );
  const answeredAll = CRITERIA.every((c) => answers[c.id]);
  const res = bracket(total);
  const weak = CRITERIA.filter((c) => answers[c.id] === 1);

  const summary = () => {
    const lines = [
      "DIAGNÓSTICO PREDIAL — Ganadería Regenerativa",
      finca.nombre && `Finca: ${finca.nombre}${finca.municipio ? " — " + finca.municipio : ""}`,
      finca.area && `Área: ${finca.area} ha`,
      finca.animales && `Animales: ${finca.animales}`,
      `Fecha: ${new Date().toLocaleDateString("es-CO")}`,
      "",
      ...CRITERIA.map((c) => `${c.label}: ${answers[c.id]}/3`),
      "",
      `PUNTAJE TOTAL: ${total}/21 — ${res.name}`,
      "",
      "Por dónde empezar:",
      ...(weak.length
        ? weak.map((c) => `• ${PRIORITY_ACTIONS[c.id]}`)
        : ["• Optimizar carga animal y medir resultados año a año"]),
    ].filter(Boolean);
    return lines.join("\n");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      /* clipboard bloqueado: el resumen queda visible en pantalla */
    }
  };

  const inputCls =
    "w-full rounded-lg border px-4 py-3 text-base outline-none focus:ring-2";

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,500..800&display=swap');
        .display { font-family: 'Archivo', system-ui, sans-serif; }
        body { font-family: system-ui, -apple-system, sans-serif; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <div className="mx-auto max-w-xl px-5 py-8">
        {/* Header */}
        <div className="mb-6">
          <p
            className="display text-xs font-semibold tracking-widest uppercase"
            style={{ color: C.gold }}
          >
            Kit de Transición · Módulo 1
          </p>
          <h1
            className="display mt-1 text-3xl font-bold leading-tight"
            style={{ color: C.green }}
          >
            Diagnóstico de su finca
          </h1>
        </div>

        {/* Potrero progress */}
        {step >= 0 && step < CRITERIA.length && (
          <div className="mb-6">
            <Potreros done={step} total={CRITERIA.length} current={step} />
            <p className="mt-2 text-sm" style={{ color: C.soil }}>
              Sección {step + 1} de {CRITERIA.length} — cada potrero se pone verde al completarla
            </p>
          </div>
        )}

        {/* Paso -1: datos de la finca */}
        {step === -1 && (
          <div className="space-y-4">
            <p className="text-base leading-relaxed">
              Responda 7 preguntas sobre su finca tal como está hoy. Al final
              recibe su puntaje de partida y las acciones por donde empezar la
              transición. Sea honesto: esto no es un examen, es una brújula.
            </p>
            <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: C.line, backgroundColor: "white" }}>
              <label className="block">
                <span className="text-sm font-semibold">Nombre de la finca (opcional)</span>
                <input
                  className={inputCls}
                  style={{ borderColor: C.line }}
                  value={finca.nombre}
                  onChange={(e) => setFinca({ ...finca, nombre: e.target.value })}
                  placeholder="La Esperanza"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Municipio (opcional)</span>
                <input
                  className={inputCls}
                  style={{ borderColor: C.line }}
                  value={finca.municipio}
                  onChange={(e) => setFinca({ ...finca, municipio: e.target.value })}
                  placeholder="Yopal, Casanare"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-semibold">Área (ha)</span>
                  <input
                    className={inputCls}
                    style={{ borderColor: C.line }}
                    inputMode="numeric"
                    value={finca.area}
                    onChange={(e) => setFinca({ ...finca, area: e.target.value })}
                    placeholder="120"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">No. de animales</span>
                  <input
                    className={inputCls}
                    style={{ borderColor: C.line }}
                    inputMode="numeric"
                    value={finca.animales}
                    onChange={(e) => setFinca({ ...finca, animales: e.target.value })}
                    placeholder="80"
                  />
                </label>
              </div>
            </div>
            <button
              onClick={() => setStep(0)}
              className="display w-full rounded-xl py-4 text-lg font-bold text-white transition-transform active:scale-95"
              style={{ backgroundColor: C.green }}
            >
              Empezar diagnóstico
            </button>
          </div>
        )}

        {/* Pasos 0..6: criterios */}
        {step >= 0 && step < CRITERIA.length && (
          <div className="space-y-4">
            <div>
              <p
                className="display text-sm font-bold uppercase tracking-wide"
                style={{ color: C.soil }}
              >
                {CRITERIA[step].label}
              </p>
              <h2 className="mt-1 text-xl font-semibold leading-snug">
                {CRITERIA[step].field}
              </h2>
            </div>
            <div className="space-y-3">
              {CRITERIA[step].options.map((o) => {
                const sel = answers[CRITERIA[step].id] === o.pts;
                return (
                  <button
                    key={o.pts}
                    onClick={() => {
                      setAnswers({ ...answers, [CRITERIA[step].id]: o.pts });
                      setTimeout(
                        () => setStep((s) => Math.min(s + 1, CRITERIA.length)),
                        250
                      );
                    }}
                    className="w-full rounded-xl border-2 px-4 py-4 text-left text-base leading-snug transition-all active:scale-95"
                    style={{
                      borderColor: sel ? C.green : C.line,
                      backgroundColor: sel ? C.greenSoft : "white",
                    }}
                  >
                    {o.text}
                  </button>
                );
              })}
            </div>
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="text-sm underline"
                style={{ color: C.soil }}
              >
                ← Volver a la pregunta anterior
              </button>
            )}
          </div>
        )}

        {/* Resultado */}
        {step >= CRITERIA.length && answeredAll && (
          <div className="space-y-5">
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: C.line, backgroundColor: "white" }}
            >
              <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: C.soil }}>
                Su puntaje de partida
              </p>
              <p className="display mt-1 text-5xl font-bold" style={{ color: C.green }}>
                {total}
                <span className="text-2xl font-semibold" style={{ color: C.soil }}>
                  /21
                </span>
              </p>

              {/* Barra pastura: de suelo a verde */}
              <div
                className="mt-4 h-5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: C.soilSoft }}
                role="img"
                aria-label={`Puntaje ${total} de 21`}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.round(((total - 7) / 14) * 100)}%`,
                    background: `linear-gradient(90deg, ${C.soil}, ${C.gold}, ${C.green})`,
                  }}
                />
              </div>

              <p className="display mt-4 text-xl font-bold" style={{ color: C.green }}>
                {res.name}
              </p>
              <p className="mt-2 text-base leading-relaxed">{res.msg}</p>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: C.line, backgroundColor: "white" }}
            >
              <p className="display text-base font-bold" style={{ color: C.green }}>
                Por dónde empezar
              </p>
              <ul className="mt-3 space-y-2">
                {(weak.length ? weak : []).map((c) => (
                  <li key={c.id} className="flex gap-2 text-base leading-snug">
                    <span style={{ color: C.gold }}>●</span>
                    <span>{PRIORITY_ACTIONS[c.id]}</span>
                  </li>
                ))}
                {!weak.length && (
                  <li className="flex gap-2 text-base leading-snug">
                    <span style={{ color: C.gold }}>●</span>
                    <span>
                      Optimizar carga animal, medir resultados año a año y
                      explorar certificaciones o pagos por servicios ambientales
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <button
              onClick={copy}
              className="display w-full rounded-xl py-4 text-lg font-bold text-white transition-transform active:scale-95"
              style={{ backgroundColor: copied ? C.gold : C.green }}
            >
              {copied ? "Copiado — péguelo en WhatsApp o guárdelo" : "Copiar mi resumen"}
            </button>

            <details
              className="rounded-xl border p-4 text-sm"
              style={{ borderColor: C.line, backgroundColor: "white" }}
            >
              <summary className="cursor-pointer font-semibold">
                Ver el resumen completo
              </summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {summary()}
              </pre>
            </details>

            <button
              onClick={() => {
                setAnswers({});
                setStep(-1);
                setCopied(false);
              }}
              className="w-full text-sm underline"
              style={{ color: C.soil }}
            >
              Hacer el diagnóstico de nuevo
            </button>

            <p className="pt-2 text-xs leading-relaxed" style={{ color: C.soil }}>
              Repita este diagnóstico cada 12 meses: la comparación año contra
              año es la evidencia real de su transición. Los resultados no
              quedan guardados en la herramienta — copie su resumen antes de salir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
