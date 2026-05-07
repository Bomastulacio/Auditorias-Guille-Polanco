'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Medico } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { ChevronLeft, Loader2, Info } from 'lucide-react';

const today = new Date();

const selectCls = 'w-full bg-transparent border-b border-nd-border-vis px-0 py-2.5 font-mono text-sm text-text-primary focus:outline-none focus:border-text-primary transition-colors appearance-none cursor-pointer';
const labelCls = 'nd-label block mb-2';

export default function NuevaAuditoriaPage() {
  const router = useRouter();
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [medicoId, setMedicoId] = useState('');
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [anio, setAnio] = useState(today.getFullYear());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('medicos').select('*').eq('activo', true).order('apellido')
      .then(({ data }) => {
        if (data) { setMedicos(data); if (data.length > 0) setMedicoId(data[0].id); }
        setLoadingMedicos(false);
      });
  }, []);

  const handleSubmit = async () => {
    if (!medicoId) { setError('Seleccioná un médico.'); return; }
    setSubmitting(true); setError(null); setInfoMsg(null);
    const mesStr = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const { data: existing } = await supabase.from('auditorias').select('id')
      .eq('medico_id', medicoId).eq('mes', mesStr).maybeSingle();
    if (existing) {
      setInfoMsg(`Ya existe. Redirigiendo a ${MESES_ES[mes - 1]} ${anio}...`);
      setTimeout(() => router.push(`/auditorias/${existing.id}`), 1200);
      setSubmitting(false); return;
    }
    const { data, error: createError } = await supabase.from('auditorias')
      .insert({ medico_id: medicoId, mes: mesStr, completada: false })
      .select('id').single();
    if (createError || !data) { setError('No se pudo crear. Intentá de nuevo.'); setSubmitting(false); return; }
    router.push(`/auditorias/${data.id}`);
  };

  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

  return (
    <div className="max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <Link href="/auditorias"
          className="inline-flex items-center gap-1.5 nd-label hover:text-text-primary transition-colors mb-6">
          <ChevronLeft size={14} strokeWidth={1.5} />
          AUDITORÍAS
        </Link>
        <h1 className="text-3xl font-light tracking-[-0.02em] text-text-display">Nueva Auditoría</h1>
      </div>

      <div className="border-t border-nd-border" />

      {/* Form */}
      <div className="px-6 py-8 space-y-8">

        {/* Médico */}
        <div>
          <label className={labelCls}>MÉDICO *</label>
          {loadingMedicos ? (
            <p className="nd-label animate-pulse">[CARGANDO...]</p>
          ) : medicos.length === 0 ? (
            <p className="font-mono text-[11px] text-text-disabled">
              No hay médicos activos.{' '}
              <Link href="/medicos" className="text-interactive">AGREGAR →</Link>
            </p>
          ) : (
            <div className="relative">
              <select value={medicoId} onChange={e => setMedicoId(e.target.value)} className={selectCls}>
                {medicos.map(m => (
                  <option key={m.id} value={m.id} className="bg-surface text-text-primary">
                    {m.apellido}, {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Mes + Año */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>MES *</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className={selectCls}>
              {MESES_ES.map((nombre, i) => (
                <option key={i + 1} value={i + 1} className="bg-surface text-text-primary">
                  {nombre.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>AÑO *</label>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={selectCls}>
              {years.map(y => (
                <option key={y} value={y} className="bg-surface text-text-primary">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <p className="font-mono text-[11px] text-accent">[ERROR] {error}</p>
        )}
        {infoMsg && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-interactive">
            <Info size={12} strokeWidth={1.5} />
            {infoMsg}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-nd-border" />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || loadingMedicos || medicos.length === 0}
          className="w-full h-11 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.07em] hover:bg-text-primary transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 size={14} className="animate-spin" />CREANDO...</>
            : 'INICIAR AUDITORÍA'
          }
        </button>
      </div>
    </div>
  );
}
