export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/** utility type to assert that the second type is a subtype of the first type.
 * Returns the subtype. */
export type SubtypeOf<Supertype, Subtype extends Supertype> = Subtype;

export type ResolutionType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

export type MarkNonNullable<T, K extends keyof T> = {
  [P in K]-?: P extends K ? NonNullable<T[P]> : T[P];
} & { [P in keyof T]: T[P] };

// --------------------------------------------------------------------------—

// Type for React.forwardRef --- supply only the first generic argument T
export type ForwardRef<T, P = any> = Parameters<
  React.ForwardRefRenderFunction<T, P>
>[1];

export type ExtractSetType<T extends Set<any>> = T extends Set<infer U>
  ? U
  : never;

export type SameType<T, U> = T extends U ? (U extends T ? true : false) : false;
export type Assert<T extends true> = T;

export type NestedKeyOf<T, K = keyof T> = K extends keyof T & (string | number)
  ? `${K}` | (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : never)
  : never;

export type SetLike<T> = Set<T> | T[];
export type ReadonlySetLike<T> = ReadonlySet<T> | readonly T[];

export type MakeBrand<T extends string> = {
  /** @private using ~ to sort last in intellisense */
  [K in `~brand~${T}`]: T;
};

/** Maybe just promise or already fulfilled one! */
export type MaybePromise<T> = T | Promise<T>;
