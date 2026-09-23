// Genera el Módulo 1 del Kit de Transición a Ganadería Regenerativa
// (Diagnóstico Predial) como documento Word editable.
// Uso: npm install docx && node modulo1.js
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, PageBreak,
} = require("docx");

const GREEN = "2E5D34";
const LIGHT = "EAF2EA";
const GRAY = "F2F2F2";

const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 240 } } },
        },
      ],
    },
  ],
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 160 },
    children: [new TextRun({ text, bold: true, color: GREEN })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, color: GREEN })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}
function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text })],
  });
}
function note(text) {
  return new Paragraph({
    spacing: { before: 120, after: 160 },
    shading: { type: ShadingType.CLEAR, fill: LIGHT },
    children: [new TextRun({ text, italics: true })],
  });
}

// Tabla de 2 columnas para diligenciar: [etiqueta, espacio en blanco]
function fillTable(rows, w1 = 4300, w2 = 5060) {
  return new Table({
    columnWidths: [w1, w2],
    width: { size: w1 + w2, type: WidthType.DXA },
    rows: rows.map(([label, val], i) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: w1, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: i === -1 ? LIGHT : GRAY },
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
          }),
          new TableCell({
            width: { size: w2, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: val || "" })] })],
          }),
        ],
      })
    ),
  });
}

// Tabla de varias columnas con encabezado
function gridTable(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    children: headers.map((hText, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LIGHT },
        children: [new Paragraph({ children: [new TextRun({ text: hText, bold: true })] })],
      })
    ),
  });
  const bodyRows = rows.map(r =>
    new TableRow({
      children: r.map((cellText, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cellText })] })],
        })
      ),
    })
  );
  return new Table({
    columnWidths: widths,
    width: { size: total, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows],
  });
}

const blankRows = (labels) => labels.map(l => [l, ""]);
const emptyGrid = (cols, n) => Array.from({ length: n }, () => Array(cols).fill(""));

const children = [];

// ===== Portada =====
children.push(
  new Paragraph({ spacing: { before: 2400 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "KIT DE TRANSICIÓN A GANADERÍA REGENERATIVA", bold: true, size: 56, color: GREEN })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300 },
    children: [new TextRun({ text: "MÓDULO 1", bold: true, size: 40 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120 },
    children: [new TextRun({ text: "Diagnóstico Predial: conozca su punto de partida", size: 32 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
    children: [new TextRun({ text: "Formato editable de trabajo — versión para revisión técnica", italics: true, size: 22 })],
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// ===== Introducción =====
children.push(
  h1("Antes de empezar: por qué diagnosticar"),
  p("Ningún plan de transición sirve si no sabe con exactitud de dónde parte. Este módulo le permite levantar, en una o dos jornadas de campo, la línea base de su predio: suelos, aguas, potreros, forraje, animales y costos. Con esa información, los módulos siguientes (diseño de pastoreo rotacional, sistema silvopastoril y plan de transición) se construyen sobre datos reales de SU finca, no sobre promedios de otros."),
  p("Cómo usar este formato:", { bold: true }),
  bullet("Imprima este documento o llévelo en el celular/tableta al recorrido de campo."),
  bullet("Complete cada sección en el orden propuesto. Si no tiene un dato, márquelo como \"pendiente\" — no lo invente."),
  bullet("Al final encontrará una tabla de puntuación que convierte sus respuestas en un perfil de partida y le indica por dónde empezar la transición."),
  note("Tiempo estimado: 4 a 6 horas de recorrido de campo + 1 hora de escritorio. Materiales: pala, frasco con agua, metro, este formato y, si tiene, análisis de suelos previos.")
);

// ===== Sección 1 =====
children.push(
  h1("Sección 1. Información general del predio"),
  fillTable(blankRows([
    "Nombre del predio",
    "Municipio / Vereda",
    "Departamento",
    "Área total (ha)",
    "Área en pastos (ha)",
    "Área en bosque o rastrojo (ha)",
    "Área en otros usos (cultivos, infraestructura) (ha)",
    "Precipitación anual aproximada (mm) y meses secos",
    "Fuente principal de agua",
    "Tipo de ganadería actual (cría / levante / ceba / doble propósito / lechería)",
    "Número total de animales (por categoría)",
    "Años operando el predio",
  ]))
);

// ===== Sección 2: Suelos =====
children.push(
  h1("Sección 2. Suelos"),
  p("Haga entre 3 y 5 calicatas (huecos de 30–40 cm) en puntos representativos: el mejor potrero, el peor potrero y uno intermedio. En cada punto observe y registre:"),
  gridTable(
    ["Indicador", "Punto 1", "Punto 2", "Punto 3", "Punto 4"],
    [
      ["Color del suelo (oscuro / pardo / claro / rojizo)", "", "", "", ""],
      ["Profundidad de capa oscura (cm)", "", "", "", ""],
      ["Compactación (¿entra la pala fácil?) Sí/No", "", "", "", ""],
      ["Presencia de lombrices u otra vida (alta/media/baja/nula)", "", "", "", ""],
      ["Raíces: ¿hasta qué profundidad llegan? (cm)", "", "", "", ""],
      ["Encharcamiento en lluvias (Sí/No)", "", "", "", ""],
      ["Erosión visible (cárcavas, terracetas, suelo desnudo) (Sí/No)", "", "", "", ""],
      ["Prueba de infiltración: minutos en absorber 1 litro de agua", "", "", "", ""],
    ],
    [3600, 1440, 1440, 1440, 1440]
  ),
  note("Si tiene análisis de laboratorio (pH, materia orgánica, fósforo), anexe los resultados a este módulo. Si no los tiene, no es impedimento para arrancar: el diagnóstico visual es suficiente para la fase inicial, y el análisis puede hacerse durante el primer año."),
  p("Observaciones adicionales sobre suelos:"),
  fillTable([["Notas", ""]], 1500, 7860)
);

// ===== Sección 3: Agua =====
children.push(
  h1("Sección 3. Agua"),
  fillTable(blankRows([
    "Fuentes de agua en el predio (ríos, caños, jagüeyes, pozos, acueducto)",
    "¿El agua alcanza todo el año? ¿En qué meses escasea?",
    "¿Cómo beben los animales? (directo a la fuente / bebederos / mixto)",
    "Distancia máxima que camina un animal hasta el agua (m)",
    "Estado de las fuentes (protegidas con cerca / con árboles / desprotegidas)",
    "¿Hay conflictos de agua con vecinos o autoridad ambiental?",
  ]))
);

// ===== Sección 4: Potreros =====
children.push(
  h1("Sección 4. Potreros y división actual"),
  p("Registre cada potrero. Si son muchos, agrupe los similares. Esta tabla es la base del diseño rotacional del Módulo 2."),
  gridTable(
    ["Potrero (nombre o No.)", "Área (ha)", "Pasto dominante", "Estado (bueno/regular/degradado)", "¿Tiene agua?", "¿Tiene sombra?"],
    emptyGrid(6, 10),
    [1700, 1100, 1800, 1900, 1400, 1460]
  ),
  fillTable(blankRows([
    "Número total de potreros",
    "Tipo de cercas (alambre de púas / eléctrica / viva / mixta)",
    "¿Cuánto tiempo permanecen los animales en un mismo potrero?",
    "¿Cuánto descansa cada potrero antes de volver a ocuparlo?",
  ]))
);

// ===== Sección 5: Forraje =====
children.push(
  h1("Sección 5. Forraje y cobertura"),
  fillTable(blankRows([
    "Especies de pasto presentes (nativas e introducidas)",
    "Porcentaje aproximado de suelo desnudo en los potreros (%)",
    "Presencia de leguminosas o arvenses aprovechables (cuáles)",
    "¿Qué hace en época seca? (heno, ensilaje, caña, suplemento, nada)",
    "¿Fertiliza los potreros? ¿Con qué y cuánto al año?",
    "¿Usa herbicidas o quemas? ¿Con qué frecuencia?",
  ]))
);

// ===== Sección 6: Árboles =====
children.push(
  h1("Sección 6. Componente arbóreo"),
  fillTable(blankRows([
    "¿Hay árboles dispersos en los potreros? ¿Qué especies y cuántos por hectárea (aprox.)?",
    "¿Hay cercas vivas? ¿De qué especies?",
    "¿Los animales tienen sombra suficiente en las horas de más calor? (Sí/No/Parcial)",
    "Fragmentos de bosque o morichales: área aproximada y estado",
    "¿Hay regeneración natural (arbolitos jóvenes) en los potreros? ¿La respeta o la elimina?",
  ]))
);

// ===== Sección 7: Animales =====
children.push(
  h1("Sección 7. Inventario animal y productividad"),
  gridTable(
    ["Categoría", "Número", "Peso promedio (kg)", "Observaciones"],
    [
      ["Vacas en producción / cría", "", "", ""],
      ["Vacas horras / secas", "", "", ""],
      ["Novillas de levante", "", "", ""],
      ["Machos de levante / ceba", "", "", ""],
      ["Terneros(as)", "", "", ""],
      ["Toros / reproductores", "", "", ""],
      ["Otros (equinos, búfalos, ovinos)", "", "", ""],
    ],
    [2700, 1300, 2000, 3360]
  ),
  fillTable(blankRows([
    "Carga actual estimada (animales o UGG por hectárea)",
    "Ganancia de peso estimada en ceba (g/día) o litros de leche/vaca/día",
    "Natalidad aproximada (%)",
    "Mortalidad del último año (%) y causas principales",
    "Principales problemas sanitarios",
  ]))
);

// ===== Sección 8: Costos =====
children.push(
  h1("Sección 8. Costos actuales (línea base económica)"),
  p("No necesita contabilidad perfecta: use los valores del último año o su mejor estimación. Esta línea base es la que le permitirá medir, en el Módulo 5, si la transición le está dando plata."),
  gridTable(
    ["Rubro", "Valor anual aproximado (COP)", "Notas"],
    [
      ["Fertilizantes y enmiendas", "", ""],
      ["Herbicidas e insecticidas", "", ""],
      ["Suplementos y sales", "", ""],
      ["Medicamentos y vacunas", "", ""],
      ["Mano de obra", "", ""],
      ["Mantenimiento de cercas e infraestructura", "", ""],
      ["Arriendos (si aplica)", "", ""],
      ["Otros", "", ""],
      ["TOTAL COSTOS", "", ""],
      ["Ingresos anuales por venta de animales / leche", "", ""],
    ],
    [3400, 2800, 3160]
  )
);

// ===== Sección 9: Puntuación =====
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h1("Sección 9. Puntaje de partida: ¿dónde está su finca?"),
  p("Asigne un puntaje de 1 a 3 a cada criterio según lo que registró en las secciones anteriores. Sea honesto: el puntaje no es una calificación, es una brújula."),
  gridTable(
    ["Criterio", "1 punto", "2 puntos", "3 puntos", "Su puntaje"],
    [
      ["Vida y estructura del suelo", "Compactado, sin lombrices, suelo desnudo frecuente", "Intermedio", "Suelto, oscuro, con vida visible", ""],
      ["Agua", "Escasea varios meses y los animales beben directo a fuentes desprotegidas", "Alcanza pero sin infraestructura", "Disponible todo el año con bebederos o fuentes protegidas", ""],
      ["División de potreros", "1 a 4 potreros, ocupación continua", "5 a 10 potreros, rotación irregular", "Más de 10 potreros con descansos definidos", ""],
      ["Forraje", "Una sola especie, mucho suelo desnudo, crisis en sequía", "Intermedio", "Diversidad de especies y reserva para época seca", ""],
      ["Árboles y sombra", "Potreros pelados, sin sombra", "Árboles dispersos insuficientes", "Sombra adecuada, cercas vivas o silvopastoril incipiente", ""],
      ["Dependencia de insumos", "Alta: fertilizante y herbicida todos los años", "Media", "Baja: casi no compra insumos de síntesis", ""],
      ["Información productiva", "No lleva registros", "Registros parciales", "Registros de pesos, natalidad y costos", ""],
    ],
    [1900, 2400, 1900, 2200, 960]
  ),
  h2("Interpretación"),
  bullet("7 a 11 puntos — Punto de partida convencional. La prioridad del Módulo 4 será división de potreros y protección de aguas: son las palancas más rápidas y baratas."),
  bullet("12 a 16 puntos — Transición iniciada. La prioridad será formalizar la rotación (Módulo 2) e introducir el componente arbóreo (Módulo 3)."),
  bullet("17 a 21 puntos — Base regenerativa. La prioridad será optimizar carga animal, medir resultados y capturar valor adicional (diferenciación, certificaciones, pagos por servicios ambientales)."),
  note("Guarde este diagnóstico con fecha. Repítalo cada 12 meses con las mismas tablas: la comparación año contra año es la evidencia real de su transición — y la que le servirá ante bancos, certificadoras o programas de incentivos.")
);

// ===== Cierre =====
children.push(
  h1("Qué sigue"),
  p("Con este diagnóstico completo, pase al Módulo 2 (Diseño de pastoreo rotacional). Allí usará directamente la tabla de potreros de la Sección 4 y el inventario animal de la Sección 7 para calcular su carga y sus tiempos de descanso."),
);

const doc = new Document({
  numbering,
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
  },
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1200, left: 1440, right: 1440 } } },
      children,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  require("fs").writeFileSync("Modulo-1-Diagnostico-Predial.docx", buf);
  console.log("OK: Modulo-1-Diagnostico-Predial.docx");
});
