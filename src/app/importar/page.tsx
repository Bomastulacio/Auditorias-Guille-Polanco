'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabase';
import { MESES_ES_UPPER } from '@/lib/constants';
import {
  ChevronLeft, Upload, CheckCircle2, AlertTriangle,
  FileSpreadsheet, Loader2, X, Minus,
} from 'lucide-react';

/* ── Types ── */

type HC = { fecha: string; numero_atencion: string; correccion: string };

type ParsedSheet = {
  sheetName: string;
  apellido: string;
  mesNombre: string;
  mesStr: string;   // 'YYYY-MM-01'
  anio: number;
  hcs: HC[];
  parseError?: string;
};

type ImportResult = {
  sheetName: string;
  status: 'success' | 'error' | 'skip';
  message: string;
  auditoriaId?: string;
};

/* ── Helpers ── */

function cellText(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${val.getFullYear()}`;
  }
  if (typeof val === 'object') {
    if ('text' in val) return String((val as { text: string }).text).trim();
    if ('result' in val) return String((val as { result: unknown }).result).trim();
  }
  return String(val).trim();
}

function parseFecha(raw: string): string | null {
  // DD/MM/YYYY → YYYY-MM-DD
  const parts = raw.trim().split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy && yyyy.length === 4) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }
  // Try as ISO or Date string fallback
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

async function parseExcelFile(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const results: ParsedSheet[] = [];

  workbook.eachSheet((ws) => {
    const sheetName = ws.name;

    // Row 1 (merged A:C): "APELLIDO - MES"
    const raw = cellText(ws.getCell('A1'));
    const dashIdx = raw.lastIndexOf(' - ');

    if (dashIdx === -1) {
      results.push({ sheetName, apellido: '', mesNombre: '', mesStr: '', anio: 0, hcs: [],
        parseError: `Título inválido "${raw}" — se esperaba "APELLIDO - MES"` });
      return;
    }

    const apellido = raw.slice(0, dashIdx).trim();
    const mesNombre = raw.slice(dashIdx + 3).trim();
    const mesNum = MESES_ES_UPPER.indexOf(mesNombre) + 1;

    if (mesNum === 0) {
      results.push({ sheetName, apellido, mesNombre, mesStr: '', anio: 0, hcs: [],
        parseError: `Mes no reconocido: "${mesNombre}"` });
      return;
    }

    // Rows 3-22: FECHA | ATENCION N° | CORRECCIÓN
    const hcs: HC[] = [];
    let anio: number | null = null;

    for (let r = 3; r <= 22; r++) {
      const fechaRaw = cellText(ws.getCell(`A${r}`));
      const numero   = cellText(ws.getCell(`B${r}`));
      const correccionRaw = cellText(ws.getCell(`C${r}`));

      if (!fechaRaw || !numero) continue;

      const fechaISO = parseFecha(fechaRaw);
      if (!fechaISO) continue;

      if (!anio) anio = parseInt(fechaISO.slice(0, 4));
      hcs.push({ fecha: fechaISO, numero_atencion: numero, correccion: correccionRaw || '-' });
    }

    if (!hcs.length || !anio) {
      results.push({ sheetName, apellido, mesNombre, mesStr: '', anio: 0, hcs: [],
        parseError: 'No se encontraron HCs válidas en las filas 3-22' });
      return;
    }

    const mesStr = `${anio}-${String(mesNum).padStart(2, '0')}-01`;
    results.push({ sheetName, apellido, mesNombre, mesStr, anio, hcs });
  });

  return results;
}

/* ══════════════════════ PAGE ══════════════════════ */

export default function ImportarPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName]     = useState<string | null>(null);
  const [parsing, setParsing]       = useState(false);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [importing, setImporting]   = useState(false);
  const [results, setResults]       = useState<ImportResult[]>([]);

  /* ── File handling ── */

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) { alert('Solo se aceptan archivos .xlsx'); return; }
    setFileName(file.name);
    setParsing(true);
    setResults([]);
    try {
      setParsedSheets(await parseExcelFile(file));
    } catch (e) {
      console.error(e);
      setParsedSheets([]);
    }
    setParsing(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const reset = () => {
    setFileName(null);
    setParsedSheets([]);
    setResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Import ── */

  const handleImport = async () => {
    const valid = parsedSheets.filter(s => !s.parseError);
    if (!valid.length) return;

    setImporting(true);
    const importResults: ImportResult[] = [];

    for (const sheet of parsedSheets) {
      // Sheets with parse errors → skip
      if (sheet.parseError) {
        importResults.push({ sheetName: sheet.sheetName, status: 'skip',
          message: sheet.parseError });
        continue;
      }

      // Find médico — exact match first, then partial
      const { data: exact } = await supabase
        .from('medicos').select('*').ilike('apellido', sheet.apellido);

      let medico = exact?.[0] ?? null;

      if (!medico) {
        const { data: partial } = await supabase
          .from('medicos').select('*').ilike('apellido', `%${sheet.apellido}%`);
        medico = partial?.[0] ?? null;
      }

      if (!medico) {
        importResults.push({ sheetName: sheet.sheetName, status: 'error',
          message: `Médico no encontrado: "${sheet.apellido}" — agregalo primero en /medicos` });
        continue;
      }

      // Check for existing auditoría
      const { data: existing } = await supabase
        .from('auditorias').select('id')
        .eq('medico_id', medico.id).eq('mes', sheet.mesStr).maybeSingle();

      if (existing) {
        importResults.push({ sheetName: sheet.sheetName, status: 'skip',
          message: `Ya existe: ${medico.apellido} — ${sheet.mesNombre} ${sheet.anio}`,
          auditoriaId: existing.id });
        continue;
      }

      // Create auditoría
      const { data: auditoria, error: audErr } = await supabase
        .from('auditorias')
        .insert({ medico_id: medico.id, mes: sheet.mesStr, completada: false })
        .select('id').single();

      if (audErr || !auditoria) {
        importResults.push({ sheetName: sheet.sheetName, status: 'error',
          message: `Error al crear auditoría: ${audErr?.message ?? 'desconocido'}` });
        continue;
      }

      // Insert HCs
      const { error: hcErr } = await supabase
        .from('historias_clinicas')
        .insert(sheet.hcs.map(hc => ({
          auditoria_id: auditoria.id,
          fecha: hc.fecha,
          numero_atencion: hc.numero_atencion,
          correccion: hc.correccion,
        })));

      if (hcErr) {
        // Rollback
        await supabase.from('auditorias').delete().eq('id', auditoria.id);
        importResults.push({ sheetName: sheet.sheetName, status: 'error',
          message: `Error al insertar HCs: ${hcErr.message}` });
        continue;
      }

      // Mark complete if 20 HCs
      if (sheet.hcs.length === 20) {
        await supabase.from('auditorias').update({ completada: true }).eq('id', auditoria.id);
      }

      importResults.push({
        sheetName: sheet.sheetName,
        status: 'success',
        message: sheet.hcs.length === 20
          ? `${sheet.hcs.length} HCs importadas · MARCADA COMPLETA`
          : `${sheet.hcs.length}/20 HCs importadas · EN CURSO`,
        auditoriaId: auditoria.id,
      });
    }

    setResults(importResults);
    setImporting(false);
  };

  const validSheets = parsedSheets.filter(s => !s.parseError);

  /* ── Render ── */

  return (
    <div className="max-w-3xl mx-auto w-full">

      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <Link href="/auditorias"
          className="inline-flex items-center gap-1.5 nd-label hover:text-text-secondary transition-colors mb-5">
          <ChevronLeft size={14} strokeWidth={1.5} />
          AUDITORÍAS
        </Link>
        <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Importar histórico</h1>
        <p className="nd-label mt-1">DESDE ARCHIVO .XLSX — FORMATO AUDITORÍA HC</p>
      </div>

      <div className="border-t border-nd-border" />

      {/* Instrucciones */}
      <div className="px-6 py-5 border-b border-nd-border">
        <p className="font-mono text-[11px] text-text-disabled leading-relaxed">
          El archivo debe tener una hoja por médico con el formato:<br />
          · Celda A1: <span className="text-text-secondary">APELLIDO - MES</span> (ej: GARCIA - OCTUBRE)<br />
          · Fila 2: encabezados FECHA / ATENCION N° / CORRECCIÓN<br />
          · Filas 3-22: datos con fechas en DD/MM/YYYY
        </p>
      </div>

      {/* Drop zone */}
      <div className="px-6 py-6">
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !fileName && fileInputRef.current?.click()}
          className={`relative border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 py-12 transition-colors ${
            isDragging
              ? 'border-text-secondary bg-surface-raised cursor-copy'
              : fileName
              ? 'border-nd-border-vis bg-surface cursor-default'
              : 'border-nd-border-vis hover:border-text-secondary hover:bg-surface cursor-pointer'
          }`}
        >
          <FileSpreadsheet size={26} strokeWidth={1.5} className={fileName ? 'text-text-secondary' : 'text-text-disabled'} />
          <div className="text-center">
            <p className="font-mono text-[11px] tracking-wider text-text-secondary">
              {fileName ?? 'ARRASTRAR O SELECCIONAR .XLSX'}
            </p>
            {!fileName && (
              <p className="font-mono text-[10px] text-text-disabled mt-1">
                Puede contener múltiples hojas (una por médico)
              </p>
            )}
          </div>

          {fileName && (
            <button
              onClick={e => { e.stopPropagation(); reset(); }}
              className="absolute top-3 right-3 p-1 text-text-disabled hover:text-text-primary transition-colors"
              title="Quitar archivo"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Parsing */}
      {parsing && (
        <div className="px-6 py-4 border-t border-nd-border flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-text-secondary" />
          <p className="nd-label">ANALIZANDO ARCHIVO...</p>
        </div>
      )}

      {/* Preview de hojas detectadas */}
      {!parsing && parsedSheets.length > 0 && results.length === 0 && (
        <>
          <div className="border-t border-nd-border" />
          <div className="px-6 py-5">
            <p className="nd-label mb-4">
              HOJAS DETECTADAS ({parsedSheets.length})
              {parsedSheets.length > validSheets.length && (
                <span className="text-accent ml-2">· {parsedSheets.length - validSheets.length} CON ERROR</span>
              )}
            </p>

            <ul className="space-y-2 mb-6">
              {parsedSheets.map((sheet, i) => (
                <li key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                  sheet.parseError
                    ? 'border-accent/30 bg-accent/5'
                    : 'border-nd-border bg-surface'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {sheet.parseError
                      ? <AlertTriangle size={13} strokeWidth={1.5} className="text-accent" />
                      : <CheckCircle2 size={13} strokeWidth={1.5} className="text-success" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[11px] text-text-primary">{sheet.sheetName}</p>
                    {sheet.parseError ? (
                      <p className="font-mono text-[10px] text-accent mt-0.5">{sheet.parseError}</p>
                    ) : (
                      <div className="flex flex-wrap gap-4 mt-0.5">
                        <span className="nd-label">MÉD: <span className="text-text-primary">{sheet.apellido}</span></span>
                        <span className="nd-label">MES: <span className="text-text-primary">{sheet.mesNombre} {sheet.anio}</span></span>
                        <span className={`nd-label ${sheet.hcs.length < 20 ? 'text-warning' : ''}`}>
                          {sheet.hcs.length}/20 HCS
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {validSheets.length > 0 ? (
              <div>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex items-center gap-2 h-11 px-8 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.07em] hover:bg-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {importing
                    ? <><Loader2 size={13} className="animate-spin" />IMPORTANDO...</>
                    : <><Upload size={13} strokeWidth={2} />IMPORTAR {validSheets.length} HOJA{validSheets.length !== 1 ? 'S' : ''}</>
                  }
                </button>
                {parsedSheets.length > validSheets.length && (
                  <p className="nd-label mt-2">
                    Las hojas con error serán saltadas
                  </p>
                )}
              </div>
            ) : (
              <p className="font-mono text-[11px] text-accent">
                No hay hojas válidas para importar. Revisá el formato del archivo.
              </p>
            )}
          </div>
        </>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <>
          <div className="border-t border-nd-border" />
          <div className="px-6 py-5">
            <p className="nd-label mb-4">RESULTADOS DE IMPORTACIÓN</p>

            {/* Summary chips */}
            <div className="flex gap-3 flex-wrap mb-5">
              {(() => {
                const ok = results.filter(r => r.status === 'success').length;
                const err = results.filter(r => r.status === 'error').length;
                const skip = results.filter(r => r.status === 'skip').length;
                return (
                  <>
                    {ok > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 border border-success/30 rounded-full font-mono text-[10px] text-success">
                        <CheckCircle2 size={11} strokeWidth={1.5} />
                        {ok} IMPORTADA{ok !== 1 ? 'S' : ''}
                      </div>
                    )}
                    {err > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 border border-accent/30 rounded-full font-mono text-[10px] text-accent">
                        <AlertTriangle size={11} strokeWidth={1.5} />
                        {err} ERROR{err !== 1 ? 'ES' : ''}
                      </div>
                    )}
                    {skip > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1 border border-nd-border-vis rounded-full font-mono text-[10px] text-text-disabled">
                        <Minus size={11} strokeWidth={1.5} />
                        {skip} SALTADA{skip !== 1 ? 'S' : ''}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <ul className="space-y-2 mb-6">
              {results.map((r, i) => (
                <li key={i} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
                  r.status === 'success' ? 'border-success/30 bg-success/5'
                  : r.status === 'error'   ? 'border-accent/30 bg-accent/5'
                  : 'border-nd-border bg-surface'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {r.status === 'success' ? <CheckCircle2 size={13} strokeWidth={1.5} className="text-success" />
                    : r.status === 'error'  ? <AlertTriangle size={13} strokeWidth={1.5} className="text-accent" />
                    : <Minus size={13} strokeWidth={1.5} className="text-text-disabled" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[11px] text-text-primary">{r.sheetName}</p>
                    <p className={`font-mono text-[10px] mt-0.5 ${
                      r.status === 'success' ? 'text-success'
                      : r.status === 'error' ? 'text-accent'
                      : 'text-text-disabled'
                    }`}>{r.message}</p>
                    {r.auditoriaId && (
                      <Link href={`/auditorias/${r.auditoriaId}`}
                        className="font-mono text-[10px] text-interactive hover:underline mt-0.5 block">
                        VER AUDITORÍA →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={reset}
                className="h-9 px-5 border border-nd-border-vis rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary transition-colors"
              >
                IMPORTAR OTRO
              </button>
              <Link href="/auditorias"
                className="h-9 px-5 bg-text-display text-background rounded-full font-mono text-[11px] tracking-wider hover:bg-text-primary transition-colors flex items-center">
                VER AUDITORÍAS
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
