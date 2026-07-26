declare const brand: unique symbol;

/** Nominal typing helper: `Brand<number, "Money">` is not assignable from plain `number`. */
export type Brand<T, K extends string> = T & { readonly [brand]: K };
