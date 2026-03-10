import { z } from "zod";

export const apiMetaSchema = z.object({
  timestamp: z.string().datetime(),
  request_id: z.string().uuid().optional(),
  pagination: z.object({
    page: z.number(),
    per_page: z.number(),
    total: z.number(),
    total_pages: z.number(),
  }).optional(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.string()).optional(),
  }),
  meta: apiMetaSchema,
});

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: apiMetaSchema,
  });
