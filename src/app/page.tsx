'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { Plus, ClipboardCheck, TrendingUp, Users2, CalendarRange, ChevronRight } from 'lucide-react';

/* ── Types ── */

type AudFull = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };

/* ── Helpers ── */

const CHART_COLORS = ['#6366F1', '#C968F7', '#818CF8', '#34D399', '#F59E0B', '#60A5FA', '#F87171'];

function formatMesShort(mesStr: string) {
  const [y, m] = mesStr.split('-');
  return `${MESES_ES[parseInt(m) - 1].slice(0, 3)} '${y.slice(2)}`;
}

function getQuarterBounds(date: Date) {
  const q = Math.floor(date.getMonth() / 3);
  const year = date.getFullYear();
  const startMonth = q * 3;
  const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endDate = new Date(year, startMonth + 3, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
  const labels = ['1er trimestre', '2do trimestre', '3er trimestre', '4to trimestre'];
  return { start, end, label: `${labels[q]} ${year}` };
}

function getLast6MonthStarts(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
}

function calcStats(auds: AudFull[]) {
  const hcs = auds.flatMap(a => a.historias_clinicas);
  const total = hcs.length;
  const desvios = hcs.filter(h => h.correccion !== '-').length;
  const pct = total > 0 ? (desvios / total * 100).toFixed(1) : '0.0';
  return { total, desvios, pct };
}

/* ── Page ── */

export default function DashboardPage() {
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
        supabase
          .from('medicos')
          .select('*', { count: 'exact', head: true })
          .eq('activo', true),
      ]);
      if (auds) setAuditorias(auds as AudFull[]);
      setTotalActivos(count ?? 0);
      setLoading(false);
    }
    fetchAll();
  }, [last6]);

  /* ── Derived data ── */

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
    const medicoMap = new Map<string, string>(); // id → apellido
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

  /* ── Loading skeleton ── */

  if (loading) {
    return (
      <div className="p-6 md:p-padding max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-10 bg-white/10 rounded-xl w-48" />
            <div className="h-4 bg-white/5 rounded w-32" />
          </div>
          <div className="h-10 w-36 bg-white/10 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="h-32 bg-white/5 rounded-[24px]" />)}
        </div>
        <div className="h-64 bg-white/5 rounded-[24px]" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="h-48 bg-white/5 rounded-[24px]" />
          <div className="h-48 bg-white/5 rounded-[24px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-padding max-w-5xl mx-auto pb-24 md:pb-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[2.6rem] md:text-[3.2rem] leading-none font-light tracking-[-0.04em] text-foreground font-display">
            Dashboard
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            {MESES_ES[now.getMonth()]} {now.getFullYear()}
            <span className="mx-2 opacity-30">·</span>
            {quarter.label}
          </p>
        </div>
        <Link
          href="/auditorias/nueva"
          className="flex-shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-5 py-2.5 rounded-full shadow-glow transition-all active:scale-95 font-medium text-sm"
        >
          <Plus size={17} />
          <span className="hidden sm:inline">Nueva Auditoría</span>
          <span className="sm:hidden">Nueva</span>
        </Link>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="HCs del mes"
          value={mesStats.total === 0 ? '—' : mesStats.total.toString()}
          sub={
            meActual.length === 0
              ? 'Sin auditorías completas'
              : `${meActual.length} auditoría${meActual.length !== 1 ? 's' : ''} completa${meActual.length !== 1 ? 's' : ''}`
          }
          icon={<ClipboardCheck size={18} />}
          iconClass="bg-primary/15 text-primary"
        />
        <StatCard
          label="Tasa de desvíos"
          value={mesStats.total === 0 ? '—' : `${mesStats.pct}%`}
          sub={
            mesStats.total > 0
              ? `${mesStats.desvios} de ${mesStats.total} HCs`
              : 'Sin datos este mes'
          }
          icon={<TrendingUp size={18} />}
          iconClass={
            parseFloat(mesStats.pct) === 0
              ? 'bg-emerald-500/15 text-emerald-400'
              : parseFloat(mesStats.pct) < 15
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-red-500/15 text-red-400'
          }
          valueClass={
            parseFloat(mesStats.pct) === 0
              ? 'text-emerald-400'
              : parseFloat(mesStats.pct) < 15
              ? 'text-amber-400'
              : 'text-red-400'
          }
        />
        <StatCard
          label="Médicos auditados"
          value={`${meActual.length} / ${totalActivos}`}
          sub={
            totalActivos === 0
              ? 'Sin médicos activos'
              : meActual.length >= totalActivos
              ? 'Todos completados ✓'
              : `Faltan ${totalActivos - meActual.length}`
          }
          icon={<Users2 size={18} />}
          iconClass="bg-purple-500/15 text-purple-400"
          valueClass={meActual.length >= totalActivos && totalActivos > 0 ? 'text-emerald-400' : undefined}
        />
      </div>

      {/* ── Line chart ── */}
      {medicoNames.length > 0 && (
        <GlassCard className="mb-8 p-5 md:p-6">
          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest mb-5">
            Evolución mensual · % desvíos por médico · últimos 6 meses
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#737373', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#737373', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}%`}
                domain={[0, 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(17,17,17,0.95)',
                  border: '0.8px solid rgba(99,102,241,0.4)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#E5E5E5',
                  boxShadow: '0 0 10px 0 rgb(129,140,248,0.2)',
                }}
                formatter={(v) => (v == null ? 'Sin datos' : `${v}%`)}
                labelStyle={{ color: '#737373', marginBottom: '4px' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '14px', color: '#737373' }}
              />
              {medicoNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3.5, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* ── Bottom grid: tabla mes + tarjeta trimestral ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-6">

        {/* Tabla mes actual */}
        <GlassCard className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
              {MESES_ES[now.getMonth()]} {now.getFullYear()} — por médico
            </p>
            <Link
              href="/auditorias"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todas <ChevronRight size={11} />
            </Link>
          </div>

          {meActual.length === 0 ? (
            <div className="py-10 text-center text-text-secondary text-sm">
              No hay auditorías completas este mes.
              <br />
              <Link href="/auditorias/nueva" className="text-primary hover:underline mt-2 inline-block text-sm">
                Iniciar la primera
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] text-text-secondary font-semibold uppercase tracking-wider pb-2.5 pr-3">Médico</th>
                  <th className="text-right text-[11px] text-text-secondary font-semibold uppercase tracking-wider pb-2.5 px-2">HCs</th>
                  <th className="text-right text-[11px] text-text-secondary font-semibold uppercase tracking-wider pb-2.5 px-2">Desvíos</th>
                  <th className="text-right text-[11px] text-text-secondary font-semibold uppercase tracking-wider pb-2.5">%</th>
                </tr>
              </thead>
              <tbody>
                {meActual.map(a => {
                  const hcCount = a.historias_clinicas.length;
                  const dev = a.historias_clinicas.filter(h => h.correccion !== '-').length;
                  const pct = hcCount > 0 ? (dev / hcCount * 100).toFixed(1) : '0.0';
                  const pctNum = parseFloat(pct);
                  return (
                    <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                      <td className="py-3 pr-3">
                        <Link href={`/auditorias/${a.id}`} className="text-foreground font-medium group-hover:text-primary transition-colors">
                          {a.medico.apellido}, {a.medico.nombre}
                        </Link>
                      </td>
                      <td className="py-3 px-2 text-right tabular-nums text-text-secondary">{hcCount}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-text-secondary">{dev}</td>
                      <td className="py-3 text-right">
                        <span className={`tabular-nums font-semibold ${
                          pctNum === 0 ? 'text-emerald-400'
                          : pctNum < 15 ? 'text-amber-400'
                          : 'text-red-400'
                        }`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {meActual.length > 1 && (
                <tfoot>
                  <tr className="border-t border-primary/20">
                    <td className="pt-3 pr-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Total</td>
                    <td className="pt-3 px-2 text-right tabular-nums font-semibold text-foreground">{mesStats.total}</td>
                    <td className="pt-3 px-2 text-right tabular-nums font-semibold text-foreground">{mesStats.desvios}</td>
                    <td className="pt-3 text-right">
                      <span className={`tabular-nums font-semibold ${
                        parseFloat(mesStats.pct) === 0 ? 'text-emerald-400'
                        : parseFloat(mesStats.pct) < 15 ? 'text-amber-400'
                        : 'text-red-400'
                      }`}>
                        {mesStats.pct}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </GlassCard>

        {/* Tarjeta trimestral */}
        <div className="relative p-[1px] bg-gradient-to-br from-primary/60 to-tertiary/50 rounded-[24px] shadow-glow">
          <div className="bg-neutral/90 backdrop-blur-md rounded-[23px] p-5 border-[0.8px] border-white/5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-5">
              <CalendarRange size={14} className="text-primary" />
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
                {quarter.label}
              </p>
            </div>

            {trimestre.length === 0 ? (
              <p className="text-text-secondary text-sm flex-1 flex items-center">
                Sin datos para este trimestre aún.
              </p>
            ) : (
              <div className="space-y-3 flex-1">
                <TrimRow label="HCs auditadas" value={trimStats.total.toString()} />
                <TrimRow label="Desvíos" value={trimStats.desvios.toString()} />
                <TrimRow
                  label="Tasa de desvíos"
                  value={`${trimStats.pct}%`}
                  valueClass={
                    parseFloat(trimStats.pct) === 0 ? 'text-emerald-400'
                    : parseFloat(trimStats.pct) < 15 ? 'text-amber-400'
                    : 'text-red-400'
                  }
                />
                <TrimRow label="Auditorías completas" value={trimestre.length.toString()} />
              </div>
            )}

            <Link
              href="/reportes"
              className="mt-5 text-center text-xs text-primary hover:underline flex items-center justify-center gap-1"
            >
              Reportes completos <ChevronRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative p-[1px] bg-gradient-to-br from-primary/30 to-tertiary/20 rounded-[24px]">
      <div className={`bg-neutral/90 backdrop-blur-md rounded-[23px] border-[0.8px] border-white/5 ${className}`}>
        {children}
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, icon, iconClass, valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <GlassCard className="p-5 h-full">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-full mb-4 ${iconClass}`}>
        {icon}
      </div>
      <p className={`text-[2.2rem] font-display font-light tracking-[-0.04em] leading-none ${valueClass ?? 'text-foreground'}`}>
        {value}
      </p>
      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest mt-2.5">{label}</p>
      <p className="text-xs text-text-secondary/60 mt-1">{sub}</p>
    </GlassCard>
  );
}

function TrimRow({ label, value, valueClass = 'text-foreground' }: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
