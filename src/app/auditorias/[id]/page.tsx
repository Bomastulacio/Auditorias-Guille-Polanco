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
  ChevronLeft, Loader2, Trash2, Pencil, CheckCircle2,
  FileSpreadsheet, FileText, AlertTriangle,
} from 'lucide-react';

type AuditoriaFull = Auditoria & { medico: Medico; historias_clinicas: HistoriaClinica[] };

function getMesLabel(mes: string) {
  const [y, m] = mes.split('-');
  return `${MESES_ES[parseInt(m) - 1].toUpperCase()} ${y}`;
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
  return select === 'OTRO' ? (otro.trim() || 'OTRO') : select;
}

const inputCls = 'w-full bg-transparent border-b border-[#333333] px-0 py-2 text-text-primary placeholder:text-text-disabled font-mono text-sm focus:outline-none focus:border-text-primary transition-colors';
const selectCls = 'w-full bg-[#111111] border-b border-[#333333] px-0 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary transition-colors appearance-none';
const labelCls = 'nd-label block mb-2';

function DesvioTag({ correccion }: { correccion: string }) {
  if (correccion === '-') {
    return <span className="font-mono text-[10px] text-success tracking-wider">SIN DESVÍO</span>;
  }
  return (
    <span className="font-mono text-[10px] text-warning tracking-wide truncate max-w-[160px] sm:max-w-[220px]" title={correccion}>
      {correccion}
    </span>
  );
}

export default function AuditoriaDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [auditoria, setAuditoria] = useState<AuditoriaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Add form
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

  // Actions
  const [markingComplete, setMarkingComplete] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);

  const fetchAuditoria = useCallback(async () => {
    setLoading(true); setFetchError(null);
    const { data, error } = await supabase
      .from('auditorias').select('*, medico:medicos(*), historias_clinicas(*)')
      .eq('id', id).single();
    if (error || !data) { setFetchError('Auditoría no encontrada.'); }
    else {
      setAuditoria({
        ...data,
        historias_clinicas: [...(data.historias_clinicas ?? [])].sort(
          (a: HistoriaClinica, b: HistoriaClinica) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      } as AuditoriaFull);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  const handleAddHC = async () => {
    if (!formNumero.trim()) { setFormError('El número de atención es requerido.'); return; }
    const correccion = getCorreccionFinal(formCorreccion, formOtro);
    setFormSaving(true); setFormError(null);
    const { error } = await supabase.from('historias_clinicas')
      .insert({ auditoria_id: id, fecha: formFecha, numero_atencion: formNumero.trim(), correccion });
    if (error) setFormError('No se pudo guardar.');
    else { setFormNumero(''); setFormCorreccion('-'); setFormOtro(''); fetchAuditoria(); }
    setFormSaving(false);
  };

  const openEdit = (hc: HistoriaClinica) => {
    const { select, otro } = detectCorreccion(hc.correccion);
    setEditFecha(hc.fecha); setEditNumero(hc.numero_atencion);
    setEditCorreccion(select); setEditOtro(otro);
    setEditError(null); setEditingHC(hc);
  };

  const handleSaveEdit = async () => {
    if (!editNumero.trim()) { setEditError('Número requerido.'); return; }
    const correccion = getCorreccionFinal(editCorreccion, editOtro);
    setEditSaving(true); setEditError(null);
    const { error } = await supabase.from('historias_clinicas')
      .update({ fecha: editFecha, numero_atencion: editNumero.trim(), correccion })
      .eq('id', editingHC!.id);
    if (error) setEditError('No se pudo actualizar.');
    else { setEditingHC(null); fetchAuditoria(); }
    setEditSaving(false);
  };

  const handleDeleteHC = async () => {
    if (!deletingHC) return;
    setDeleteLoading(true);
    const { error } = await supabase.from('historias_clinicas').delete().eq('id', deletingHC.id);
    if (!error) {
      if (auditoria?.completada) await supabase.from('auditorias').update({ completada: false }).eq('id', id);
      setDeletingHC(null); fetchAuditoria();
    }
    setDeleteLoading(false);
  };

  const handleMarkComplete = async () => {
    setMarkingComplete(true);
    const { error } = await supabase.from('auditorias').update({ completada: true }).eq('id', id);
    if (!error) fetchAuditoria();
    setMarkingComplete(false);
  };

  const handleExportExcel = async () => {
    if (!auditoria) return;
    setExportingExcel(true);
    try { await exportarExcel(auditoria.medico, auditoria.mes, auditoria.historias_clinicas); }
    catch (e) { console.error(e); }
    setExportingExcel(false);
  };

  const handleExportWord = async () => {
    if (!auditoria) return;
    setExportingWord(true);
    try { await exportarMinutaWord(auditoria.medico, auditoria.mes, auditoria.historias_clinicas); }
    catch (e) { console.error(e); }
    setExportingWord(false);
  };

  if (loading) return (
    <div className="px-6 py-8"><p className="nd-label animate-pulse">[CARGANDO...]</p></div>
  );
  if (fetchError || !auditoria) return (
    <div className="px-6 py-20 text-center">
      <p className="font-mono text-[11px] text-accent">[ERROR] {fetchError}</p>
      <Link href="/auditorias" className="font-mono text-[11px] text-interactive mt-2 block">← VOLVER</Link>
    </div>
  );

  const hcs = auditoria.historias_clinicas;
  const hcCount = hcs.length;
  const desvios = hcs.filter(h => h.correccion !== '-').length;
  const isComplete = auditoria.completada;
  const canAdd = !isComplete && hcCount < HC_TARGET;
  const canMarkComplete = !isComplete && hcCount === HC_TARGET;
  const pct = hcCount > 0 ? (desvios / hcCount * 100).toFixed(1) : '0.0';

  return (
    <div className="max-w-3xl mx-auto w-full pb-24 md:pb-10">

      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <Link href="/auditorias"
          className="inline-flex items-center gap-1.5 nd-label hover:text-text-secondary transition-colors mb-5">
          <ChevronLeft size={14} strokeWidth={1.5} />
          AUDITORÍAS
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-light tracking-[-0.02em] text-text-display leading-tight">
              {auditoria.medico.apellido}, {auditoria.medico.nombre}
            </h1>
            <p className="nd-label mt-1">{getMesLabel(auditoria.mes)}</p>
          </div>
          {isComplete && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border border-success/40 rounded-full font-mono text-[10px] tracking-wider text-success flex-shrink-0">
              <CheckCircle2 size={11} strokeWidth={1.5} />
              COMPLETA
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex-1 flex gap-[2px]">
              {Array.from({ length: HC_TARGET }, (_, i) => (
                <div key={i} className={`flex-1 h-[5px] ${i < hcCount ? (isComplete ? 'bg-success' : 'bg-text-primary') : 'bg-[#222222]'}`} />
              ))}
            </div>
            <span className={`font-mono text-xs tabular-nums flex-shrink-0 ${isComplete ? 'text-success' : 'text-text-primary'}`}>
              {hcCount}/{HC_TARGET}
            </span>
          </div>
          {hcCount > 0 && (
            <p className="nd-label">
              {desvios} DESVÍO{desvios !== 1 ? 'S' : ''} · {pct}% TASA
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-[#222222]" />

      {/* HC Table */}
      {hcCount > 0 && (
        <>
          <div className="px-6 pt-4 pb-2">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[2rem_7rem_1fr_1.8fr_5rem] gap-3 pb-2 border-b border-[#222222]">
              {['#', 'FECHA', 'N° ATEN.', 'CORRECCIÓN', ''].map(h => (
                <span key={h} className="nd-label">{h}</span>
              ))}
            </div>
          </div>
          <ul>
            {hcs.map((hc, idx) => (
              <li key={hc.id}
                className={`flex sm:grid sm:grid-cols-[2rem_7rem_1fr_1.8fr_5rem] items-center gap-3 px-6 py-3 hover:bg-surface-raised transition-colors ${
                  idx !== 0 ? 'border-t border-[#1A1A1A]' : ''
                }`}>
                <span className="font-mono text-[10px] text-text-disabled hidden sm:block tabular-nums">{idx + 1}</span>
                <span className="font-mono text-xs text-text-secondary tabular-nums">{formatFecha(hc.fecha)}</span>
                <span className="font-mono text-xs text-text-primary">{hc.numero_atencion}</span>
                <div className="flex-1 min-w-0"><DesvioTag correccion={hc.correccion} /></div>
                <div className="flex items-center gap-0.5 flex-shrink-0 justify-end">
                  <button onClick={() => openEdit(hc)} title="Editar"
                    className="p-1.5 text-text-disabled hover:text-text-primary transition-colors">
                    <Pencil size={12} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => setDeletingHC(hc)} title="Eliminar"
                    className="p-1.5 text-text-disabled hover:text-accent transition-colors">
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#222222]" />
        </>
      )}

      {hcCount === 0 && (
        <div className="px-6 py-8">
          <p className="font-mono text-[11px] text-text-disabled">Sin historias clínicas. Completá el formulario.</p>
        </div>
      )}

      {/* Mark complete */}
      {canMarkComplete && (
        <div className="px-6 py-4 border-b border-[#222222]">
          <button onClick={handleMarkComplete} disabled={markingComplete}
            className="w-full h-11 border border-success/40 text-success rounded-full font-mono text-[11px] tracking-[0.07em] hover:bg-success hover:text-background transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {markingComplete
              ? <><Loader2 size={13} className="animate-spin" />GUARDANDO...</>
              : <><CheckCircle2 size={13} strokeWidth={1.5} />MARCAR COMO COMPLETA</>
            }
          </button>
        </div>
      )}

      {/* Export buttons */}
      {isComplete && (
        <div className="px-6 py-4 flex gap-3 border-b border-[#222222]">
          <button onClick={handleExportExcel} disabled={exportingExcel}
            className="flex-1 h-10 border border-[#333333] rounded-full font-mono text-[10px] tracking-wider text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {exportingExcel ? <><Loader2 size={12} className="animate-spin" />GENERANDO</> : <><FileSpreadsheet size={12} strokeWidth={1.5} />EXCEL</>}
          </button>
          <button onClick={handleExportWord} disabled={exportingWord}
            className="flex-1 h-10 border border-[#333333] rounded-full font-mono text-[10px] tracking-wider text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {exportingWord ? <><Loader2 size={12} className="animate-spin" />GENERANDO</> : <><FileText size={12} strokeWidth={1.5} />MINUTA WORD</>}
          </button>
        </div>
      )}

      {/* Add HC form */}
      {canAdd && (
        <div className="px-6 py-6">
          <p className="nd-label mb-6">AGREGAR HC <span className="text-text-disabled">({hcCount + 1} DE {HC_TARGET})</span></p>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>FECHA *</label>
                <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>N° ATENCIÓN *</label>
                <input type="text" inputMode="numeric" value={formNumero}
                  onChange={e => setFormNumero(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddHC()}
                  placeholder="1001" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>CORRECCIÓN</label>
              <select value={formCorreccion}
                onChange={e => { setFormCorreccion(e.target.value); if (e.target.value !== 'OTRO') setFormOtro(''); }}
                className={selectCls}>
                {CORRECCIONES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {formCorreccion === 'OTRO' && (
              <div>
                <label className={labelCls}>ESPECIFICAR *</label>
                <input type="text" value={formOtro} onChange={e => setFormOtro(e.target.value)}
                  autoFocus placeholder="Describí la corrección..." className={inputCls} />
              </div>
            )}
            {formError && <p className="font-mono text-[11px] text-accent">[ERROR] {formError}</p>}
            <div className="border-t border-[#222222] pt-4">
              <button onClick={handleAddHC} disabled={formSaving}
                className="w-full h-11 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.07em] hover:bg-text-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {formSaving ? <><Loader2 size={13} className="animate-spin" />GUARDANDO...</> : 'GUARDAR HC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isComplete && (
        <div className="px-6 py-4">
          <p className="font-mono text-[11px] text-text-disabled">
            Auditoría completa. Podés editar o eliminar HCs individuales si necesitás hacer correcciones.
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editingHC && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85" onClick={() => setEditingHC(null)} />
          <div className="relative w-full max-w-sm bg-surface border border-[#333333] rounded-xl p-6 z-10">
            <div className="flex items-center justify-between mb-6">
              <span className="nd-label">EDITAR HC</span>
              <button onClick={() => setEditingHC(null)} className="font-mono text-[11px] text-text-disabled hover:text-text-primary">[X]</button>
            </div>
            <div className="space-y-5">
              <div><label className={labelCls}>FECHA</label>
                <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>N° ATENCIÓN</label>
                <input type="text" value={editNumero} onChange={e => setEditNumero(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>CORRECCIÓN</label>
                <select value={editCorreccion}
                  onChange={e => { setEditCorreccion(e.target.value); if (e.target.value !== 'OTRO') setEditOtro(''); }}
                  className={selectCls}>
                  {CORRECCIONES.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              {editCorreccion === 'OTRO' && (
                <div><label className={labelCls}>ESPECIFICAR</label>
                  <input type="text" value={editOtro} onChange={e => setEditOtro(e.target.value)} autoFocus className={inputCls} /></div>
              )}
              {editError && <p className="font-mono text-[11px] text-accent">[ERROR] {editError}</p>}
            </div>
            <div className="flex gap-3 mt-7">
              <button onClick={() => setEditingHC(null)}
                className="flex-1 h-10 border border-[#333333] rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary transition-colors">
                CANCELAR</button>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="flex-1 h-10 bg-text-display text-background rounded-full font-mono text-[11px] tracking-wider hover:bg-text-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {editSaving ? <><Loader2 size={12} className="animate-spin" />GUARDANDO</> : 'GUARDAR'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingHC && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85" onClick={() => setDeletingHC(null)} />
          <div className="relative w-full max-w-sm bg-surface border border-[#333333] rounded-xl p-6 z-10">
            <div className="flex gap-3 mb-5">
              <AlertTriangle size={16} strokeWidth={1.5} className="text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-primary font-medium">Eliminar HC</p>
                <p className="font-mono text-[11px] text-text-secondary mt-1">
                  ¿Eliminar N°&nbsp;<strong>{deletingHC.numero_atencion}</strong>? No se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingHC(null)}
                className="flex-1 h-10 border border-[#333333] rounded-full font-mono text-[11px] tracking-wider text-text-secondary hover:text-text-primary transition-colors">
                CANCELAR</button>
              <button onClick={handleDeleteHC} disabled={deleteLoading}
                className="flex-1 h-10 border border-accent/60 text-accent rounded-full font-mono text-[11px] tracking-wider hover:bg-accent hover:text-background transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {deleteLoading ? <><Loader2 size={12} className="animate-spin" />ELIMINANDO</> : 'ELIMINAR'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
