import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { HistoriaClinica } from '@/types';

type AudWithHCs = { historias_clinicas: HistoriaClinica[] };

/* ── Constants ── */

const TRIMESTRE_ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto'] as const;

const QUARTER_MONTH_RANGES = [
  'ENERO – MARZO',
  'ABRIL – JUNIO',
  'JULIO – SEPTIEMBRE',
  'OCTUBRE – DICIEMBRE',
] as const;

/* ── Helpers ── */

function numeroEnLetras(n: number): string {
  if (n === 0) return 'cero';
  if (n < 0) return `menos ${numeroEnLetras(-n)}`;

  const unidades = [
    '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  ];
  const veintis = [
    'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
  ];
  const decenas = [
    '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta',
    'sesenta', 'setenta', 'ochenta', 'noventa',
  ];
  const centenas = [
    '', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
  ];

  if (n <= 19) return unidades[n];
  if (n <= 29) return veintis[n - 20];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? decenas[d] : `${decenas[d]} y ${unidades[u]}`;
  }
  if (n === 100) return 'cien';
  if (n < 200) return `ciento ${numeroEnLetras(n - 100)}`;
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    return r === 0 ? centenas[c] : `${centenas[c]} ${numeroEnLetras(r)}`;
  }
  // 1000+: fallback a número
  return String(n);
}

function lastDayOfQuarter(q: number, year: number): string {
  const lastMonth = q * 3; // 3, 6, 9, 12
  const last = new Date(year, lastMonth, 0); // día 0 = último día de lastMonth
  const d = String(last.getDate()).padStart(2, '0');
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const y = String(last.getFullYear()).slice(2);
  return `${d}/${m}/${y}`;
}

/* ── Docx helpers ── */

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function tableCell(
  text: string,
  opts: { width?: number; bold?: boolean; align?: string; size?: number; color?: string } = {}
): TableCell {
  const { width, bold = false, align = AlignmentType.LEFT, size = 22, color } = opts;
  return new TableCell({
    ...(width !== undefined ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: align as (typeof AlignmentType)[keyof typeof AlignmentType],
        children: [new TextRun({ text, bold, size, ...(color ? { color } : {}) })],
      }),
    ],
  });
}

function spacer(before = 200): Paragraph {
  return new Paragraph({ spacing: { before, after: 0 }, children: [] });
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT FUNCTION
═══════════════════════════════════════════════════════════════ */

export async function exportarResumenTrimestral(
  q: number,       // 1–4
  anio: number,
  auditorias: AudWithHCs[]
): Promise<void> {
  const ordinal = TRIMESTRE_ORDINAL[q - 1];
  const monthRange = QUARTER_MONTH_RANGES[q - 1];
  const fechaFin = lastDayOfQuarter(q, anio);

  // Estadísticas
  const hcs = auditorias.flatMap(a => a.historias_clinicas);
  const totalHCs = hcs.length;
  const totalDesvios = hcs.filter(h => h.correccion !== '-').length;
  const pct = totalHCs > 0 ? (totalDesvios / totalHCs * 100).toFixed(1) : '0.0';
  const desviosLetras = numeroEnLetras(totalDesvios);

  // Párrafo narrativo
  const narrativo =
    `Se evalúan las Historias Clínicas del personal Médico al azar (veinte por médico) durante ` +
    `el ${ordinal} trimestre del corriente año, en el cual se detectan ${totalDesvios} ` +
    `(${desviosLetras}) desvíos correspondientes a la falta de datos en las mismas, ` +
    `representando un ${pct}% de las HC controladas. Realizando una comparación con los ` +
    `trimestres anteriores, los mismos _____________________________________. ` +
    `Estos porcentajes evidencian la eficiencia del control mensual y las correcciones realizadas.`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: [

          /* ── [1] Encabezado: título | UDEM ── */
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  tableCell('AUDITORIA HISTORIAS CLINICAS', {
                    width: 75, bold: true,
                    align: AlignmentType.CENTER, size: 26,
                  }),
                  tableCell('UDEM', {
                    width: 25, bold: true,
                    align: AlignmentType.CENTER, size: 22,
                  }),
                ],
              }),
            ],
          }),

          spacer(160),

          /* ── [2] Info: Fecha / Sectores / Base ── */
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  tableCell('Fecha:', { width: 28, bold: true }),
                  tableCell(fechaFin, { width: 72 }),
                ],
              }),
              new TableRow({
                children: [
                  tableCell('Sectores involucrados:', { bold: true }),
                  tableCell('Operativa'),
                ],
              }),
              new TableRow({
                children: [
                  tableCell('Base:', { bold: true }),
                  tableCell('BASE RIO GALLEGOS'),
                ],
              }),
            ],
          }),

          spacer(320),

          /* ── [3] Subtítulo centrado en gris ── */
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 320 },
            children: [
              new TextRun({
                text: 'RESUMEN AUDITORÍAS TRIMESTRAL',
                bold: true,
                size: 28,
                color: '666666',
              }),
            ],
          }),

          /* ── [4] Párrafo 1: identificación del período ── */
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 0, after: 240 },
            children: [
              new TextRun({
                text: `Auditorías ${ordinal} trimestre año ${anio} (${monthRange})`,
                bold: true,
                size: 24,
              }),
            ],
          }),

          /* ── [5] Párrafo 2: narrativo justificado ── */
          new Paragraph({
            alignment: AlignmentType.BOTH,
            spacing: { before: 0, after: 800 },
            children: [
              new TextRun({ text: narrativo, size: 22 }),
            ],
          }),

          /* ── [6] Sección de firma ── */
          new Paragraph({
            spacing: { before: 0, after: 80 },
            children: [
              new TextRun({ text: 'Polanco Varela Guillermo', bold: true, size: 22 }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 80 },
            children: [
              new TextRun({ text: 'Médico - MPP 4056', size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'FIRMA MÉDICO AUDITOR', size: 22 }),
            ],
          }),
        ],
      },
    ],
  });

  /* ── Descargar ── */
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Resumen_Trimestral_${ordinal.toUpperCase()}_${anio}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
