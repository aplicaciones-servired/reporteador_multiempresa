import { z } from 'zod';

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .refine((val) => {
    const [year, month, day] = val.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    );
  }, 'Fecha calendario inválida');

export const companyCodeSchema = z
  .string()
  .trim()
  .min(1, 'Debes seleccionar una empresa')
  .max(20, 'Código de empresa inválido');

export const dateRangeWithCompanySchema = z
  .object({
    empresa: companyCodeSchema,
    fecha1: isoDateSchema,
    fecha2: isoDateSchema,
  })
  .refine((data) => data.fecha1 <= data.fecha2, {
    message: 'La fecha inicial no puede ser mayor que la fecha final',
    path: ['fecha2'],
  });

export const dateRangeNoCompanySchema = z
  .object({
    fecha1: isoDateSchema,
    fecha2: isoDateSchema,
  })
  .refine((data) => data.fecha1 <= data.fecha2, {
    message: 'La fecha inicial no puede ser mayor que la fecha final',
    path: ['fecha2'],
  });

export const singleDateWithCompanySchema = z.object({
  empresa: companyCodeSchema,
  fecha1: isoDateSchema,
});

export const singleDateSorteoWithCompanySchema = z.object({
  empresa: companyCodeSchema,
  fecha1: isoDateSchema,
  sorteo: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'El sorteo debe tener exactamente 4 dígitos numéricos'),
});

export const singleDateSerieNoCompanySchema = z.object({
  fecha1: isoDateSchema,
  serie: z
    .string()
    .trim()
    .min(1, 'La serie es obligatoria')
    .max(40, 'La serie no debe superar 40 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'La serie solo puede contener letras, números y guiones')
    .transform((value) => value.toUpperCase()),
});

export const companyOnlySchema = z.object({
  empresa: companyCodeSchema,
});

const documentItemSchema = z
  .string()
  .trim()
  .regex(/^\d{1,20}$/, 'Cada documento debe contener solo dígitos numéricos');

export const documentListWithCompanySchema = z.object({
  empresa: companyCodeSchema,
  documentos: z
    .array(documentItemSchema)
    .min(1, 'Debes ingresar al menos un número de documento')
    .max(1000, 'Se permiten máximo 1000 documentos por consulta'),
});

export const documentListOptionalCompanySchema = z.object({
  empresa: z.string().trim().max(20).optional().or(z.literal('')),
  documentos: z
    .array(documentItemSchema)
    .min(1, 'Debes ingresar al menos un número de documento')
    .max(1000, 'Se permiten máximo 1000 documentos por consulta'),
});
