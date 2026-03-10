import { z } from "zod";

export const erpDocCreateBodySchema = z
  .object({
    doctype: z.string().min(1, "doctype required").max(100),
  })
  .passthrough()
  .refine((data) => Object.keys(data).length <= 200, {
    message: "Too many fields (max 200)",
  });

export type ErpDocCreateBody = z.infer<typeof erpDocCreateBodySchema>;
