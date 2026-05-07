export interface Medico {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  created_at: string;
}

export interface Auditoria {
  id: string;
  medico_id: string;
  mes: string; // YYYY-MM-DD
  completada: boolean;
  created_at: string;
  updated_at: string;
  medico?: Medico;
  historias_clinicas?: HistoriaClinica[];
}

export interface HistoriaClinica {
  id: string;
  auditoria_id: string;
  fecha: string; // YYYY-MM-DD
  numero_atencion: string;
  correccion: string;
  created_at: string;
  updated_at: string;
}
