import { z } from 'zod';

export const listPaymentsQuerySchema = z
  .object({
    consultationType: z.string().min(1).max(100).optional(),
  })
  .strict();

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export const paymentConfigResponseSchema = z.object({
  id: z.number(),
  consultationType: z.string(),
  price: z.number(),
  paymentMethods: z.array(z.string()),
});

export const listPaymentsResponseSchema = z.array(paymentConfigResponseSchema);
