'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Medico } from '@/types';
import { Plus, Pencil, UserCheck, UserX, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

type ModalMode = 'add' | 'edit' | null;

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

/* ── Shared input style ── */
const inputCls = 'w-full bg-transparent border-b border-[#333333] px-0 py-2 text-text-primary placeholder:text-text-disabled font-mono text-sm focus:outline-none focus:border-text-primary transition-colors';
const labelCls = 'nd-label block mb-2';

/* ── Row component ── */
interface MedicoRowProps {
  medico: Medico;
  isFirst: boolean;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
  variant: 'active' | 'inactive';
}

function MedicoRow({ medico, isFirst, toggling, onEdit, onToggle, variant }: MedicoRowProps) {
  const isActive = variant === 'active';
  return (
    <li className={`flex items-center gap-4 px-6 py-3.5 hover:bg-surface-raised transition-colors ${!isFirst ? 'border-t border-[#1A1A1A]' : ''}`}>
      {/* Initials */}
      <span className={`font-mono text-xs tabular-nums w-7 ${isActive ? 'text-text-secondary' : 'text-text-disabled'}`}>
        {getInitials(medico.nombre, medico.apellido)}
      </span>

      {/* Name */}
      <p className={`flex-1 min-w-0 text-sm truncate ${isActive ? 'text-text-primary' : 'text-text-disabled line-through decoration-[#333333]'}`}>
        {medico.apellido}, {medico.nombre}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          title="Editar"
          className="p-2 text-text-disabled hover:text-text-primary transition-colors"
        >
          <Pencil size={13} strokeWidth={1.5} />
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          title={isActive ? 'Desactivar' : 'Reactivar'}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full font-mono text-[10px] tracking-[0.05em] transition-colors disabled:opacity-40 ${
            isActive
              ? 'border-[#333333] text-text-secondary hover:border-accent hover:text-accent'
              : 'border-[#222222] text-text-disabled hover:border-success hover:text-success'
          }`}
        >
          {toggling ? (
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
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingMedico, setEditingMedico] = useState<Medico | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formApellido, setFormApellido] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showInactivos, setShowInactivos] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchMedicos = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('medicos')
      .select('*')
      .order('apellido', { ascending: true })
      .order('nombre', { ascending: true });
    if (error) setFetchError('No se pudieron cargar los médicos.');
    else setMedicos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMedicos(); }, [fetchMedicos]);

  const openAddModal = () => {
    setFormNombre(''); setFormApellido('');
    setFormError(null); setEditingMedico(null);
    setModalMode('add');
  };

  const openEditModal = (m: Medico) => {
    setFormNombre(m.nombre); setFormApellido(m.apellido);
    setFormError(null); setEditingMedico(m);
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditingMedico(null); setFormError(null); };

  const handleSave = async () => {
    const nombre = formNombre.trim();
    const apellido = formApellido.trim();
    if (!nombre || !apellido) { setFormError('Nombre y apellido son requeridos.'); return; }
    setSaving(true); setFormError(null);
    if (modalMode === 'add') {
      const { error } = await supabase.from('medicos').insert({ nombre, apellido, activo: true });
      if (error) setFormError('No se pudo guardar.');
      else { closeModal(); fetchMedicos(); }
    } else if (modalMode === 'edit' && editingMedico) {
      const { error } = await supabase.from('medicos').update({ nombre, apellido }).eq('id', editingMedico.id);
      if (error) setFormError('No se pudo actualizar.');
      else { closeModal(); fetchMedicos(); }
    }
    setSaving(false);
  };

  const handleToggleActivo = async (medico: Medico) => {
    setTogglingId(medico.id);
    setMedicos(prev => prev.map(m => m.id === medico.id ? { ...m, activo: !m.activo } : m));
    const { error } = await supabase.from('medicos').update({ activo: !medico.activo }).eq('id', medico.id);
    if (error) setMedicos(prev => prev.map(m => m.id === medico.id ? { ...m, activo: medico.activo } : m));
    setTogglingId(null);
  };

  const activos = medicos.filter(m => m.activo);
  const inactivos = medicos.filter(m => !m.activo);

  return (
    <div className="max-w-2xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-8 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Médicos</h1>
          {!loading && (
            <p className="nd-label mt-1">{activos.length} ACTIVO{activos.length !== 1 ? 'S' : ''}</p>
          )}
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 h-9 px-5 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.06em] hover:bg-text-primary transition-colors"
        >
          <Plus size={13} strokeWidth={2.5} />
          AGREGAR
        </button>
      </div>

      <div className="border-t border-[#222222]" />

      {/* Error */}
      {fetchError && (
        <div className="mx-6 mt-4 px-4 py-3 border border-accent/40 rounded-lg font-mono text-xs text-accent flex justify-between">
          <span>[ERROR] {fetchError}</span>
          <button onClick={fetchMedicos} className="underline">REINTENTAR</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="px-6 py-8">
          <p className="nd-label animate-pulse">[CARGANDO...]</p>
        </div>
      )}

      {/* Activos */}
      {!loading && (
        <div>
          <div className="px-6 py-3 flex items-center gap-2 border-b border-[#222222]">
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
                  toggling={togglingId === m.id}
                  onEdit={() => openEditModal(m)}
                  onToggle={() => handleToggleActivo(m)}
                  variant="active"
                />
              ))}
            </ul>
          )}

          {/* Inactivos */}
          {inactivos.length > 0 && (
            <>
              <div className="border-t border-[#222222]" />
              <button
                onClick={() => setShowInactivos(v => !v)}
                className="w-full px-6 py-3 flex items-center gap-2 border-b border-[#222222] hover:bg-surface-raised transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#444444] inline-block" />
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
                      toggling={togglingId === m.id}
                      onEdit={() => openEditModal(m)}
                      onToggle={() => handleToggleActivo(m)}
                      variant="inactive"
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
          <div className="absolute inset-0 bg-black/85" onClick={closeModal} />
          <div className="relative w-full max-w-sm bg-surface border border-[#333333] rounded-xl p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <span className="nd-label">{modalMode === 'add' ? 'AGREGAR MÉDICO' : 'EDITAR MÉDICO'}</span>
              <button onClick={closeModal} className="font-mono text-[11px] text-text-disabled hover:text-text-primary">
                [X]
              </button>
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
              {formError && (
                <p className="font-mono text-[11px] text-accent">[ERROR] {formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={closeModal}
                className="flex-1 h-10 border border-[#333333] rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary transition-colors">
                CANCELAR
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 h-10 bg-text-display text-background rounded-full font-mono text-[11px] tracking-wider hover:bg-text-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={13} className="animate-spin" />GUARDANDO</> : 'GUARDAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
