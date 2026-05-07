'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Medico } from '@/types';
import { Plus, Pencil, UserCheck, UserX, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type ModalMode = 'add' | 'edit' | null;

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

const inputCls = 'w-full bg-transparent border-b border-nd-border-vis px-0 py-2 text-text-primary placeholder:text-text-disabled font-mono text-sm focus:outline-none focus:border-text-primary transition-colors';
const labelCls = 'nd-label block mb-2';

/* ── Row component ── */
interface MedicoRowProps {
  medico: Medico;
  isFirst: boolean;
  onEdit: () => void;
  onToggle: () => void;
  variant: 'active' | 'inactive';
  isToggling: boolean;
}

function MedicoRow({ medico, isFirst, onEdit, onToggle, variant, isToggling }: MedicoRowProps) {
  const isActive = variant === 'active';
  return (
    <li className={`flex items-center gap-4 px-6 py-3.5 hover:bg-surface-raised transition-colors ${!isFirst ? 'border-t border-nd-border' : ''}`}>
      <span className={`font-mono text-xs tabular-nums w-7 ${isActive ? 'text-text-secondary' : 'text-text-disabled'}`}>
        {getInitials(medico.nombre, medico.apellido)}
      </span>
      <p className={`flex-1 min-w-0 text-sm truncate ${isActive ? 'text-text-primary' : 'text-text-disabled line-through decoration-nd-border-vis'}`}>
        {medico.apellido}, {medico.nombre}
      </p>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} title="Editar" className="p-2 text-text-disabled hover:text-text-primary transition-colors">
          <Pencil size={13} strokeWidth={1.5} />
        </button>
        <button
          onClick={onToggle}
          disabled={isToggling}
          title={isActive ? 'Desactivar' : 'Reactivar'}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full font-mono text-[10px] tracking-[0.05em] transition-colors disabled:opacity-40 ${
            isActive
              ? 'border-nd-border-vis text-text-secondary hover:border-accent hover:text-accent'
              : 'border-nd-border text-text-disabled hover:border-success hover:text-success'
          }`}
        >
          {isToggling ? (
            <Loader2 size={11} className="animate-spin" />
          ) : isActive ? (
            <><UserCheck size={11} strokeWidth={1.5} /><span className="hidden sm:inline">ACTIVO</span></>
          ) : (
            <><UserX size={11} strokeWidth={1.5} /><span className="hidden sm:inline">INACTIVO</span></>
          )}
        </button>
      </div>
    </li>
  );
}

/* ── Page ── */

export default function MedicosPage() {
  const queryClient = useQueryClient();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formApellido, setFormApellido] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);

  // Fetch médicos
  const { data: medicos = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['medicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicos')
        .select('*')
        .order('apellido', { ascending: true });
      if (error) throw error;
      return data as Medico[];
    },
  });

  // Mutación para Guardar/Editar
  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; nombre: string; apellido: string }) => {
      if (payload.id) {
        return supabase.from('medicos').update({ nombre: payload.nombre, apellido: payload.apellido }).eq('id', payload.id);
      }
      return supabase.from('medicos').insert({ nombre: payload.nombre, apellido: payload.apellido, activo: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicos'] });
      closeModal();
    },
  });

  // Mutación para Toggle Activo
  const toggleMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      return supabase.from('medicos').update({ activo }).eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicos'] });
    },
  });

  const openAddModal = () => {
    setFormNombre(''); setFormApellido(''); setEditingMedico(null); setModalMode('add');
  };

  const openEditModal = (m: Medico) => {
    setFormNombre(m.nombre); setFormApellido(m.apellido); setEditingMedico(m); setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditingMedico(null); };

  const handleSave = () => {
    const nombre = formNombre.trim();
    const apellido = formApellido.trim();
    if (!nombre || !apellido) return;
    saveMutation.mutate({ id: editingMedico?.id, nombre, apellido });
  };

  const handleToggleActivo = (medico: Medico) => {
    toggleMutation.mutate({ id: medico.id, activo: !medico.activo });
  };

  const activos = medicos.filter(m => m.activo);
  const inactivos = medicos.filter(m => !m.activo);

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-8 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Médicos</h1>
          {!isLoading && (
            <p className="nd-label mt-1">{activos.length} ACTIVO{activos.length !== 1 ? 'S' : ''}</p>
          )}
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 h-9 px-5 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.06em] hover:bg-text-primary transition-all shadow-lg active:scale-95"
        >
          <Plus size={13} strokeWidth={2.5} />
          AGREGAR
        </button>
      </div>

      <div className="border-t border-nd-border" />

      {/* Error */}
      {fetchError && (
        <div className="mx-6 mt-4 px-4 py-3 border border-accent/40 rounded-lg font-mono text-xs text-accent flex justify-between">
          <span>[ERROR] No se pudieron cargar los datos.</span>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['medicos'] })} className="underline">REINTENTAR</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="px-6 py-8">
          <p className="nd-label animate-pulse">[CARGANDO...]</p>
        </div>
      )}

      {/* Activos */}
      {!isLoading && (
        <div className={saveMutation.isPending ? 'opacity-60 pointer-events-none' : ''}>
          <div className="px-6 py-3 flex items-center gap-2 border-b border-nd-border">
            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
            <span className="nd-label">ACTIVOS ({activos.length})</span>
          </div>

          {activos.length === 0 ? (
            <div className="px-6 py-10">
              <p className="font-mono text-[11px] text-text-disabled">No hay médicos activos.</p>
              <button onClick={openAddModal} className="font-mono text-[11px] text-interactive mt-1">
                AGREGAR EL PRIMERO →
              </button>
            </div>
          ) : (
            <ul className="bg-surface">
              {activos.map((m, i) => (
                <MedicoRow key={m.id} medico={m} isFirst={i === 0}
                  onEdit={() => openEditModal(m)}
                  onToggle={() => handleToggleActivo(m)}
                  variant="active"
                  isToggling={toggleMutation.isPending && toggleMutation.variables?.id === m.id}
                />
              ))}
            </ul>
          )}

          {/* Inactivos */}
          {inactivos.length > 0 && (
            <>
              <div className="border-t border-nd-border" />
              <button
                onClick={() => setShowInactivos(v => !v)}
                className="w-full px-6 py-3 flex items-center gap-2 border-b border-nd-border hover:bg-surface-raised transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-text-disabled inline-block" />
                <span className="nd-label">INACTIVOS ({inactivos.length})</span>
                {showInactivos
                  ? <ChevronUp size={12} className="ml-auto text-text-disabled" />
                  : <ChevronDown size={12} className="ml-auto text-text-disabled" />
                }
              </button>
              {showInactivos && (
                <ul className="bg-surface">
                  {inactivos.map((m, i) => (
                    <MedicoRow key={m.id} medico={m} isFirst={i === 0}
                      onEdit={() => openEditModal(m)}
                      onToggle={() => handleToggleActivo(m)}
                      variant="inactive"
                      isToggling={toggleMutation.isPending && toggleMutation.variables?.id === m.id}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-sm bg-surface border border-nd-border-vis rounded-xl p-6 z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <span className="nd-label">{modalMode === 'add' ? 'AGREGAR MÉDICO' : 'EDITAR MÉDICO'}</span>
              <button onClick={closeModal} className="font-mono text-[11px] text-text-disabled hover:text-text-primary">[X]</button>
            </div>
            <div className="space-y-6">
              <div>
                <label className={labelCls}>NOMBRE *</label>
                <input type="text" value={formNombre} onChange={e => setFormNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Juan" autoFocus className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>APELLIDO *</label>
                <input type="text" value={formApellido} onChange={e => setFormApellido(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="García" className={inputCls} />
              </div>
              {saveMutation.isError && (
                <p className="font-mono text-[11px] text-accent">[ERROR] No se pudo guardar.</p>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={closeModal}
                className="flex-1 h-10 border border-nd-border-vis rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary transition-colors">
                CANCELAR
              </button>
              <button onClick={handleSave} disabled={saveMutation.isPending}
                className="flex-1 h-10 bg-text-display text-background rounded-full font-mono text-[11px] tracking-wider hover:bg-text-primary transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {saveMutation.isPending ? <><Loader2 size={13} className="animate-spin" />GUARDANDO</> : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
