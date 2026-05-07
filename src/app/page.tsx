'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { Plus, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';

type AudFull = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };

const CHART_COLORS = ['#D71921', '#5B9BF6', '#4A9E5C', '#D4A843', '#999999', '#666666', '#333333'];

function getLast6MonthStarts(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
}

function getQuarterBounds(date: Date) {
  const q = Math.floor(date.getMonth() / 3);
  const year = date.getFullYear();
  const startMonth = q * 3;
  const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, startMonth + 3, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
  const labels = ['1ER TRIM.', '2DO TRIM.', '3ER TRIM.', '4TO TRIM.'];
  return { start, end, label: labels[q] };
}

function formatMesShort(mesStr: string) {
  const [y, m] = mesStr.split('-');
  return `${MESES_ES[parseInt(m) - 1].slice(0, 3).toUpperCase()} '${y.slice(2)}`;
}

function calcStats(auds: AudFull[]) {
  const hcs = auds.flatMap(a => a.historias_clinicas);
  const total = hcs.length;
  const desvios = hcs.filter(h => h.correccion !== '-').length;
  const pct = total > 0 ? parseFloat((desvios / total * 100).toFixed(1)) : 0;
  return { total, desvios, pct };
}

function pctColor(pct: number) {
  if (pct === 0) return 'text-success';
  if (pct < 15) return 'text-warning';
  return 'text-accent';
}

/* ── Small components ── */

function Divider() {
  return <div className="border-t border-nd-border" />;
}

function StatCard({ label, value, sub, valueClass = 'text-text-display' }: {
  label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-6 py-5">
      <p className={`nd-hero text-5xl ${valueClass}`}>{value}</p>
      <p className="nd-label">{label}</p>
      <p className="font-mono text-[11px] text-text-disabled">{sub}</p>
    </div>
  );
}

function TrimRow({ label, value, valueClass = 'text-text-primary' }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-nd-border last:border-0">
      <span className="nd-label">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/* ── Page ── */

export default function DashboardPage() {
  const { theme } = useTheme();
  const [auditorias, setAuditorias] = useState<AudFull[]>([]);
  const [totalActivos, setTotalActivos] = useState(0);
  const [loading, setLoading] = useState(true);

  const now = useMemo(() => new Date(), []);
  const currentMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const quarter = useMemo(() => getQuarterBounds(now), [now]);
  const last6 = useMemo(() => getLast6MonthStarts(), []);

  useEffect(() => {
    async function fetchAll() {
      const [{ data: auds }, { count }] = await Promise.all([
        supabase
          .from('auditorias')
          .select('*, medico:medicos(*), historias_clinicas(*)')
          .eq('completada', true)
          .gte('mes', last6[0])
          .order('mes', { ascending: true }),
        supabase.from('medicos').select('*', { count: 'exact', head: true }).eq('activo', true),
      ]);
      if (auds) setAuditorias(auds as AudFull[]);
      setTotalActivos(count ?? 0);
      setLoading(false);
    }
    fetchAll();
  }, [last6]);

  const meActual = useMemo(
    () => auditorias.filter(a => a.mes === currentMes),
    [auditorias, currentMes]
  );
  const trimestre = useMemo(
    () => auditorias.filter(a => a.mes >= quarter.start && a.mes < quarter.end),
    [auditorias, quarter]
  );

  const mesStats = calcStats(meActual);
  const trimStats = calcStats(trimestre);

  const { chartData, medicoNames } = useMemo(() => {
    const medicoMap = new Map<string, string>();
    auditorias.forEach(a => medicoMap.set(a.medico_id, a.medico.apellido));
    const names = Array.from(medicoMap.values());

    const data = last6.map(mesStart => {
      const row: Record<string, string | number | null> = { label: formatMesShort(mesStart) };
      medicoMap.forEach((nombre, medicoId) => {
        const aud = auditorias.find(a => a.mes === mesStart && a.medico_id === medicoId);
        if (aud) {
          const hcCount = aud.historias_clinicas.length;
          const dev = aud.historias_clinicas.filter(h => h.correccion !== '-').length;
          row[nombre] = hcCount > 0 ? parseFloat((dev / hcCount * 100).toFixed(1)) : 0;
        } else {
          row[nombre] = null;
        }
      });
      return row;
    });
    return { chartData: data, medicoNames: names };
  }, [auditorias, last6]);

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <p className="nd-label animate-pulse">[CARGANDO...]</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-6 pt-8 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">
            Dashboard
          </h1>
          <p className="nd-label mt-1">
            {MESES_ES[now.getMonth()].toUpperCase()} {now.getFullYear()}
            <span className="mx-2 opacity-30">·</span>
            {quarter.label} {now.getFullYear()}
          </p>
        </div>
        <Link
          href="/auditorias/nueva"
          className="hidden md:flex items-center gap-2 h-9 px-5 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.06em] hover:bg-text-primary transition-all shadow-lg active:scale-95"
        >
          <Plus size={13} strokeWidth={2.5} />
          NUEVA AUDITORÍA
        </Link>
      </div>

      <Divider />

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-nd-border">
        <StatCard
          label="HCS DEL MES"
          value={mesStats.total === 0 ? '—' : String(mesStats.total)}
          sub={meActual.length === 0 ? 'Sin auditorías completas' : `${meActual.length} auditoría${meActual.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="TASA DE DESVÍOS"
          value={mesStats.total === 0 ? '—' : `${mesStats.pct}%`}
          sub={mesStats.total > 0 ? `${mesStats.desvios} de ${mesStats.total} HCs` : 'Sin datos este mes'}
          valueClass={mesStats.total === 0 ? 'text-text-display' : pctColor(mesStats.pct)}
        />
        <StatCard
          label="MÉDICOS AUDITADOS"
          value={`${meActual.length} / ${totalActivos}`}
          sub={
            totalActivos === 0 ? 'Sin médicos activos'
            : meActual.length >= totalActivos ? 'Todos completados'
            : `Faltan ${totalActivos - meActual.length}`
          }
          valueClass={meActual.length > 0 && meActual.length >= totalActivos ? 'text-success' : 'text-text-display'}
        />
      </div>

      <Divider />

      {/* ── Chart ── */}
      {medicoNames.length > 0 && (
        <>
          <div className="px-6 pt-6 pb-2">
            <p className="nd-label mb-5">EVOLUCIÓN MENSUAL — % DESVÍOS POR MÉDICO</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 0, right: 8, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={theme === 'dark' ? '#1A1A1A' : '#E5E5E5'} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: theme === 'dark' ? '#666666' : '#999999', fontSize: 10, fontFamily: 'Space Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: theme === 'dark' ? '#666666' : '#999999', fontSize: 10, fontFamily: 'Space Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    background: theme === 'dark' ? '#111111' : '#FFFFFF',
                    border: theme === 'dark' ? '1px solid #333333' : '1px solid #E5E5E5',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'Space Mono',
                    color: theme === 'dark' ? '#E8E8E8' : '#111111',
                  }}
                  formatter={(v) => (v == null ? 'Sin datos' : `${v}%`)}
                  labelStyle={{ color: '#666666', marginBottom: '4px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'Space Mono', paddingTop: '12px', color: '#666666' }} />
                {medicoNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={1.5}
                    dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Divider />
        </>
      )}

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] divide-y lg:divide-y-0 lg:divide-x divide-nd-border">

        {/* Tabla mes */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="nd-label">{MESES_ES[now.getMonth()].toUpperCase()} {now.getFullYear()} — POR MÉDICO</p>
            <Link href="/auditorias" className="font-mono text-[10px] tracking-wider text-interactive flex items-center gap-0.5 hover:text-text-primary transition-colors">
              VER TODAS <ChevronRight size={11} />
            </Link>
          </div>

          {meActual.length === 0 ? (
            <div className="py-8">
              <p className="font-mono text-[11px] text-text-disabled">Sin auditorías completas este mes.</p>
              <Link href="/auditorias/nueva" className="font-mono text-[11px] text-interactive mt-1 inline-block hover:underline">
                INICIAR PRIMERA →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nd-border">
                  {['MÉDICO', 'HCS', 'DEV.', '%'].map((h, i) => (
                    <th key={h} className={`${i === 0 ? 'text-left' : 'text-right'} nd-label py-2 ${i > 0 ? 'pl-4' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meActual.map(a => {
                  const hcCount = a.historias_clinicas.length;
                  const dev = a.historias_clinicas.filter(h => h.correccion !== '-').length;
                  const pct = hcCount > 0 ? parseFloat((dev / hcCount * 100).toFixed(1)) : 0;
                  return (
                    <tr key={a.id} className="border-b border-nd-border last:border-0 hover:bg-surface-raised transition-colors group">
                      <td className="py-2.5 text-text-primary">
                        <Link href={`/auditorias/${a.id}`} className="group-hover:text-text-display transition-colors">
                          {a.medico.apellido}, {a.medico.nombre}
                        </Link>
                      </td>
                      <td className="py-2.5 pl-4 text-right font-mono text-xs tabular-nums text-text-secondary">{hcCount}</td>
                      <td className="py-2.5 pl-4 text-right font-mono text-xs tabular-nums text-text-secondary">{dev}</td>
                      <td className="py-2.5 pl-4 text-right">
                        <span className={`font-mono text-xs tabular-nums font-bold ${pctColor(pct)}`}>{pct.toFixed(1)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {meActual.length > 1 && (
                <tfoot>
                  <tr className="border-t border-nd-border-vis">
                    <td className="py-2 nd-label">TOTAL</td>
                    <td className="py-2 pl-4 text-right font-mono text-xs tabular-nums font-bold text-text-primary">{mesStats.total}</td>
                    <td className="py-2 pl-4 text-right font-mono text-xs tabular-nums font-bold text-text-primary">{mesStats.desvios}</td>
                    <td className="py-2 pl-4 text-right">
                      <span className={`font-mono text-xs tabular-nums font-bold ${pctColor(mesStats.pct)}`}>{mesStats.pct}%</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Trimestre */}
        <div className="px-6 py-6">
          <p className="nd-label mb-4">{quarter.label} {now.getFullYear()}</p>
          {trimestre.length === 0 ? (
            <p className="font-mono text-[11px] text-text-disabled">Sin datos para este trimestre.</p>
          ) : (
            <div>
              <TrimRow label="HCS AUDITADAS" value={String(trimStats.total)} />
              <TrimRow label="DESVÍOS" value={String(trimStats.desvios)} />
              <TrimRow
                label="TASA"
                value={`${trimStats.pct}%`}
                valueClass={pctColor(trimStats.pct)}
              />
              <TrimRow label="AUDITORÍAS" value={`${trimestre.length} COMPL.`} />
            </div>
          )}
          <Link
            href="/reportes"
            className="mt-4 font-mono text-[10px] tracking-wider text-interactive flex items-center gap-0.5 hover:text-text-primary transition-colors"
          >
            VER REPORTES <ChevronRight size={11} />
          </Link>
        </div>
      </div>

      <Divider />

    </div>
  );
}
