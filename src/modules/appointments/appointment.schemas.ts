import { z } from 'zod';

export const createAppointmentBodySchema = z
  .object({
    patientId: z.coerce.number().int().positive(),
    slotId: z.coerce.number().int().positive(),
  })
  .strict();

export type CreateAppointmentBody = z.infer<typeof createAppointmentBodySchema>;

export const appointmentIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export type AppointmentIdParams = z.infer<typeof appointmentIdParamsSchema>;

export const appointmentResponseSchema = z.object({
  id: z.number(),
  patientId: z.number(),
  slotId: z.number(),
  status: z.enum(['active', 'cancelled']),
  createdAt: z.string(),
  cancelledAt: z.string().nullable(),
});
