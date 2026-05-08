'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { Plus, ChevronRight, CheckCircle2, Clock, Trash2, Pencil, Loader2, AlertCircle, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type AuditoriaRow = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };

function getMesLabel(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_ES[parseInt(m) - 1].toUpperCase()} ${y}`;
}

export default function AuditoriasPage() {
  const queryClient = useQueryClient();
  const [filterMes, setFilterMes] = useState('');
  const [filterMedicoId, setFilterMedicoId] = useState('');
  
  // State for editing
  const [editingAuditoria, setEditingAuditoria] = useState<AuditoriaRow | null>(null);
  const [editMedicoId, setEditMedicoId] = useState('');
  const [editMes, setEditMes] = useState(1);
  const [editAnio, setEditAnio] = useState(new Date().getFullYear());

  const { data: auditorias = [], isLoading: loadingAuds } = useQuery({
    queryKey: ['auditorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('auditorias')
        .select('*, medico:medicos(*), historias_clinicas(*)')
        .order('mes', { ascending: false });
      if (error) throw error;
      return data as AuditoriaRow[];
    }
  });

  const { data: medicos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('medicos').select('*').order('apellido');
      if (error) throw error;
      return data as Medico[];
    }
  });

  const filtered = auditorias.filter(a => {
    const mesMatch = !filterMes || a.mes.startsWith(filterMes);
    const medicoMatch = !filterMedicoId || a.medico_id === filterMedicoId;
    return mesMatch && medicoMatch;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('auditorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditorias'] });
      toast.success('Auditoría eliminada');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Error al eliminar la auditoría');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string, medico_id: string, mes: string }) => {
      const { error } = await supabase.from('auditorias')
        .update({ medico_id: payload.medico_id, mes: payload.mes })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditorias'] });
      toast.success('Auditoría actualizada');
      setEditingAuditoria(null);
    },
    onError: (err: any) => {
      console.error(err);
      if (err.code === '23505') {
        toast.error('Ya existe una auditoría para ese médico en ese mes');
      } else {
        toast.error('Error al actualizar la auditoría');
      }
    }
  });

  const handleEditClick = (e: React.MouseEvent, a: AuditoriaRow) => {
    e.preventDefault();
    e.stopPropagation();
    const [y, m] = a.mes.split('-');
    setEditMedicoId(a.medico_id);
    setEditMes(parseInt(m));
    setEditAnio(parseInt(y));
    setEditingAuditoria(a);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('¿Estás seguro de que querés borrar esta auditoría? Se borrarán todos los registros asociados.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSaveEdit = () => {
    if (!editingAuditoria) return;
    const mesStr = `${editAnio}-${String(editMes).padStart(2, '0')}-01`;
    updateMutation.mutate({
      id: editingAuditoria.id,
      medico_id: editMedicoId,
      mes: mesStr
    });
  };

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  const mesesDisponibles = [...new Set(auditorias.map(a => a.mes.slice(0, 7)))].sort().reverse();

  const selectCls = 'bg-transparent border-b border-nd-border-vis px-0 py-2 font-mono text-[11px] tracking-[0.05em] text-text-secondary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer pr-6';

  const loading = loadingAuds || loadingMeds;

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex items-start justify-between px-6 pt-8 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Auditorías</h1>
          {!loading && (
            <p className="nd-label mt-1">{filtered.length} RESULTADO{filtered.length !== 1 ? 'S' : ''}</p>
          )}
        </div>
        <Link href="/auditorias/nueva"
          className="flex items-center gap-2 h-9 px-5 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.06em] hover:bg-text-primary transition-all shadow-lg active:scale-95">
          <Plus size={13} strokeWidth={2.5} />NUEVA
        </Link>
      </div>

      <div className="border-t border-nd-border" />

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

      {loading ? (
        <div className="px-6 py-8"><p className="nd-label animate-pulse">[CARGANDO...]</p></div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-10">
          <p className="font-mono text-[11px] text-text-disabled">
            {auditorias.length === 0 ? 'No hay auditorías registradas.' : 'Sin resultados para esos filtros.'}
          </p>
          {auditorias.length === 0 && (
            <Link href="/auditorias/nueva" className="font-mono text-[11px] text-interactive mt-1 block hover:underline">CREAR LA PRIMERA →</Link>
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
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.completada ? 'bg-success shadow-[0_0_8px_rgba(74,158,92,0.4)]' : 'bg-text-disabled'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary group-hover:text-text-display transition-colors truncate">{a.medico.apellido}, {a.medico.nombre}</p>
                    <p className="nd-label mt-0.5">{getMesLabel(a.mes)}</p>
                  </div>
                  <div className="text-right hidden sm:block flex-shrink-0">
                    <p className="font-mono text-xs text-text-secondary tabular-nums">{hcCount}/20</p>
                    {hcCount > 0 && <p className="font-mono text-[10px] text-text-disabled tabular-nums">{desvios} dev. {pct}%</p>}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 border rounded-full font-mono text-[10px] tracking-[0.04em] flex-shrink-0 transition-colors ${a.completada ? 'border-success/40 text-success bg-success/5' : 'border-nd-border-vis text-text-disabled'}`}>
                    {a.completada ? <><CheckCircle2 size={10} strokeWidth={1.5} />COMPLETA</> : <><Clock size={10} strokeWidth={1.5} />EN CURSO</>}
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEditClick(e, a)}
                      className="p-2 text-text-disabled hover:text-text-primary transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, a.id)}
                      className="p-2 text-text-disabled hover:text-accent transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>

                  <ChevronRight size={14} className="text-text-disabled group-hover:text-text-primary transition-colors flex-shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit Modal */}
      {editingAuditoria && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditingAuditoria(null)} />
          <div className="relative w-full max-w-sm bg-surface border border-nd-border-vis rounded-xl p-6 z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <span className="nd-label">EDITAR AUDITORÍA</span>
              <button onClick={() => setEditingAuditoria(null)} className="text-text-disabled hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Médico */}
              <div>
                <label className="nd-label block mb-2">MÉDICO</label>
                <select 
                  value={editMedicoId} 
                  onChange={e => setEditMedicoId(e.target.value)} 
                  className="w-full bg-transparent border-b border-nd-border-vis px-0 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer"
                >
                  {medicos.map(m => (
                    <option key={m.id} value={m.id} className="bg-surface">{m.apellido}, {m.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Mes + Año */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="nd-label block mb-2">MES</label>
                  <select 
                    value={editMes} 
                    onChange={e => setEditMes(Number(e.target.value))} 
                    className="w-full bg-transparent border-b border-nd-border-vis px-0 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer"
                  >
                    {MESES_ES.map((nombre, i) => (
                      <option key={i + 1} value={i + 1} className="bg-surface">{nombre.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="nd-label block mb-2">AÑO</label>
                  <select 
                    value={editAnio} 
                    onChange={e => setEditAnio(Number(e.target.value))} 
                    className="w-full bg-transparent border-b border-nd-border-vis px-0 py-2 font-mono text-sm text-text-primary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer"
                  >
                    {years.map(y => (
                      <option key={y} value={y} className="bg-surface">{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setEditingAuditoria(null)}
                className="flex-1 h-10 border border-nd-border-vis rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary transition-colors"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleSaveEdit} 
                disabled={updateMutation.isPending}
                className="flex-1 h-10 bg-text-display text-background rounded-full font-mono text-[11px] tracking-wider hover:bg-text-primary transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {updateMutation.isPending ? <><Loader2 size={13} className="animate-spin" />GUARDANDO</> : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
