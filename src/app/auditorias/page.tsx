'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { Plus, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

type AuditoriaRow = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };

function getMesLabel(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_ES[parseInt(m) - 1].toUpperCase()} ${y}`;
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
      supabase.from('auditorias').select('*, medico:medicos(*), historias_clinicas(*)')
        .order('mes', { ascending: false }),
      supabase.from('medicos').select('*').order('apellido'),
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

  const mesesDisponibles = [...new Set(auditorias.map(a => a.mes.slice(0, 7)))].sort().reverse();

  const selectCls = 'bg-transparent border-b border-nd-border-vis px-0 py-2 font-mono text-[11px] tracking-[0.05em] text-text-secondary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer pr-6';

  return (
    <div className="max-w-3xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-8 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Auditorías</h1>
          {!loading && (
            <p className="nd-label mt-1">{filtered.length} RESULTADO{filtered.length !== 1 ? 'S' : ''}</p>
          )}
        </div>
        <Link href="/auditorias/nueva"
          className="flex items-center gap-2 h-9 px-5 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.06em] hover:bg-text-primary transition-all shadow-lg active:scale-95">
          <Plus size={13} strokeWidth={2.5} />
          NUEVA
        </Link>
      </div>

      <div className="border-t border-nd-border" />

      {/* Filters */}
      <div className="px-6 py-4 flex gap-6 border-b border-nd-border overflow-x-auto">
        <div className="relative flex-1 min-w-[140px]">
          <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className={selectCls}>
            <option value="" className="bg-surface">TODOS LOS MESES</option>
            {mesesDisponibles.map(m => {
              const [y, mon] = m.split('-');
              return <option key={m} value={m} className="bg-surface">{MESES_ES[parseInt(mon) - 1].toUpperCase()} {y}</option>;
            })}
          </select>
        </div>
        <div className="relative flex-1 min-w-[140px]">
          <select value={filterMedicoId} onChange={e => setFilterMedicoId(e.target.value)} className={selectCls}>
            <option value="" className="bg-surface">TODOS LOS MÉDICOS</option>
            {medicos.map(m => <option key={m.id} value={m.id} className="bg-surface">{m.apellido}, {m.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="px-6 py-8">
          <p className="nd-label animate-pulse">[CARGANDO...]</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-10">
          <p className="font-mono text-[11px] text-text-disabled">
            {auditorias.length === 0 ? 'No hay auditorías registradas.' : 'Sin resultados para esos filtros.'}
          </p>
          {auditorias.length === 0 && (
            <Link href="/auditorias/nueva" className="font-mono text-[11px] text-interactive mt-1 block hover:underline">
              CREAR LA PRIMERA →
            </Link>
          )}
        </div>
      ) : (
        <ul className="bg-surface divide-y divide-nd-border">
          {filtered.map((a) => {
            const hcCount = a.historias_clinicas.length;
            const desvios = a.historias_clinicas.filter(h => h.correccion !== '-').length;
            const pct = hcCount > 0 ? (desvios / hcCount * 100).toFixed(1) : '0.0';
            return (
              <li key={a.id}>
                <Link href={`/auditorias/${a.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-surface-raised transition-all group">
                  {/* Status dot */}
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.completada ? 'bg-success shadow-[0_0_8px_rgba(74,158,92,0.4)]' : 'bg-text-disabled'}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary group-hover:text-text-display transition-colors truncate">
                      {a.medico.apellido}, {a.medico.nombre}
                    </p>
                    <p className="nd-label mt-0.5">{getMesLabel(a.mes)}</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right hidden sm:block flex-shrink-0">
                    <p className="font-mono text-xs text-text-secondary tabular-nums">{hcCount}/20</p>
                    {hcCount > 0 && (
                      <p className="font-mono text-[10px] text-text-disabled tabular-nums">{desvios} dev. {pct}%</p>
                    )}
                  </div>

                  {/* Badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1 border rounded-full font-mono text-[10px] tracking-[0.04em] flex-shrink-0 transition-colors ${
                    a.completada
                      ? 'border-success/40 text-success bg-success/5'
                      : 'border-nd-border-vis text-text-disabled'
                  }`}>
                    {a.completada
                      ? <><CheckCircle2 size={10} strokeWidth={1.5} />COMPLETA</>
                      : <><Clock size={10} strokeWidth={1.5} />EN CURSO</>
                    }
                  </div>

                  <ChevronRight size={14} className="text-text-disabled group-hover:text-text-primary transition-colors flex-shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
