import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('Seeding data...');

  // 1. Insert Medicos
  const { data: medicos, error: medicoError } = await supabase
    .from('medicos')
    .insert([
      { nombre: 'Juan', apellido: 'Pérez' },
      { nombre: 'María', apellido: 'García' },
      { nombre: 'Carlos', apellido: 'Rodriguez' },
    ])
    .select();

  if (medicoError) {
    console.error('Error inserting medicos:', medicoError);
    return;
  }

  console.log('Inserted medicos:', medicos);

  // 2. Insert an Audit for the first medico
  const medicoId = medicos[0].id;
  const { data: auditoria, error: auditoriaError } = await supabase
    .from('auditorias')
    .insert([
      { medico_id: medicoId, mes: '2026-04-01', completada: false },
    ])
    .select()
    .single();

  if (auditoriaError) {
    console.error('Error inserting auditoria:', auditoriaError);
    return;
  }

  console.log('Inserted auditoria:', auditoria);

  // 3. Insert some HCs
  const { error: hcError } = await supabase
    .from('historias_clinicas')
    .insert([
      { auditoria_id: auditoria.id, fecha: '2026-04-05', numero_atencion: '1001', correccion: '-' },
      { auditoria_id: auditoria.id, fecha: '2026-04-06', numero_atencion: '1002', correccion: 'FALTAN SIGNOS VITALES' },
    ]);

  if (hcError) {
    console.error('Error inserting HCs:', hcError);
    return;
  }

  console.log('Seed completed successfully!');
}

seed();
