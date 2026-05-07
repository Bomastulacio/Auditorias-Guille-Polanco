export const CORRECCIONES = [
  '-',
  'FALTAN SIGNOS VITALES',
  'FALTAN DATOS FILIATORIOS',
  'FALTA NUMERO DE LLAMADA',
  'FALTA NUMERO DE AFILIADO',
  'FALTA FIRMA DEL PACIENTE',
  'FALTA FIRMA/SELLO DEL PROFESIONAL',
  'FALTA FECHA',
  'FALTA HORA DE ARRIBO',
  'OTRO',
] as const;

export type Correccion = typeof CORRECCIONES[number];

export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const MESES_ES_UPPER = MESES_ES.map(m => m.toUpperCase());

export const HC_TARGET = 20;

export const BASE = 'Base Río Gallegos';
export const AUDITOR_APELLIDO = 'POLANCO';
export const AUDITOR_NOMBRE = 'GUILLERMO';
export const AUDITOR_TITULO = 'Médico Auditor';
export const AUDITOR_MPP = '4056';
