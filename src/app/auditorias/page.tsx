'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { Plus, CheckCircle2, Clock, ChevronRight, Filter } from 'lucide-react';

type AuditoriaRow = Auditoria & {
  medico: Medico;
  historias_clinicas: HistoriaClinica[];
};

function getMesLabel(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_ES[parseInt(m) - 1]} ${y}`;
}

export default function AuditoriasPage() {
  const [auditorias, setAuditorias] = useState<AuditoriaRow[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMes, setFilterMes] = useState('');
  const [filterMedicoId, setFilterMedicoId] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: audData }, { data: medData }] = await Promise.all([
      supabase
        .from('auditorias')
        .select('*, medico:medicos(*), historias_clinicas(*)')
        .order('mes', { ascending: false }),
      supabase
        .from('medicos')
        .select('*')
        .order('apellido'),
    ]);
    if (audData) setAuditorias(audData as AuditoriaRow[]);
    if (medData) setMedicos(medData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = auditorias.filter(a => {
    const mesMatch = !filterMes || a.mes.startsWith(filterMes);
    const medicoMatch = !filterMedicoId || a.medico_id === filterMedicoId;
    return mesMatch && medicoMatch;
  });

  const mesesDisponibles = [...new Set(auditorias.map(a => a.mes.slice(0, 7)))]
    .sort()
    .reverse();

  return (
    <div className="p-6 md:p-padding max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Auditorías</h1>
          {!loading && (
            <p className="text-sm text-text-secondary mt-1">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/auditorias/nueva"
          className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-4 py-2.5 rounded-[14px] shadow-glow transition-all active:scale-95 font-medium text-sm"
        >
          <Plus size={17} />
          <span>Nueva</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[150px]">
          <Filter size={14} className="text-text-secondary flex-shrink-0" />
          <select
            value={filterMes}
            onChange={e => setFilterMes(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
          >
            <option value="">Todos los meses</option>
            {mesesDisponibles.map(m => {
              const [y, mon] = m.split('-');
              return (
                <option key={m} value={m}>
                  {MESES_ES[parseInt(mon) - 1]} {y}
                </option>
              );
            })}
          </select>
        </div>

        <select
          value={filterMedicoId}
          onChange={e => setFilterMedicoId(e.target.value)}
          className="flex-1 min-w-[170px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="">Todos los médicos</option>
          {medicos.map(m => (
            <option key={m.id} value={m.id}>
              {m.apellido}, {m.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="surface-elevated rounded-xl p-4 animate-pulse flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-3 bg-white/5 rounded w-1/5" />
              </div>
              <div className="w-14 h-5 bg-white/10 rounded w-1/6" />
              <div className="w-20 h-6 bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-elevated rounded-xl py-14 text-center text-text-secondary">
          <p className="mb-2 text-sm">
            {auditorias.length === 0 ? 'Todavía no hay auditorías.' : 'Sin resultados para esos filtros.'}
          </p>
          {auditorias.length === 0 && (
            <Link href="/auditorias/nueva" className="text-primary hover:underline text-sm">
              Crear la primera
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(a => {
            const hcCount = a.historias_clinicas.length;
            const desvios = a.historias_clinicas.filter(h => h.correccion !== '-').length;
            const pct = hcCount > 0 ? ((desvios / hcCount) * 100).toFixed(1) : '0.0';
            return (
              <li key={a.id}>
                <Link
                  href={`/auditorias/${a.id}`}
                  className="surface-elevated rounded-xl px-4 py-3.5 flex items-center gap-4 hover:bg-white/5 transition-colors group"
                >
                  {/* Médico + mes */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {a.medico.apellido}, {a.medico.nombre}
                    </p>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {getMesLabel(a.mes)}
                    </p>
                  </div>

                  {/* Stats - desktop */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-sm text-foreground font-medium tabular-nums">{hcCount}/20 HC</p>
                    {hcCount > 0 && (
                      <p className="text-xs text-text-secondary">
                        {desvios} desvío{desvios !== 1 ? 's' : ''} ({pct}%)
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                    a.completada
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {a.completada
                      ? <><CheckCircle2 size={11} /> Completa</>
                      : <><Clock size={11} /> En curso</>
                    }
                  </div>

                  <ChevronRight
                    size={16}
                    className="text-text-secondary group-hover:text-foreground transition-colors flex-shrink-0"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
