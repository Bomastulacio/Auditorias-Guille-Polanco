'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { FileText, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { exportarResumenTrimestral } from '@/lib/export/word-trimestral';

/* ── Types ── */

type AudFull = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };
type Tab = 'mensual' | 'trimestral' | 'estadisticas';

/* ── Constants ── */

const QUARTER_LABELS = ['1er trimestre', '2do trimestre', '3er trimestre', '4to trimestre'];

/* ── Helpers ── */

function getQuarterRange(q: number, year: number) {
  const startMonth = (q - 1) * 3;
  const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, startMonth + 3, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end };
}

function getPrevQuarter(q: number, year: number) {
  return q === 1 ? { q: 4, year: year - 1 } : { q: q - 1, year };
}

function formatMesShort(mesStr: string) {
  const [y, m] = mesStr.split('-');
  return `${MESES_ES[parseInt(m) - 1].slice(0, 3)} '${y.slice(2)}`;
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

const pctClass = (pct: number) =>
  pct === 0 ? 'text-emerald-400' : pct < 15 ? 'text-amber-400' : 'text-red-400';

/* ── Shared style tokens ── */
const selectCls = 'bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors';
const buscarCls = 'px-4 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors border border-primary/20';

/* ═══════════════════════════ PAGE ═══════════════════════════ */

export default function ReportesPage() {
  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<Tab>('mensual');

  /* ── Tab 1 state ── */
  const [mesSelec, setMesSelec] = useState(now.getMonth() + 1);
  const [anioMes, setAnioMes] = useState(now.getFullYear());
  const [audsMensual, setAudsMensual] = useState<AudFull[]>([]);
  const [loadingMensual, setLoadingMensual] = useState(false);

  /* ── Tab 2 state ── */
  const [quarterSelec, setQuarterSelec] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [anioTrim, setAnioTrim] = useState(now.getFullYear());
  const [audsTrimActual, setAudsTrimActual] = useState<AudFull[]>([]);
  const [audsTrimPrev, setAudsTrimPrev] = useState<AudFull[]>([]);
  const [loadingTrim, setLoadingTrim] = useState(false);
  const [exportingTrim, setExportingTrim] = useState(false);

  /* ── Tab 3 state ── */
  const [audsStats, setAudsStats] = useState<AudFull[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const last12 = useMemo(() => getLast12MonthStarts(), []);

  /* ── Fetches ── */

  const fetchMensual = useCallback(async () => {
    setLoadingMensual(true);
    const mesStr = `${anioMes}-${String(mesSelec).padStart(2, '0')}-01`;
    const { data } = await supabase
      .from('auditorias')
      .select('*, medico:medicos(*), historias_clinicas(*)')
      .eq('completada', true)
      .eq('mes', mesStr);
    setAudsMensual((data ?? []) as AudFull[]);
    setLoadingMensual(false);
  }, [mesSelec, anioMes]);

  const fetchTrimestral = useCallback(async () => {
    setLoadingTrim(true);
    const { start, end } = getQuarterRange(quarterSelec, anioTrim);
    const prev = getPrevQuarter(quarterSelec, anioTrim);
    const { start: prevStart, end: prevEnd } = getQuarterRange(prev.q, prev.year);
    const [{ data: actual }, { data: anterior }] = await Promise.all([
      supabase.from('auditorias').select('*, medico:medicos(*), historias_clinicas(*)')
        .eq('completada', true).gte('mes', start).lt('mes', end),
      supabase.from('auditorias').select('*, medico:medicos(*), historias_clinicas(*)')
        .eq('completada', true).gte('mes', prevStart).lt('mes', prevEnd),
    ]);
    setAudsTrimActual((actual ?? []) as AudFull[]);
    setAudsTrimPrev((anterior ?? []) as AudFull[]);
    setLoadingTrim(false);
  }, [quarterSelec, anioTrim]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const { data } = await supabase
      .from('auditorias')
      .select('*, medico:medicos(*), historias_clinicas(*)')
      .eq('completada', true)
      .gte('mes', last12[0]);
    setAudsStats((data ?? []) as AudFull[]);
    setLoadingStats(false);
  }, [last12]);

  useEffect(() => { if (tab === 'mensual') fetchMensual(); }, [tab, fetchMensual]);
  useEffect(() => { if (tab === 'trimestral') fetchTrimestral(); }, [tab, fetchTrimestral]);
  useEffect(() => { if (tab === 'estadisticas') fetchStats(); }, [tab, fetchStats]);

  const handleExportTrimestral = async () => {
    setExportingTrim(true);
    try {
      await exportarResumenTrimestral(quarterSelec, anioTrim, audsTrimActual);
    } catch (err) {
      console.error('Error exportando Word trimestral:', err);
    }
    setExportingTrim(false);
  };

  /* ── Derived stats ── */

  const mesStats = useMemo(() => calcStats(audsMensual), [audsMensual]);
  const trimStats = useMemo(() => calcStats(audsTrimActual), [audsTrimActual]);
  const prevStats = useMemo(() => calcStats(audsTrimPrev), [audsTrimPrev]);

  const trimByMedico = useMemo(() => {
    type Row = {
      medico: Medico;
      hcs: number; desvios: number;
      prevHcs: number; prevDesvios: number;
    };
    const map = new Map<string, Row>();
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
      const diff = prevPct !== null ? parseFloat((pct - prevPct).toFixed(1)) : null;
      return { ...r, pct, prevPct, diff };
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

  const years = useMemo(
    () => [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()],
    [now]
  );

  /* ── Render ── */

  return (
    <div className="p-6 md:p-padding max-w-4xl mx-auto pb-24 md:pb-10">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[2.4rem] leading-none font-light tracking-[-0.04em] text-foreground font-display">
          Reportes
        </h1>
        <p className="text-text-secondary text-sm mt-2">Análisis de auditorías y estadísticas</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-full mb-8 w-fit">
        {([
          ['mensual', 'Mensual'],
          ['trimestral', 'Trimestral'],
          ['estadisticas', 'Estadísticas'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              tab === t
                ? 'bg-primary text-white shadow-glow'
                : 'text-text-secondary hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════ TAB 1 — MENSUAL ══════ */}
      {tab === 'mensual' && (
        <section>
          <div className="flex gap-3 mb-6 flex-wrap">
            <select value={mesSelec} onChange={e => setMesSelec(Number(e.target.value))} className={selectCls}>
              {MESES_ES.map((nombre, i) => <option key={i + 1} value={i + 1}>{nombre}</option>)}
            </select>
            <select value={anioMes} onChange={e => setAnioMes(Number(e.target.value))} className={selectCls}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={fetchMensual} className={buscarCls}>Buscar</button>
          </div>

          {loadingMensual ? <LoadingSkeleton /> : audsMensual.length === 0 ? (
            <EmptyState msg={`Sin auditorías completas en ${MESES_ES[mesSelec - 1]} ${anioMes}.`} />
          ) : (
            <>
              <div className="flex gap-2.5 flex-wrap mb-5">
                <Chip label="HCs totales" value={mesStats.total.toString()} />
                <Chip label="Desvíos" value={mesStats.desvios.toString()} />
                <Chip label="Tasa" value={`${mesStats.pct}%`} valueClass={pctClass(mesStats.pct)} />
                <Chip label="Médicos" value={audsMensual.length.toString()} />
              </div>

              <GlassCard className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <Th left>Médico</Th>
                      <Th>HCs</Th>
                      <Th>Desvíos</Th>
                      <Th>%</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {audsMensual.map(a => {
                      const hcCount = a.historias_clinicas.length;
                      const dev = a.historias_clinicas.filter(h => h.correccion !== '-').length;
                      const pct = hcCount > 0 ? parseFloat((dev / hcCount * 100).toFixed(1)) : 0;
                      return (
                        <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                          <Td left>{a.medico.apellido}, {a.medico.nombre}</Td>
                          <Td>{hcCount}</Td>
                          <Td>{dev}</Td>
                          <Td><PctBadge pct={pct} /></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {audsMensual.length > 1 && (
                    <tfoot>
                      <tr className="border-t border-primary/25">
                        <Td left bold>Total</Td>
                        <Td bold>{mesStats.total}</Td>
                        <Td bold>{mesStats.desvios}</Td>
                        <Td><PctBadge pct={mesStats.pct} /></Td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </GlassCard>
            </>
          )}
        </section>
      )}

      {/* ══════ TAB 2 — TRIMESTRAL ══════ */}
      {tab === 'trimestral' && (
        <section>
          <div className="flex gap-3 mb-6 flex-wrap">
            <select value={quarterSelec} onChange={e => setQuarterSelec(Number(e.target.value))} className={selectCls}>
              {QUARTER_LABELS.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
            </select>
            <select value={anioTrim} onChange={e => setAnioTrim(Number(e.target.value))} className={selectCls}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={fetchTrimestral} className={buscarCls}>Buscar</button>
          </div>

          {loadingTrim ? <LoadingSkeleton /> : audsTrimActual.length === 0 ? (
            <EmptyState msg={`Sin auditorías completas en el ${QUARTER_LABELS[quarterSelec - 1]} ${anioTrim}.`} />
          ) : (
            <>
              <div className="flex gap-2.5 flex-wrap mb-2">
                <Chip label="HCs totales" value={trimStats.total.toString()} />
                <Chip label="Desvíos" value={trimStats.desvios.toString()} />
                <Chip label="Tasa" value={`${trimStats.pct}%`} valueClass={pctClass(trimStats.pct)} />
              </div>
              {prevStats.total > 0 && (
                <p className="text-xs text-text-secondary mb-5">
                  Trimestre anterior:{' '}
                  <span className={pctClass(prevStats.pct)}>{prevStats.pct}%</span>
                  {' '}de desvíos ({prevStats.desvios}/{prevStats.total} HCs)
                </p>
              )}

              <GlassCard className="overflow-hidden mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <Th left>Médico</Th>
                      <Th>HCs</Th>
                      <Th>Desvíos</Th>
                      <Th>%</Th>
                      <Th>vs trim. ant.</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {trimByMedico.map(r => (
                      <tr key={r.medico.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <Td left>{r.medico.apellido}, {r.medico.nombre}</Td>
                        <Td>{r.hcs}</Td>
                        <Td>{r.desvios}</Td>
                        <Td><PctBadge pct={r.pct} /></Td>
                        <Td><DiffBadge diff={r.diff} /></Td>
                      </tr>
                    ))}
                  </tbody>
                  {trimByMedico.length > 1 && (
                    <tfoot>
                      <tr className="border-t border-primary/25">
                        <Td left bold>Total</Td>
                        <Td bold>{trimStats.total}</Td>
                        <Td bold>{trimStats.desvios}</Td>
                        <Td><PctBadge pct={trimStats.pct} /></Td>
                        <Td>
                          <DiffBadge
                            diff={prevStats.total > 0
                              ? parseFloat((trimStats.pct - prevStats.pct).toFixed(1))
                              : null
                            }
                          />
                        </Td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </GlassCard>

              <button
                onClick={handleExportTrimestral}
                disabled={exportingTrim}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 text-sm font-medium transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exportingTrim
                  ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
                  : <><FileText size={15} /> Exportar Resumen Trimestral (Word)</>
                }
              </button>
            </>
          )}
        </section>
      )}

      {/* ══════ TAB 3 — ESTADÍSTICAS ══════ */}
      {tab === 'estadisticas' && (
        <section>
          {loadingStats ? <LoadingSkeleton rows={6} /> : audsStats.length === 0 ? (
            <EmptyState msg="Sin datos de auditorías completas en los últimos 12 meses." />
          ) : (
            <>
              {/* Heatmap */}
              <GlassCard className="p-5 md:p-6 mb-6">
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest mb-5">
                  Heatmap · % desvíos · médico × mes · últimos 12 meses
                </p>
                <Heatmap auds={audsStats} months={last12} />
                <div className="flex items-center gap-5 mt-4 flex-wrap text-[11px] text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-500/40 inline-block" /> 0%
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/40 inline-block" /> 1–15%
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500/40 inline-block" /> &gt;15%
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-white/5 inline-block" /> Sin datos
                  </div>
                </div>
              </GlassCard>

              {/* Ranking */}
              {ranking.length > 0 && (
                <GlassCard className="p-5 md:p-6">
                  <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest mb-5">
                    Ranking · tasa de desvíos acumulada · últimos 12 meses
                  </p>
                  <div className="space-y-4">
                    {ranking.map((r, i) => (
                      <div key={r.medico.id} className="flex items-center gap-3">
                        <span className="text-xs text-text-secondary tabular-nums w-5 flex-shrink-0 text-right">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-foreground font-medium truncate pr-3">
                              {r.medico.apellido}, {r.medico.nombre}
                            </span>
                            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-text-secondary">
                              <span>{r.desvios}/{r.hcs} HC</span>
                              <PctBadge pct={r.pct} />
                            </div>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                r.pct === 0 ? 'bg-emerald-400'
                                : r.pct < 15 ? 'bg-amber-400'
                                : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(r.pct * 3, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

/* ═══════════════════════════ SUB-COMPONENTS ═══════════════════════════ */

function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative p-[1px] bg-gradient-to-br from-primary/30 to-tertiary/20 rounded-[24px]">
      <div className={`bg-neutral/90 backdrop-blur-md rounded-[23px] border-[0.8px] border-white/5 ${className}`}>
        {children}
      </div>
    </div>
  );
}

function Th({ children, left }: { children: ReactNode; left?: boolean }) {
  return (
    <th className={`${left ? 'text-left px-5' : 'text-right px-4'} text-[11px] text-text-secondary font-semibold uppercase tracking-widest py-3`}>
      {children}
    </th>
  );
}

function Td({ children, left, bold }: { children: ReactNode; left?: boolean; bold?: boolean }) {
  return (
    <td className={`${left ? 'px-5 text-foreground' : 'px-4 text-right'} py-3 ${bold ? 'font-semibold text-foreground tabular-nums' : ''}`}>
      {children}
    </td>
  );
}

function PctBadge({ pct }: { pct: number }) {
  return <span className={`tabular-nums font-semibold ${pctClass(pct)}`}>{pct.toFixed(1)}%</span>;
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-text-secondary text-xs">—</span>;
  if (diff === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-text-secondary">
      <Minus size={11} />0.0 pp
    </span>
  );
  if (diff > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-400">
      <TrendingUp size={11} />+{diff.toFixed(1)} pp
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-emerald-400">
      <TrendingDown size={11} />{diff.toFixed(1)} pp
    </span>
  );
}

function Chip({ label, value, valueClass = 'text-foreground' }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-3 mb-2">
        <div className="h-10 w-36 bg-white/5 rounded-xl" />
        <div className="h-10 w-24 bg-white/5 rounded-xl" />
        <div className="h-10 w-20 bg-white/5 rounded-xl" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 bg-white/5 rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="py-16 text-center text-text-secondary text-sm surface-elevated rounded-[24px]">
      {msg}
    </div>
  );
}

function Heatmap({ auds, months }: { auds: AudFull[]; months: string[] }) {
  const medicosMap = new Map<string, Medico>();
  auds.forEach(a => medicosMap.set(a.medico_id, a.medico));
  const medicos = Array.from(medicosMap.values());
  if (medicos.length === 0) return null;

  // Flatten cells into a single CSS grid (no 'contents' needed)
  const cols = months.length;

  const headerCells = [
    <div key="corner" />,
    ...months.map(m => (
      <div key={`h-${m}`} className="text-center text-[10px] text-text-secondary py-1">
        {formatMesShort(m)}
      </div>
    )),
  ];

  const dataCells = medicos.flatMap(med => [
    <div key={`label-${med.id}`} className="text-xs text-foreground py-1 pr-2 truncate self-center">
      {med.apellido}
    </div>,
    ...months.map(m => {
      const aud = auds.find(a => a.medico_id === med.id && a.mes === m);
      if (!aud) {
        return (
          <div key={`${med.id}-${m}`} className="h-9 rounded-lg bg-white/5 flex items-center justify-center">
            <span className="text-[10px] text-text-secondary/40">—</span>
          </div>
        );
      }
      const hcCount = aud.historias_clinicas.length;
      const dev = aud.historias_clinicas.filter(h => h.correccion !== '-').length;
      const pct = hcCount > 0 ? dev / hcCount * 100 : 0;
      const cls = pct === 0
        ? 'bg-emerald-500/35 text-emerald-300'
        : pct < 15 ? 'bg-amber-500/35 text-amber-300'
        : 'bg-red-500/35 text-red-300';
      return (
        <div
          key={`${med.id}-${m}`}
          className={`h-9 rounded-lg flex items-center justify-center ${cls}`}
          title={`${pct.toFixed(1)}%`}
        >
          <span className="text-[11px] font-semibold">{pct.toFixed(0)}%</span>
        </div>
      );
    }),
  ]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `148px repeat(${cols}, minmax(50px, 1fr))`, minWidth: `${148 + cols * 54}px` }}
      >
        {headerCells}
        {dataCells}
      </div>
    </div>
  );
}
