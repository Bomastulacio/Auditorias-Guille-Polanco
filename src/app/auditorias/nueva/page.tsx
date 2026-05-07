'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Medico } from '@/types';
import { MESES_ES } from '@/lib/constants';
import { ChevronLeft, Loader2, Info } from 'lucide-react';

const today = new Date();

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
    supabase
      .from('medicos')
      .select('*')
      .eq('activo', true)
      .order('apellido')
      .then(({ data }) => {
        if (data) {
          setMedicos(data);
          if (data.length > 0) setMedicoId(data[0].id);
        }
        setLoadingMedicos(false);
      });
  }, []);

  const handleSubmit = async () => {
    if (!medicoId) { setError('Seleccioná un médico.'); return; }

    setSubmitting(true);
    setError(null);
    setInfoMsg(null);

    const mesStr = `${anio}-${String(mes).padStart(2, '0')}-01`;

    // Check if already exists
    const { data: existing } = await supabase
      .from('auditorias')
      .select('id')
      .eq('medico_id', medicoId)
      .eq('mes', mesStr)
      .maybeSingle();

    if (existing) {
      setInfoMsg(`Ya existe una auditoría para ${MESES_ES[mes - 1]} ${anio}. Redirigiendo...`);
      setTimeout(() => router.push(`/auditorias/${existing.id}`), 1200);
      setSubmitting(false);
      return;
    }

    // Create new
    const { data, error: createError } = await supabase
      .from('auditorias')
      .insert({ medico_id: medicoId, mes: mesStr, completada: false })
      .select('id')
      .single();

    if (createError || !data) {
      setError('No se pudo crear la auditoría. Intentá de nuevo.');
      setSubmitting(false);
      return;
    }

    router.push(`/auditorias/${data.id}`);
  };

  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

  return (
    <div className="p-6 md:p-padding max-w-lg mx-auto">

      {/* Back */}
      <Link
        href="/auditorias"
        className="inline-flex items-center gap-1.5 text-text-secondary hover:text-foreground transition-colors text-sm mb-6"
      >
        <ChevronLeft size={16} />
        Auditorías
      </Link>

      <h1 className="text-3xl font-display font-bold text-foreground mb-8">
        Nueva Auditoría
      </h1>

      <div className="gradient-border-wrapper shadow-glow">
        <div className="gradient-border-content p-6 space-y-5">

          {/* Médico */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-2">
              Médico <span className="text-primary">*</span>
            </label>
            {loadingMedicos ? (
              <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            ) : medicos.length === 0 ? (
              <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                No hay médicos activos.{' '}
                <Link href="/medicos" className="underline hover:no-underline">
                  Agregar médico
                </Link>
              </div>
            ) : (
              <select
                value={medicoId}
                onChange={e => setMedicoId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 transition-colors text-sm"
              >
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.apellido}, {m.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Mes + Año */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">
                Mes <span className="text-primary">*</span>
              </label>
              <select
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 transition-colors text-sm"
              >
                {MESES_ES.map((nombre, i) => (
                  <option key={i + 1} value={i + 1}>{nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-2">
                Año <span className="text-primary">*</span>
              </label>
              <select
                value={anio}
                onChange={e => setAnio(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 transition-colors text-sm"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}
          {infoMsg && (
            <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
              <Info size={14} className="flex-shrink-0" />
              {infoMsg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || loadingMedicos || medicos.length === 0}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary/80 text-white shadow-glow transition-all active:scale-95 font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Creando...</>
              : 'Iniciar Auditoría'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
