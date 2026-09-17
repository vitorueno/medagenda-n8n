import { z } from 'zod';

export const doctorResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  specialty: z.string(),
});

export const listDoctorsResponseSchema = z.array(doctorResponseSchema);
