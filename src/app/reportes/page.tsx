'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { FileText, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { exportarResumenTrimestral } from '@/lib/export/word-trimestral';

type AudFull = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };
type Tab = 'mensual' | 'trimestral' | 'estadisticas';

const QUARTER_LABELS = ['1ER TRIMESTRE', '2DO TRIMESTRE', '3ER TRIMESTRE', '4TO TRIMESTRE'];

function getQuarterRange(q: number, year: number) {
  const startMonth = (q - 1) * 3;
  const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, startMonth + 3, 1);
  return {
    start,
    end: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`,
  };
}
function getPrevQuarter(q: number, year: number) {
  return q === 1 ? { q: 4, year: year - 1 } : { q: q - 1, year };
}
function formatMesShort(mesStr: string) {
  const [y, m] = mesStr.split('-');
  return `${MESES_ES[parseInt(m) - 1].slice(0, 3).toUpperCase()} '${y.slice(2)}`;
}
function getLast12MonthStarts(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
}
function calcStats(auds: AudFull[]) {
  const hcs = auds.flatMap(a => a.historias_clinicas);
  const total = hcs.length;
  const desvios = hcs.filter(h => h.correccion !== '-').length;
  const pct = total > 0 ? parseFloat((desvios / total * 100).toFixed(1)) : 0;
  return { total, desvios, pct };
}
function pctColor(pct: number) {
  return pct === 0 ? 'text-success' : pct < 15 ? 'text-warning' : 'text-accent';
}

/* ── Shared style tokens ── */
const selectCls = 'bg-transparent border-b border-[#333333] px-0 py-2 font-mono text-[11px] tracking-[0.05em] text-text-secondary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer';

function Divider() { return <div className="border-t border-[#222222]" />; }

function Th({ children, left }: { children: string; left?: boolean }) {
  return <th className={`nd-label py-2.5 ${left ? 'text-left' : 'text-right pl-4'}`}>{children}</th>;
}
function Td({ children, left, bold }: { children: React.ReactNode; left?: boolean; bold?: boolean }) {
  return (
    <td className={`py-2.5 text-sm ${left ? '' : 'text-right pl-4'} ${bold ? 'font-bold text-text-primary tabular-nums' : 'text-text-primary tabular-nums'}`}>
      {children}
    </td>
  );
}
function PctBadge({ pct }: { pct: number }) {
  return <span className={`font-mono text-sm tabular-nums font-bold ${pctColor(pct)}`}>{pct.toFixed(1)}%</span>;
}
function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="font-mono text-[10px] text-text-disabled">—</span>;
  if (diff === 0) return <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-text-disabled"><Minus size={10} />0.0 pp</span>;
  if (diff > 0) return <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-accent"><TrendingUp size={10} />+{diff.toFixed(1)} pp</span>;
  return <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-success"><TrendingDown size={10} />{diff.toFixed(1)} pp</span>;
}
function StatChip({ label, value, valueClass = 'text-text-primary' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-2 border border-[#333333] rounded-full px-4 py-1.5">
      <span className="nd-label">{label}</span>
      <span className={`font-mono text-sm tabular-nums font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}
function LoadingState() {
  return <div className="px-6 py-8"><p className="nd-label animate-pulse">[CARGANDO...]</p></div>;
}
function EmptyState({ msg }: { msg: string }) {
  return <div className="px-6 py-10"><p className="font-mono text-[11px] text-text-disabled">{msg}</p></div>;
}

/* ── Heatmap ── */
function Heatmap({ auds, months }: { auds: AudFull[]; months: string[] }) {
  const medicosMap = new Map<string, Medico>();
  auds.forEach(a => medicosMap.set(a.medico_id, a.medico));
  const medicos = Array.from(medicosMap.values());
  if (!medicos.length) return null;
  const cols = months.length;
  const headerCells = [
    <div key="corner" />,
    ...months.map(m => (
      <div key={`h-${m}`} className="text-center nd-label py-1 text-[9px]">{formatMesShort(m)}</div>
    )),
  ];
  const dataCells = medicos.flatMap(med => [
    <div key={`l-${med.id}`} className="font-mono text-[11px] text-text-secondary self-center pr-2 truncate">
      {med.apellido.toUpperCase()}
    </div>,
    ...months.map(m => {
      const aud = auds.find(a => a.medico_id === med.id && a.mes === m);
      if (!aud) return (
        <div key={`${med.id}-${m}`} className="h-8 border border-[#1A1A1A] flex items-center justify-center rounded">
          <span className="font-mono text-[9px] text-text-disabled">—</span>
        </div>
      );
      const hcCount = aud.historias_clinicas.length;
      const dev = aud.historias_clinicas.filter(h => h.correccion !== '-').length;
      const pct = hcCount > 0 ? dev / hcCount * 100 : 0;
      const cls = pct === 0 ? 'border-success/30 text-success bg-success/5'
        : pct < 15 ? 'border-warning/30 text-warning bg-warning/5'
        : 'border-accent/30 text-accent bg-accent/5';
      return (
        <div key={`${med.id}-${m}`} className={`h-8 border rounded flex items-center justify-center ${cls}`} title={`${pct.toFixed(1)}%`}>
          <span className="font-mono text-[10px] font-bold">{pct.toFixed(0)}%</span>
        </div>
      );
    }),
  ]);
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `140px repeat(${cols}, minmax(46px, 1fr))`, minWidth: `${140 + cols * 50}px` }}>
        {headerCells}{dataCells}
      </div>
    </div>
  );
}

/* ══════ PAGE ══════ */

export default function ReportesPage() {
  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('mensual');
  const [mesSelec, setMesSelec] = useState(now.getMonth() + 1);
  const [anioMes, setAnioMes] = useState(now.getFullYear());
  const [audsMensual, setAudsMensual] = useState<AudFull[]>([]);
  const [loadingMensual, setLoadingMensual] = useState(false);
  const [quarterSelec, setQuarterSelec] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [anioTrim, setAnioTrim] = useState(now.getFullYear());
  const [audsTrimActual, setAudsTrimActual] = useState<AudFull[]>([]);
  const [audsTrimPrev, setAudsTrimPrev] = useState<AudFull[]>([]);
  const [loadingTrim, setLoadingTrim] = useState(false);
  const [exportingTrim, setExportingTrim] = useState(false);
  const [audsStats, setAudsStats] = useState<AudFull[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const last12 = useMemo(() => getLast12MonthStarts(), []);

  const fetchMensual = useCallback(async () => {
    setLoadingMensual(true);
    const mesStr = `${anioMes}-${String(mesSelec).padStart(2, '0')}-01`;
    const { data } = await supabase.from('auditorias')
      .select('*, medico:medicos(*), historias_clinicas(*)').eq('completada', true).eq('mes', mesStr);
    setAudsMensual((data ?? []) as AudFull[]);
    setLoadingMensual(false);
  }, [mesSelec, anioMes]);

  const fetchTrimestral = useCallback(async () => {
    setLoadingTrim(true);
    const { start, end } = getQuarterRange(quarterSelec, anioTrim);
    const prev = getPrevQuarter(quarterSelec, anioTrim);
    const { start: ps, end: pe } = getQuarterRange(prev.q, prev.year);
    const [{ data: actual }, { data: anterior }] = await Promise.all([
      supabase.from('auditorias').select('*, medico:medicos(*), historias_clinicas(*)')
        .eq('completada', true).gte('mes', start).lt('mes', end),
      supabase.from('auditorias').select('*, medico:medicos(*), historias_clinicas(*)')
        .eq('completada', true).gte('mes', ps).lt('mes', pe),
    ]);
    setAudsTrimActual((actual ?? []) as AudFull[]);
    setAudsTrimPrev((anterior ?? []) as AudFull[]);
    setLoadingTrim(false);
  }, [quarterSelec, anioTrim]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const { data } = await supabase.from('auditorias')
      .select('*, medico:medicos(*), historias_clinicas(*)').eq('completada', true).gte('mes', last12[0]);
    setAudsStats((data ?? []) as AudFull[]);
    setLoadingStats(false);
  }, [last12]);

  useEffect(() => { if (tab === 'mensual') fetchMensual(); }, [tab, fetchMensual]);
  useEffect(() => { if (tab === 'trimestral') fetchTrimestral(); }, [tab, fetchTrimestral]);
  useEffect(() => { if (tab === 'estadisticas') fetchStats(); }, [tab, fetchStats]);

  const handleExportTrimestral = async () => {
    setExportingTrim(true);
    try { await exportarResumenTrimestral(quarterSelec, anioTrim, audsTrimActual); }
    catch (e) { console.error(e); }
    setExportingTrim(false);
  };

  const mesStats = useMemo(() => calcStats(audsMensual), [audsMensual]);
  const trimStats = useMemo(() => calcStats(audsTrimActual), [audsTrimActual]);
  const prevStats = useMemo(() => calcStats(audsTrimPrev), [audsTrimPrev]);

  const trimByMedico = useMemo(() => {
    const map = new Map<string, { medico: Medico; hcs: number; desvios: number; prevHcs: number; prevDesvios: number }>();
    audsTrimActual.forEach(a => {
      const e = map.get(a.medico_id) ?? { medico: a.medico, hcs: 0, desvios: 0, prevHcs: 0, prevDesvios: 0 };
      e.hcs += a.historias_clinicas.length;
      e.desvios += a.historias_clinicas.filter(h => h.correccion !== '-').length;
      map.set(a.medico_id, e);
    });
    audsTrimPrev.forEach(a => {
      const e = map.get(a.medico_id) ?? { medico: a.medico, hcs: 0, desvios: 0, prevHcs: 0, prevDesvios: 0 };
      e.prevHcs += a.historias_clinicas.length;
      e.prevDesvios += a.historias_clinicas.filter(h => h.correccion !== '-').length;
      map.set(a.medico_id, e);
    });
    return Array.from(map.values()).map(r => {
      const pct = r.hcs > 0 ? parseFloat((r.desvios / r.hcs * 100).toFixed(1)) : 0;
      const prevPct = r.prevHcs > 0 ? parseFloat((r.prevDesvios / r.prevHcs * 100).toFixed(1)) : null;
      return { ...r, pct, diff: prevPct !== null ? parseFloat((pct - prevPct).toFixed(1)) : null };
    });
  }, [audsTrimActual, audsTrimPrev]);

  const ranking = useMemo(() => {
    const map = new Map<string, { medico: Medico; hcs: number; desvios: number }>();
    audsStats.forEach(a => {
      const e = map.get(a.medico_id) ?? { medico: a.medico, hcs: 0, desvios: 0 };
      e.hcs += a.historias_clinicas.length;
      e.desvios += a.historias_clinicas.filter(h => h.correccion !== '-').length;
      map.set(a.medico_id, e);
    });
    return Array.from(map.values())
      .map(r => ({ ...r, pct: r.hcs > 0 ? parseFloat((r.desvios / r.hcs * 100).toFixed(1)) : 0 }))
      .sort((a, b) => b.pct - a.pct);
  }, [audsStats]);

  const years = useMemo(() => [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()], [now]);

  return (
    <div className="max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Reportes</h1>
        <p className="nd-label mt-1">ANÁLISIS DE AUDITORÍAS</p>
      </div>

      <Divider />

      {/* Tab switcher */}
      <div className="px-6 py-4 flex gap-1 border-b border-[#222222]">
        {([['mensual', 'MENSUAL'], ['trimestral', 'TRIMESTRAL'], ['estadisticas', 'ESTADÍSTICAS']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full font-mono text-[11px] tracking-[0.05em] transition-colors ${
              tab === t ? 'bg-text-display text-background' : 'text-text-disabled hover:text-text-secondary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB MENSUAL ── */}
      {tab === 'mensual' && (
        <section>
          <div className="px-6 py-4 flex gap-6 border-b border-[#222222]">
            <select value={mesSelec} onChange={e => setMesSelec(Number(e.target.value))} className={selectCls}>
              {MESES_ES.map((n, i) => <option key={i + 1} value={i + 1}>{n.toUpperCase()}</option>)}
            </select>
            <select value={anioMes} onChange={e => setAnioMes(Number(e.target.value))} className={selectCls}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={fetchMensual} className="font-mono text-[11px] tracking-wider text-interactive hover:text-text-primary transition-colors whitespace-nowrap">
              BUSCAR →
            </button>
          </div>

          {loadingMensual ? <LoadingState /> : audsMensual.length === 0 ? (
            <EmptyState msg={`Sin auditorías completas en ${MESES_ES[mesSelec - 1].toUpperCase()} ${anioMes}.`} />
          ) : (
            <>
              <div className="px-6 py-4 flex gap-2.5 flex-wrap border-b border-[#222222]">
                <StatChip label="HCS" value={String(mesStats.total)} />
                <StatChip label="DESVÍOS" value={String(mesStats.desvios)} />
                <StatChip label="TASA" value={`${mesStats.pct}%`} valueClass={pctColor(mesStats.pct)} />
                <StatChip label="MÉDICOS" value={String(audsMensual.length)} />
              </div>
              <table className="w-full px-6">
                <thead><tr className="border-b border-[#222222]">
                  <Th left>MÉDICO</Th><Th>HCS</Th><Th>DESVÍOS</Th><Th>%</Th>
                </tr></thead>
                <tbody>
                  {audsMensual.map(a => {
                    const hcCount = a.historias_clinicas.length;
                    const dev = a.historias_clinicas.filter(h => h.correccion !== '-').length;
                    const pct = hcCount > 0 ? parseFloat((dev / hcCount * 100).toFixed(1)) : 0;
                    return (
                      <tr key={a.id} className="border-b border-[#1A1A1A] last:border-0 hover:bg-surface-raised transition-colors">
                        <Td left>{a.medico.apellido}, {a.medico.nombre}</Td>
                        <Td>{hcCount}</Td><Td>{dev}</Td>
                        <Td><PctBadge pct={pct} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
                {audsMensual.length > 1 && (
                  <tfoot><tr className="border-t border-[#333333]">
                    <Td left bold>TOTAL</Td>
                    <Td bold>{mesStats.total}</Td><Td bold>{mesStats.desvios}</Td>
                    <Td><PctBadge pct={mesStats.pct} /></Td>
                  </tr></tfoot>
                )}
              </table>
            </>
          )}
        </section>
      )}

      {/* ── TAB TRIMESTRAL ── */}
      {tab === 'trimestral' && (
        <section>
          <div className="px-6 py-4 flex gap-6 border-b border-[#222222]">
            <select value={quarterSelec} onChange={e => setQuarterSelec(Number(e.target.value))} className={selectCls}>
              {QUARTER_LABELS.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
            </select>
            <select value={anioTrim} onChange={e => setAnioTrim(Number(e.target.value))} className={selectCls}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={fetchTrimestral} className="font-mono text-[11px] tracking-wider text-interactive hover:text-text-primary transition-colors whitespace-nowrap">
              BUSCAR →
            </button>
          </div>

          {loadingTrim ? <LoadingState /> : audsTrimActual.length === 0 ? (
            <EmptyState msg={`Sin auditorías completas en el ${QUARTER_LABELS[quarterSelec - 1]} ${anioTrim}.`} />
          ) : (
            <>
              <div className="px-6 py-4 flex gap-2.5 flex-wrap border-b border-[#222222]">
                <StatChip label="HCS" value={String(trimStats.total)} />
                <StatChip label="DESVÍOS" value={String(trimStats.desvios)} />
                <StatChip label="TASA" value={`${trimStats.pct}%`} valueClass={pctColor(trimStats.pct)} />
                {prevStats.total > 0 && (
                  <span className="nd-label self-center">
                    TRIM. ANT.: <span className={pctColor(prevStats.pct)}>{prevStats.pct}%</span>
                  </span>
                )}
              </div>
              <table className="w-full">
                <thead><tr className="border-b border-[#222222]">
                  <Th left>MÉDICO</Th><Th>HCS</Th><Th>DEV.</Th><Th>%</Th><Th>VS ANT.</Th>
                </tr></thead>
                <tbody>
                  {trimByMedico.map(r => (
                    <tr key={r.medico.id} className="border-b border-[#1A1A1A] last:border-0 hover:bg-surface-raised transition-colors">
                      <Td left>{r.medico.apellido}, {r.medico.nombre}</Td>
                      <Td>{r.hcs}</Td><Td>{r.desvios}</Td>
                      <Td><PctBadge pct={r.pct} /></Td>
                      <Td><DiffBadge diff={r.diff} /></Td>
                    </tr>
                  ))}
                </tbody>
                {trimByMedico.length > 1 && (
                  <tfoot><tr className="border-t border-[#333333]">
                    <Td left bold>TOTAL</Td>
                    <Td bold>{trimStats.total}</Td><Td bold>{trimStats.desvios}</Td>
                    <Td><PctBadge pct={trimStats.pct} /></Td>
                    <Td><DiffBadge diff={prevStats.total > 0 ? parseFloat((trimStats.pct - prevStats.pct).toFixed(1)) : null} /></Td>
                  </tr></tfoot>
                )}
              </table>
              <div className="px-6 py-5 border-t border-[#222222]">
                <button onClick={handleExportTrimestral} disabled={exportingTrim}
                  className="flex items-center gap-2 h-9 px-5 border border-[#333333] rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40">
                  {exportingTrim
                    ? <><Loader2 size={12} className="animate-spin" />GENERANDO...</>
                    : <><FileText size={12} strokeWidth={1.5} />EXPORTAR WORD</>
                  }
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── TAB ESTADÍSTICAS ── */}
      {tab === 'estadisticas' && (
        <section>
          {loadingStats ? <LoadingState /> : audsStats.length === 0 ? (
            <EmptyState msg="Sin datos de auditorías completas en los últimos 12 meses." />
          ) : (
            <>
              {/* Heatmap */}
              <div className="px-6 py-6 border-b border-[#222222]">
                <p className="nd-label mb-5">HEATMAP · % DESVÍOS · MÉDICO × MES · ÚLTIMOS 12 MESES</p>
                <Heatmap auds={audsStats} months={last12} />
                <div className="flex items-center gap-5 mt-4 flex-wrap">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-success">
                    <span className="w-3 h-3 border border-success/30 bg-success/5 rounded inline-block" />0%
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-warning">
                    <span className="w-3 h-3 border border-warning/30 bg-warning/5 rounded inline-block" />1–15%
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-accent">
                    <span className="w-3 h-3 border border-accent/30 bg-accent/5 rounded inline-block" />&gt;15%
                  </div>
                  <div className="flex items-center gap-1.5 nd-label">
                    <span className="w-3 h-3 border border-[#1A1A1A] rounded inline-block" />SIN DATOS
                  </div>
                </div>
              </div>

              {/* Ranking */}
              {ranking.length > 0 && (
                <div className="px-6 py-6">
                  <p className="nd-label mb-5">RANKING · TASA DE DESVÍOS ACUMULADA</p>
                  <div className="space-y-4">
                    {ranking.map((r, i) => (
                      <div key={r.medico.id} className="flex items-center gap-3">
                        <span className="font-mono text-[10px] text-text-disabled tabular-nums w-4 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-text-primary truncate pr-3">
                              {r.medico.apellido}, {r.medico.nombre}
                            </span>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="font-mono text-[10px] text-text-disabled tabular-nums">{r.desvios}/{r.hcs} HC</span>
                              <PctBadge pct={r.pct} />
                            </div>
                          </div>
                          {/* Segmented progress bar */}
                          <div className="flex gap-[2px]">
                            {Array.from({ length: 20 }, (_, j) => {
                              const threshold = j * 5;
                              const filled = r.pct > threshold;
                              const color = r.pct === 0 ? 'bg-success' : r.pct < 15 ? 'bg-warning' : 'bg-accent';
                              return (
                                <div key={j} className={`flex-1 h-[4px] ${filled ? color : 'bg-[#1A1A1A]'}`} />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
