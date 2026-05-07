'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Medico } from '@/types';
import {
  Plus, Pencil, UserCheck, UserX,
  X, Loader2, ChevronDown, ChevronUp, Stethoscope,
} from 'lucide-react';

type ModalMode = 'add' | 'edit' | null;

function getInitials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

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

    if (error) {
      setFetchError('No se pudieron cargar los médicos. Verificá tu conexión.');
    } else {
      setMedicos(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMedicos(); }, [fetchMedicos]);

  const openAddModal = () => {
    setFormNombre('');
    setFormApellido('');
    setFormError(null);
    setEditingMedico(null);
    setModalMode('add');
  };

  const openEditModal = (medico: Medico) => {
    setFormNombre(medico.nombre);
    setFormApellido(medico.apellido);
    setFormError(null);
    setEditingMedico(medico);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingMedico(null);
    setFormError(null);
  };

  const handleSave = async () => {
    const nombre = formNombre.trim();
    const apellido = formApellido.trim();

    if (!nombre || !apellido) {
      setFormError('Nombre y apellido son requeridos.');
      return;
    }

    setSaving(true);
    setFormError(null);

    if (modalMode === 'add') {
      const { error } = await supabase
        .from('medicos')
        .insert({ nombre, apellido, activo: true });
      if (error) {
        setFormError('No se pudo guardar. Intentá de nuevo.');
      } else {
        closeModal();
        fetchMedicos();
      }
    } else if (modalMode === 'edit' && editingMedico) {
      const { error } = await supabase
        .from('medicos')
        .update({ nombre, apellido })
        .eq('id', editingMedico.id);
      if (error) {
        setFormError('No se pudo actualizar. Intentá de nuevo.');
      } else {
        closeModal();
        fetchMedicos();
      }
    }

    setSaving(false);
  };

  const handleToggleActivo = async (medico: Medico) => {
    setTogglingId(medico.id);
    // Optimistic update
    setMedicos(prev =>
      prev.map(m => m.id === medico.id ? { ...m, activo: !m.activo } : m)
    );

    const { error } = await supabase
      .from('medicos')
      .update({ activo: !medico.activo })
      .eq('id', medico.id);

    if (error) {
      // Revert on failure
      setMedicos(prev =>
        prev.map(m => m.id === medico.id ? { ...m, activo: medico.activo } : m)
      );
    }
    setTogglingId(null);
  };

  const activos = medicos.filter(m => m.activo);
  const inactivos = medicos.filter(m => !m.activo);

  return (
    <div className="p-6 md:p-padding max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Médicos</h1>
          <p className="text-sm text-text-secondary mt-1">
            {loading ? ' ' : `${activos.length} activo${activos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-4 py-2.5 rounded-[14px] shadow-glow transition-all active:scale-95 font-medium text-sm"
        >
          <Plus size={17} />
          <span>Agregar</span>
        </button>
      </div>

      {/* ── Error global ── */}
      {fetchError && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm flex items-center justify-between gap-4">
          <span>{fetchError}</span>
          <button onClick={fetchMedicos} className="underline hover:no-underline whitespace-nowrap">
            Reintentar
          </button>
        </div>
      )}

      {/* ── Skeletons de carga ── */}
      {loading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="surface-elevated rounded-xl p-4 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-2/5" />
              </div>
              <div className="w-20 h-7 bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* ── Sección Activos ── */}
      {!loading && (
        <>
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
                Activos ({activos.length})
              </h2>
            </div>

            {activos.length === 0 ? (
              <div className="surface-elevated rounded-xl py-10 text-center text-text-secondary">
                <Stethoscope size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hay médicos activos todavía.</p>
                <button
                  onClick={openAddModal}
                  className="mt-2 text-primary hover:underline text-sm"
                >
                  Agregar el primero
                </button>
              </div>
            ) : (
              <ul className="surface-elevated rounded-xl overflow-hidden">
                {activos.map((medico, idx) => (
                  <MedicoRow
                    key={medico.id}
                    medico={medico}
                    isFirst={idx === 0}
                    toggling={togglingId === medico.id}
                    onEdit={() => openEditModal(medico)}
                    onToggle={() => handleToggleActivo(medico)}
                    variant="active"
                  />
                ))}
              </ul>
            )}
          </section>

          {/* ── Sección Inactivos ── */}
          {inactivos.length > 0 && (
            <section>
              <button
                onClick={() => setShowInactivos(v => !v)}
                className="flex items-center gap-2 mb-3 w-full text-left"
              >
                <span className="w-2 h-2 rounded-full bg-zinc-600 block" />
                <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
                  Inactivos ({inactivos.length})
                </h2>
                {showInactivos
                  ? <ChevronUp size={14} className="text-text-secondary ml-auto" />
                  : <ChevronDown size={14} className="text-text-secondary ml-auto" />
                }
              </button>

              {showInactivos && (
                <ul className="rounded-xl overflow-hidden border border-border/20">
                  {inactivos.map((medico, idx) => (
                    <MedicoRow
                      key={medico.id}
                      medico={medico}
                      isFirst={idx === 0}
                      toggling={togglingId === medico.id}
                      onEdit={() => openEditModal(medico)}
                      onToggle={() => handleToggleActivo(medico)}
                      variant="inactive"
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {/* ── Modal Agregar / Editar ── */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Panel */}
          <div className="relative w-full max-w-sm gradient-border-wrapper shadow-glow z-10">
            <div className="gradient-border-content p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-display font-bold text-foreground">
                  {modalMode === 'add' ? 'Agregar Médico' : 'Editar Médico'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-text-secondary hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-text-secondary block mb-1.5">
                    Nombre <span className="text-primary">*</span>
                  </span>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="Ej: Juan"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder:text-text-secondary/40 focus:outline-none focus:border-primary/60 transition-colors text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-text-secondary block mb-1.5">
                    Apellido <span className="text-primary">*</span>
                  </span>
                  <input
                    type="text"
                    value={formApellido}
                    onChange={e => setFormApellido(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="Ej: García"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder:text-text-secondary/40 focus:outline-none focus:border-primary/60 transition-colors text-sm"
                  />
                </label>

                {formError && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-secondary hover:text-foreground hover:bg-white/5 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white shadow-glow transition-all active:scale-95 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" /> Guardando</>
                    : 'Guardar'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente fila de médico ── */
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
    <li className={`flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors ${!isFirst ? 'border-t border-white/5' : ''}`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isActive ? 'bg-primary/20' : 'bg-white/5'
      }`}>
        <span className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
          {getInitials(medico.nombre, medico.apellido)}
        </span>
      </div>

      {/* Nombre */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isActive ? 'text-foreground' : 'text-text-secondary line-through decoration-zinc-600'}`}>
          {medico.apellido}, {medico.nombre}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          title="Editar nombre"
          className="p-2 rounded-lg hover:bg-white/10 text-text-secondary hover:text-foreground transition-colors"
        >
          <Pencil size={14} />
        </button>

        <button
          onClick={onToggle}
          disabled={toggling}
          title={isActive ? 'Desactivar' : 'Reactivar'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
            isActive
              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
              : 'bg-zinc-700/30 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-400'
          }`}
        >
          {toggling ? (
            <Loader2 size={13} className="animate-spin" />
          ) : isActive ? (
            <>
              <UserCheck size={13} />
              <span className="hidden sm:inline">Activo</span>
            </>
          ) : (
            <>
              <UserX size={13} />
              <span className="hidden sm:inline">Inactivo</span>
            </>
          )}
        </button>
      </div>
    </li>
  );
}
