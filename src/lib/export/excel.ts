import ExcelJS from 'exceljs';
import type { Medico, HistoriaClinica } from '@/types';
import { MESES_ES_UPPER } from '@/lib/constants';

function formatFecha(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const borderThin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = borderThin;
}

export async function exportarExcel(
  medico: Medico,
  mes: string, // 'YYYY-MM-01'
  historias_clinicas: HistoriaClinica[]
): Promise<void> {
  const [anio, mesNum] = mes.split('-');
  const mesUpper = MESES_ES_UPPER[parseInt(mesNum) - 1];
  const apellidoUpper = medico.apellido.toUpperCase();

  // Excel sheet names have a 31-char limit
  const sheetName = `${apellidoUpper} - ${mesUpper}`.slice(0, 31);
  const titulo = `${apellidoUpper} - ${mesUpper}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Auditoría HC';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  // ── Column widths ──
  sheet.getColumn('A').width = 15; // FECHA
  sheet.getColumn('B').width = 18; // ATENCION N°
  sheet.getColumn('C').width = 30; // CORRECCIÓN

  // ── Fila 1: Título (fusionada A:C, centrada, negrita, borde) ──
  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = titulo;
  titleCell.font = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = borderThin;
  sheet.getRow(1).height = 22;

  // ── Fila 2: Encabezados ──
  const headerRow = sheet.getRow(2);
  headerRow.values = [undefined, 'FECHA', 'ATENCION N°', 'CORRECCIÓN'];
  // exceljs row.values is 1-indexed, so values[1]=A, values[2]=B, values[3]=C
  // Let's set them directly:
  sheet.getCell('A2').value = 'FECHA';
  sheet.getCell('B2').value = 'ATENCION N°';
  sheet.getCell('C2').value = 'CORRECCIÓN';
  ['A2', 'B2', 'C2'].forEach(addr => {
    const cell = sheet.getCell(addr);
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBorder(cell);
  });
  sheet.getRow(2).height = 18;

  // ── Filas 3..22: HCs (ordenadas por fecha) ──
  const sorted = [...historias_clinicas].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  for (let i = 0; i < 20; i++) {
    const rowNum = i + 3;
    const hc = sorted[i];
    const aAddr = `A${rowNum}`;
    const bAddr = `B${rowNum}`;
    const cAddr = `C${rowNum}`;

    sheet.getCell(aAddr).value = hc ? formatFecha(hc.fecha) : '';
    sheet.getCell(bAddr).value = hc ? hc.numero_atencion : '';
    sheet.getCell(cAddr).value = hc ? hc.correccion : '';

    [aAddr, bAddr, cAddr].forEach(addr => applyBorder(sheet.getCell(addr)));
    sheet.getRow(rowNum).height = 16;
  }

  // ── Fila 24: Texto legal (pequeño, gris) ──
  sheet.mergeCells('A24:C24');
  const legalCell = sheet.getCell('A24');
  legalCell.value =
    `Historias clínicas seleccionadas al azar del período ${mesUpper} ${anio}. ` +
    `Las mismas deberán tener todos los campos completos, incluyendo datos filiatorios, ` +
    `epicrisis, diagnóstico, tratamiento, indicaciones, firma sello profesional tratante, ` +
    `firma paciente o responsable.`;
  legalCell.font = { size: 8, color: { argb: 'FF888888' } };
  legalCell.alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(24).height = 42;

  // ── Fila 26: Texto compromiso ──
  sheet.mergeCells('A26:C26');
  const compromisoCell = sheet.getCell('A26');
  compromisoCell.value =
    'En caso de haber correcciones, me comprometo a completar correctamente las historias clínicas.';
  compromisoCell.font = { size: 10 };
  sheet.getRow(26).height = 16;

  // ── Fila 28: Líneas de firma ──
  sheet.mergeCells('A28:C28');
  sheet.getCell('A28').value =
    '....................................          ....................................';
  sheet.getRow(28).height = 16;

  // ── Fila 29: Etiquetas de firma ──
  sheet.mergeCells('A29:C29');
  const firmaCell = sheet.getCell('A29');
  firmaCell.value = 'FIRMA MÉDICO                                      FIRMA MÉDICO AUDITOR';
  firmaCell.font = { size: 9 };
  sheet.getRow(29).height = 14;

  // ── Generar y descargar ──
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${titulo}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
