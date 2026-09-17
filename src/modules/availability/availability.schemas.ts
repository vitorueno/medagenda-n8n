import { z } from 'zod';

export const availabilityQuerySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
    doctorId: z.coerce.number().int().positive().optional(),
    specialty: z.string().min(1).max(100).optional(),
  })
  .strict();

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const availableSlotResponseSchema = z.object({
  id: z.number(),
  doctorId: z.number(),
  doctorName: z.string(),
  specialty: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export const availabilityResponseSchema = z.array(availableSlotResponseSchema);
