import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { Medico, HistoriaClinica } from '@/types';
import { MESES_ES_UPPER, AUDITOR_APELLIDO, AUDITOR_NOMBRE } from '@/lib/constants';

/* ── Helpers ── */

const BORDER_SINGLE = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const ALL_BORDERS = {
  top: BORDER_SINGLE,
  bottom: BORDER_SINGLE,
  left: BORDER_SINGLE,
  right: BORDER_SINGLE,
};

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function lastDayOfMonth(mesStr: string): string {
  const [yearStr, monthStr] = mesStr.split('-');
  const last = new Date(parseInt(yearStr), parseInt(monthStr), 0);
  const d = String(last.getDate()).padStart(2, '0');
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const y = String(last.getFullYear()).slice(2);
  return `${d}/${m}/${y}`;
}

function txt(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, size: 20, ...opts });
}

function cell(
  text: string,
  opts: {
    width?: number;
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
  } = {}
): TableCell {
  const { width, bold = false, align = AlignmentType.LEFT, size = 20 } = opts;
  return new TableCell({
    ...(width !== undefined ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, bold, size })],
      }),
    ],
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [txt(text, { bold: true, size: 22 })],
  });
}

function emptyRow(cols: number): TableRow {
  return new TableRow({
    height: { value: 400, rule: 'atLeast' as const },
    children: Array.from({ length: cols }, () =>
      new TableCell({
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
      })
    ),
  });
}

/* ══════════════════════════════════════════════════════════════
   EXPORT FUNCTION
══════════════════════════════════════════════════════════════ */

export async function exportarMinutaWord(
  medico: Medico,
  mes: string, // 'YYYY-MM-01'
  historias_clinicas: HistoriaClinica[]
): Promise<void> {
  const [anio, mesNum] = mes.split('-');
  const mesUpper = MESES_ES_UPPER[parseInt(mesNum) - 1];
  const apellidoUpper = medico.apellido.toUpperCase();
  const nombreMedico = `${apellidoUpper}, ${medico.nombre.toUpperCase()}`;
  const nombreAuditor = `${AUDITOR_APELLIDO}, ${AUDITOR_NOMBRE}`;
  const fechaFin = lastDayOfMonth(mes);

  // Ordenar HCs por fecha
  const sortedHCs = [...historias_clinicas].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  // Calcular desvíos
  const desvioMap = new Map<string, number>();
  sortedHCs.forEach(hc => {
    if (hc.correccion !== '-') {
      desvioMap.set(hc.correccion, (desvioMap.get(hc.correccion) ?? 0) + 1);
    }
  });
  const totalDesvios = [...desvioMap.values()].reduce((s, v) => s + v, 0);

  /* ── Footer común (Página X de 2) ── */
  const commonFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Página ', size: 18 }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
          new TextRun({ text: ' de 2', size: 18 }),
        ],
      }),
    ],
  });

  /* ══════════════ PÁGINA 1 ══════════════ */

  // [1] Tabla encabezado
  const tablaEncabezado = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('Rev. 01', { width: 15, bold: true, align: AlignmentType.CENTER }),
          cell('RESUMEN DE REUNION', { width: 70, bold: true, align: AlignmentType.CENTER, size: 24 }),
          cell('UDEM', { width: 15, bold: true, align: AlignmentType.CENTER }),
        ],
      }),
    ],
  });

  // [2] Tabla info
  const tablaInfo = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('Fecha:', { width: 25, bold: true }),
          cell(fechaFin, { width: 75 }),
        ],
      }),
      new TableRow({
        children: [
          cell('Sectores involucrados:', { bold: true }),
          cell('Operativa'),
        ],
      }),
      new TableRow({
        children: [
          cell('Base:', { bold: true }),
          cell('Base RG'),
        ],
      }),
    ],
  });

  // [3] Tabla PARTICIPANTES
  const tablaParticipantes = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('Nombre y Apellido', { width: 50, bold: true, align: AlignmentType.CENTER }),
          cell('Sector', { width: 25, bold: true, align: AlignmentType.CENTER }),
          cell('Firma', { width: 25, bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          cell(nombreMedico),
          cell('Médico'),
          cell(''),
        ],
      }),
      new TableRow({
        children: [
          cell(nombreAuditor),
          cell('Médico auditor'),
          cell(''),
        ],
      }),
      ...([0, 1, 2] as const).map(() => emptyRow(3)),
    ],
  });

  // [4] Tabla TEMAS / ACTIVIDADES DESARROLLADAS
  const tablaTemas = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('1', { width: 10, bold: true, align: AlignmentType.CENTER }),
          cell(`Auditoría HC – ${mesUpper} ${anio}`, { width: 90 }),
        ],
      }),
      new TableRow({
        height: { value: 400, rule: 'atLeast' as const },
        children: [
          cell('2', { bold: true, align: AlignmentType.CENTER }),
          new TableCell({
            borders: ALL_BORDERS,
            children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
          }),
        ],
      }),
    ],
  });

  // [5] Tabla ACTIVIDADES PARA DESARROLLAR
  const tablaActividades = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('Control', { width: 12, bold: true, align: AlignmentType.CENTER }),
          cell('Responsable', { width: 23, bold: true, align: AlignmentType.CENTER }),
          cell('Actividad', { width: 50, bold: true, align: AlignmentType.CENTER }),
          cell('Plazo', { width: 15, bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          cell('SI', { align: AlignmentType.CENTER }),
          cell(`DR. ${apellidoUpper}`),
          cell('Completar las HC con todos los datos, firma del paciente y firma y sello del médico responsable.'),
          cell('Inmediato', { align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          cell('SI', { align: AlignmentType.CENTER }),
          cell(`DR. ${apellidoUpper}`),
          cell('Completar las hojas de traslado con los datos solicitados en la misma.'),
          cell('Inmediato', { align: AlignmentType.CENTER }),
        ],
      }),
    ],
  });

  // [6] OBSERVACIONES
  const observacionesParagraphs: Paragraph[] = [];
  if (totalDesvios === 0) {
    observacionesParagraphs.push(
      new Paragraph({
        children: [txt(`No se observan desvíos en el período ${mesUpper} ${anio}`)],
      })
    );
  } else {
    observacionesParagraphs.push(
      new Paragraph({
        children: [
          txt(`Se detectan ${totalDesvios} desvío${totalDesvios !== 1 ? 's' : ''} en el período ${mesUpper} ${anio}:`),
        ],
      })
    );
    [...desvioMap.entries()].forEach(([corr, count]) => {
      observacionesParagraphs.push(
        new Paragraph({
          indent: { left: 360 },
          children: [txt(`- ${corr} (${count} caso${count !== 1 ? 's' : ''})`)],
        })
      );
    });
  }

  const page1: (Paragraph | Table)[] = [
    tablaEncabezado,
    new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }),
    tablaInfo,
    heading('PARTICIPANTES'),
    tablaParticipantes,
    heading('TEMAS / ACTIVIDADES DESARROLLADAS'),
    tablaTemas,
    heading('ACTIVIDADES PARA DESARROLLAR'),
    tablaActividades,
    heading('OBSERVACIONES'),
    ...observacionesParagraphs,
  ];

  /* ══════════════ PÁGINA 2 ══════════════ */

  // Tabla de HCs (FECHA | ATENCION N° | CORRECCIÓN)
  const tablaHC = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('FECHA', { width: 20, bold: true, align: AlignmentType.CENTER }),
          cell('ATENCION N°', { width: 30, bold: true, align: AlignmentType.CENTER }),
          cell('CORRECCIÓN', { width: 50, bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      ...Array.from({ length: 20 }, (_, i) => {
        const hc = sortedHCs[i];
        return new TableRow({
          children: [
            cell(hc ? formatFecha(hc.fecha) : '', { align: AlignmentType.CENTER }),
            cell(hc ? hc.numero_atencion : '', { align: AlignmentType.CENTER }),
            cell(hc ? hc.correccion : ''),
          ],
        });
      }),
    ],
  });

  const page2: (Paragraph | Table)[] = [
    // Salto de página
    new Paragraph({ children: [new PageBreak()] }),

    // Título centrado, negrita
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [txt('AUDITORIAS HISTORIAS CLINICAS', { bold: true, size: 26 })],
    }),

    // Subtítulo
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [txt(`${apellidoUpper} - ${mesUpper}`, { bold: true, size: 22 })],
    }),

    // Info de reunión
    new Paragraph({
      spacing: { after: 200 },
      children: [
        txt(`Fecha: ${fechaFin}`),
        txt('     Sectores involucrados: Operativa'),
        txt('     Base: Base RIO GALLEGOS'),
      ],
    }),

    // Tabla HC
    tablaHC,

    // Nota legal
    new Paragraph({
      spacing: { before: 280, after: 120 },
      children: [
        txt(
          `Historias clínicas seleccionadas al azar del período ${mesUpper} ${anio}. ` +
          'Las mismas deberán tener todos los campos completos, incluyendo datos filiatorios, epicrisis, ' +
          'diagnóstico, tratamiento, indicaciones, firma sello profesional tratante, firma paciente o responsable.',
          { size: 18 }
        ),
      ],
    }),

    // Texto compromiso
    new Paragraph({
      spacing: { after: 400 },
      children: [
        txt('En caso de haber correcciones, me comprometo a completar correctamente las historias clínicas.'),
      ],
    }),

    // Líneas de firma
    new Paragraph({
      spacing: { after: 60 },
      children: [txt('................................   ................................')],
    }),

    // Etiquetas de firma
    new Paragraph({
      children: [txt('FIRMA MÉDICO                          FIRMA MÉDICO AUDITOR')],
    }),
  ];

  /* ── Construir documento ── */
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        footers: { default: commonFooter },
        children: [...page1, ...page2],
      },
    ],
  });

  /* ── Descargar ── */
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Minuta_${apellidoUpper}_${mesUpper}_${anio}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
