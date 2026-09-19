import { z } from 'zod';

export const createAppointmentBodySchema = z
  .object({
    patientId: z.number().int().positive(),
    slotId: z.number().int().positive(),
  })
  .strict();

export type CreateAppointmentBody = z.infer<typeof createAppointmentBodySchema>;

export const appointmentIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export type AppointmentIdParams = z.infer<typeof appointmentIdParamsSchema>;

export const bookByDetailsBodySchema = z
  .object({
    patientId: z.number().int().positive(),
    doctorName: z.string().min(1).max(150).optional(),
    specialty: z.string().min(1).max(100).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be in HH:MM format'),
  })
  .strict()
  .refine((body) => body.doctorName ?? body.specialty, {
    message: 'either doctorName or specialty must be provided',
  });

export type BookByDetailsBody = z.infer<typeof bookByDetailsBodySchema>;

export const cancelByPatientBodySchema = z
  .object({
    patientId: z.number().int().positive(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
      .optional(),
  })
  .strict();

export type CancelByPatientBody = z.infer<typeof cancelByPatientBodySchema>;

export const appointmentResponseSchema = z.object({
  id: z.number(),
  patientId: z.number(),
  slotId: z.number(),
  status: z.enum(['active', 'cancelled']),
  createdAt: z.string(),
  cancelledAt: z.string().nullable(),
});
