import { z } from "zod"

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
})

export const pageMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
})

export function pageOf<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item),
    meta: pageMetaSchema,
  })
}

export type PageQuery = z.infer<typeof pageQuerySchema>
export type PageMeta = z.infer<typeof pageMetaSchema>
export type Page<TItem> = { items: TItem[]; meta: PageMeta }

export type PageMetaInput = {
  page: number
  limit: number
  total: number
}

export function pageMeta(input: PageMetaInput): PageMeta {
  const totalPages = input.limit > 0 ? Math.ceil(input.total / input.limit) : 0

  return {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrev: input.page > 1 && input.total > 0,
  }
}

export function page<TItem>(items: TItem[], meta: PageMetaInput): Page<TItem> {
  return { items, meta: pageMeta(meta) }
}
