import { z } from 'zod';

export const lookupPatientQuerySchema = z
  .object({
    email: z.string().email().max(254).optional(),
    phone: z.string().min(8).max(20).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: 'Provide email or phone',
  });

export type LookupPatientQuery = z.infer<typeof lookupPatientQuerySchema>;

export const patientResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
});
