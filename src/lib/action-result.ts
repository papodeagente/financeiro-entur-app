export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data?: T): ActionResult<T> { return { ok: true, data }; }
export function fail<T = unknown>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

import type { z } from "zod";
export function safeParseForm<S extends z.ZodTypeAny, T = unknown>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<T> } {
  const obj: Record<string, FormDataEntryValue | FormDataEntryValue[] | null> = {};
  for (const k of new Set(Array.from(formData.keys()))) {
    const all = formData.getAll(k);
    obj[k] = all.length > 1 ? all : all[0];
  }
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      (fieldErrors[k] ||= []).push(issue.message);
    }
    return { ok: false, result: fail("Confira os campos destacados.", fieldErrors) };
  }
  return { ok: true, data: parsed.data };
}
