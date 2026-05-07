'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Auditoria, Medico, HistoriaClinica } from '@/types';
import { CORRECCIONES, MESES_ES, HC_TARGET } from '@/lib/constants';
import { exportarExcel } from '@/lib/export/excel';
import { exportarMinutaWord } from '@/lib/export/word-minuta';
import {
  ChevronLeft, Loader2, Trash2, Pencil, X,
  CheckCircle2, FileSpreadsheet, FileText, AlertTriangle,
} from 'lucide-react';

type AuditoriaFull = Auditoria & {
  medico: Medico;
  historias_clinicas: HistoriaClinica[];
};

function getMesLabel(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_ES[parseInt(m) - 1]} ${y}`;
}

function formatFecha(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function detectCorreccion(valor: string): { select: string; otro: string } {
  const known = (CORRECCIONES as readonly string[]).includes(valor);
  if (known && valor !== 'OTRO') return { select: valor, otro: '' };
  if (valor === '-') return { select: '-', otro: '' };
  return { select: 'OTRO', otro: valor };
}

function getCorreccionFinal(select: string, otro: string): string {
  if (select === 'OTRO') return otro.trim() || 'OTRO';
  return select;
}

/* ── Sub-components ── */

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100);
  const done = current >= target;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-400' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${done ? 'text-emerald-400' : 'text-foreground'}`}>
        {current}/{target}
      </span>
    </div>
  );
}

function DesvioChip({ correccion }: { correccion: string }) {
  if (correccion === '-') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 whitespace-nowrap">
        Sin desvío
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 max-w-[200px] truncate"
      title={correccion}
    >
      {correccion}
    </span>
  );
}

/* ── Shared input style ── */
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder:text-text-secondary/40 focus:outline-none focus:border-primary/60 transition-colors text-sm';
const selectCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 transition-colors text-sm';

/* ── Main page ── */

export default function AuditoriaDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [auditoria, setAuditoria] = useState<AuditoriaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Add HC form
  const [formFecha, setFormFecha] = useState(new Date().toISOString().slice(0, 10));
  const [formNumero, setFormNumero] = useState('');
  const [formCorreccion, setFormCorreccion] = useState('-');
  const [formOtro, setFormOtro] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit modal
  const [editingHC, setEditingHC] = useState<HistoriaClinica | null>(null);
  const [editFecha, setEditFecha] = useState('');
  const [editNumero, setEditNumero] = useState('');
  const [editCorreccion, setEditCorreccion] = useState('-');
  const [editOtro, setEditOtro] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [deletingHC, setDeletingHC] = useState<HistoriaClinica | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Mark complete
  const [markingComplete, setMarkingComplete] = useState(false);

  // Export
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);

  const fetchAuditoria = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from('auditorias')
      .select('*, medico:medicos(*), historias_clinicas(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      setFetchError('Auditoría no encontrada.');
    } else {
      const sorted = {
        ...data,
        historias_clinicas: [...(data.historias_clinicas ?? [])].sort(
          (a: HistoriaClinica, b: HistoriaClinica) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      };
      setAuditoria(sorted as AuditoriaFull);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  /* ── Handlers ── */

  const handleAddHC = async () => {
    if (!formNumero.trim()) { setFormError('El número de atención es requerido.'); return; }
    const correccion = getCorreccionFinal(formCorreccion, formOtro);
    setFormSaving(true);
    setFormError(null);
    const { error } = await supabase
      .from('historias_clinicas')
      .insert({ auditoria_id: id, fecha: formFecha, numero_atencion: formNumero.trim(), correccion });
    if (error) {
      setFormError('No se pudo guardar. Intentá de nuevo.');
    } else {
      setFormNumero('');
      setFormCorreccion('-');
      setFormOtro('');
      fetchAuditoria();
    }
    setFormSaving(false);
  };

  const openEdit = (hc: HistoriaClinica) => {
    const { select, otro } = detectCorreccion(hc.correccion);
    setEditFecha(hc.fecha);
    setEditNumero(hc.numero_atencion);
    setEditCorreccion(select);
    setEditOtro(otro);
    setEditError(null);
    setEditingHC(hc);
  };

  const handleSaveEdit = async () => {
    if (!editNumero.trim()) { setEditError('El número de atención es requerido.'); return; }
    const correccion = getCorreccionFinal(editCorreccion, editOtro);
    setEditSaving(true);
    setEditError(null);
    const { error } = await supabase
      .from('historias_clinicas')
      .update({ fecha: editFecha, numero_atencion: editNumero.trim(), correccion })
      .eq('id', editingHC!.id);
    if (error) {
      setEditError('No se pudo actualizar.');
    } else {
      setEditingHC(null);
      fetchAuditoria();
    }
    setEditSaving(false);
  };

  const handleDeleteHC = async () => {
    if (!deletingHC) return;
    setDeleteLoading(true);
    const { error } = await supabase
      .from('historias_clinicas')
      .delete()
      .eq('id', deletingHC.id);
    if (!error) {
      if (auditoria?.completada) {
        await supabase.from('auditorias').update({ completada: false }).eq('id', id);
      }
      setDeletingHC(null);
      fetchAuditoria();
    }
    setDeleteLoading(false);
  };

  const handleMarkComplete = async () => {
    setMarkingComplete(true);
    const { error } = await supabase
      .from('auditorias')
      .update({ completada: true })
      .eq('id', id);
    if (!error) fetchAuditoria();
    setMarkingComplete(false);
  };

  const handleExportExcel = async () => {
    if (!auditoria) return;
    setExportingExcel(true);
    try {
      await exportarExcel(auditoria.medico, auditoria.mes, auditoria.historias_clinicas);
    } catch (err) {
      console.error('Error exportando Excel:', err);
    }
    setExportingExcel(false);
  };

  const handleExportWord = async () => {
    if (!auditoria) return;
    setExportingWord(true);
    try {
      await exportarMinutaWord(auditoria.medico, auditoria.mes, auditoria.historias_clinicas);
    } catch (err) {
      console.error('Error exportando Word:', err);
    }
    setExportingWord(false);
  };

  /* ── Loading / Error states ── */

  if (loading) {
    return (
      <div className="p-6 md:p-padding max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-24" />
        <div className="h-8 bg-white/10 rounded w-1/2" />
        <div className="h-5 bg-white/5 rounded w-32" />
        <div className="h-2 bg-white/5 rounded-full mt-4" />
        <div className="space-y-2 mt-6">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-white/5 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (fetchError || !auditoria) {
    return (
      <div className="p-6 md:p-padding max-w-3xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{fetchError ?? 'Auditoría no encontrada.'}</p>
        <Link href="/auditorias" className="text-primary hover:underline text-sm">
          Volver al listado
        </Link>
      </div>
    );
  }

  const hcs = auditoria.historias_clinicas;
  const hcCount = hcs.length;
  const desvios = hcs.filter(h => h.correccion !== '-').length;
  const isComplete = auditoria.completada;
  const canAdd = !isComplete && hcCount < HC_TARGET;
  const canMarkComplete = !isComplete && hcCount === HC_TARGET;

  return (
    <div className="p-6 md:p-padding max-w-3xl mx-auto pb-24 md:pb-10">

      {/* Back */}
      <Link
        href="/auditorias"
        className="inline-flex items-center gap-1.5 text-text-secondary hover:text-foreground transition-colors text-sm mb-5"
      >
        <ChevronLeft size={16} />
        Auditorías
      </Link>

      {/* ── Header ── */}
      <div className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight">
              {auditoria.medico.apellido}, {auditoria.medico.nombre}
            </h1>
            <p className="text-text-secondary mt-1">{getMesLabel(auditoria.mes)}</p>
          </div>
          {isComplete && (
            <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 size={13} />
              Completa
            </span>
          )}
        </div>

        <div className="mt-4">
          <ProgressBar current={hcCount} target={HC_TARGET} />
          {hcCount > 0 && (
            <p className="text-xs text-text-secondary mt-1.5">
              {desvios} desvío{desvios !== 1 ? 's' : ''} · {((desvios / hcCount) * 100).toFixed(1)}% de tasa
            </p>
          )}
        </div>
      </div>

      {/* ── HC List ── */}
      {hcCount === 0 ? (
        <div className="surface-elevated rounded-xl py-12 text-center text-text-secondary text-sm mb-6">
          Todavía no hay historias clínicas. Completá el formulario de abajo.
        </div>
      ) : (
        <div className="surface-elevated rounded-xl overflow-hidden mb-6">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1.5rem_7rem_1fr_1.5fr_5rem] gap-3 px-4 py-2.5 border-b border-white/5 text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
            <span>#</span>
            <span>Fecha</span>
            <span>N° Atención</span>
            <span>Corrección</span>
            <span></span>
          </div>

          <ul>
            {hcs.map((hc, idx) => (
              <li
                key={hc.id}
                className={`flex sm:grid sm:grid-cols-[1.5rem_7rem_1fr_1.5fr_5rem] items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                  idx !== 0 ? 'border-t border-white/5' : ''
                }`}
              >
                <span className="text-xs text-text-secondary tabular-nums hidden sm:block">{idx + 1}</span>
                <span className="text-sm text-foreground tabular-nums">{formatFecha(hc.fecha)}</span>
                <span className="text-sm text-foreground font-mono">{hc.numero_atencion}</span>
                <div className="flex-1 sm:flex-none min-w-0">
                  <DesvioChip correccion={hc.correccion} />
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 justify-end">
                  <button
                    onClick={() => openEdit(hc)}
                    title="Editar"
                    className="p-1.5 rounded-lg hover:bg-white/10 text-text-secondary hover:text-foreground transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeletingHC(hc)}
                    title="Eliminar"
                    className="p-1.5 rounded-lg hover:bg-red-500/15 text-text-secondary hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Marcar Completa ── */}
      {canMarkComplete && (
        <button
          onClick={handleMarkComplete}
          disabled={markingComplete}
          className="w-full mb-5 py-3 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 shadow-[0_0_12px_0_rgb(52,211,153,0.3)]"
        >
          {markingComplete
            ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
            : <><CheckCircle2 size={16} /> Marcar como Completa</>
          }
        </button>
      )}

      {/* ── Exportar (solo completa) ── */}
      {isComplete && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex-1 py-2.5 rounded-xl border border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center gap-2 text-sm font-medium transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exportingExcel
              ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
              : <><FileSpreadsheet size={15} /> Exportar Excel</>
            }
          </button>
          <button
            onClick={handleExportWord}
            disabled={exportingWord}
            className="flex-1 py-2.5 rounded-xl border border-purple-500/30 hover:border-purple-500/60 bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 flex items-center justify-center gap-2 text-sm font-medium transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exportingWord
              ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
              : <><FileText size={15} /> Minuta Word</>
            }
          </button>
        </div>
      )}

      {/* ── Formulario agregar HC ── */}
      {canAdd && (
        <div className="gradient-border-wrapper">
          <div className="gradient-border-content p-5 space-y-4">
            <h2 className="text-sm font-display font-semibold text-foreground">
              Agregar HC <span className="text-text-secondary font-normal">({hcCount + 1} de {HC_TARGET})</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Fecha <span className="text-primary">*</span>
                </label>
                <input
                  type="date"
                  value={formFecha}
                  onChange={e => setFormFecha(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  N° Atención <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formNumero}
                  onChange={e => setFormNumero(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddHC()}
                  placeholder="Ej: 1001"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1.5">
                Corrección
              </label>
              <select
                value={formCorreccion}
                onChange={e => {
                  setFormCorreccion(e.target.value);
                  if (e.target.value !== 'OTRO') setFormOtro('');
                }}
                className={selectCls}
              >
                {CORRECCIONES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {formCorreccion === 'OTRO' && (
              <div>
                <label className="text-xs font-medium text-text-secondary block mb-1.5">
                  Especificar <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={formOtro}
                  onChange={e => setFormOtro(e.target.value)}
                  autoFocus
                  placeholder="Describí la corrección..."
                  className={inputCls}
                />
              </div>
            )}

            {formError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              onClick={handleAddHC}
              disabled={formSaving}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/80 text-white shadow-glow transition-all active:scale-[0.98] font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {formSaving
                ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
                : 'Guardar HC'
              }
            </button>
          </div>
        </div>
      )}

      {/* Aviso auditoría completa */}
      {isComplete && (
        <div className="surface-elevated rounded-xl p-4 text-center text-sm text-text-secondary">
          La auditoría está completa. Podés editar o eliminar HCs individuales si necesitás hacer correcciones.
        </div>
      )}

      {/* ── Modal Editar HC ── */}
      {editingHC && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingHC(null)} />
          <div className="relative w-full max-w-sm gradient-border-wrapper shadow-glow z-10">
            <div className="gradient-border-content p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-display font-bold text-foreground">Editar HC</h2>
                <button
                  onClick={() => setEditingHC(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-text-secondary hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">Fecha</label>
                  <input
                    type="date"
                    value={editFecha}
                    onChange={e => setEditFecha(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">N° Atención</label>
                  <input
                    type="text"
                    value={editNumero}
                    onChange={e => setEditNumero(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1.5">Corrección</label>
                  <select
                    value={editCorreccion}
                    onChange={e => {
                      setEditCorreccion(e.target.value);
                      if (e.target.value !== 'OTRO') setEditOtro('');
                    }}
                    className={selectCls}
                  >
                    {CORRECCIONES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {editCorreccion === 'OTRO' && (
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1.5">Especificar</label>
                    <input
                      type="text"
                      value={editOtro}
                      onChange={e => setEditOtro(e.target.value)}
                      autoFocus
                      className={inputCls}
                    />
                  </div>
                )}

                {editError && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {editError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setEditingHC(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-secondary hover:text-foreground text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white shadow-glow text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                >
                  {editSaving
                    ? <><Loader2 size={14} className="animate-spin" /> Guardando</>
                    : 'Guardar'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Eliminar ── */}
      {deletingHC && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeletingHC(null)} />
          <div className="relative w-full max-w-sm surface-elevated rounded-2xl p-6 z-10">
            <div className="flex gap-3 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-foreground">Eliminar HC</h2>
                <p className="text-sm text-text-secondary mt-1">
                  ¿Eliminar la HC N°&nbsp;<strong className="text-foreground">{deletingHC.numero_atencion}</strong>?
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingHC(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-secondary hover:text-foreground text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteHC}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
              >
                {deleteLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Eliminando</>
                  : 'Eliminar'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
