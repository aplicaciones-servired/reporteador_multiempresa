import { z } from 'zod';

export const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, 'El usuario es obligatorio')
    .max(60, 'El usuario no debe exceder 60 caracteres'),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria')
    .max(128, 'La contraseña es demasiado larga'),
});

export type LoginInput = z.infer<typeof loginSchema>;
