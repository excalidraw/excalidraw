export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type ValueOf<T> = T[keyof T];

export type Merge<M, N> = Omit<M, keyof N> & N;

/** utility type to assert that the second type is a subtype of the first type.
 * Returns the subtype. */
export type SubtypeOf<Supertype, Subtype extends Supertype> = Subtype;

export type ResolutionType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

// https://github.com/krzkaczor/ts-essentials
export type MarkOptional<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type MarkRequired<T, RK extends keyof T> = Exclude<T, RK> &
  Required<Pick<T, RK>>;

export type MarkNonNullable<T, K extends keyof T> = {
  [P in K]-?: P extends K ? NonNullable<T[P]> : T[P];
} & { [P in keyof T]: T[P] };

export type NonOptional<T> = Exclude<T, undefined>;

// -----------------------------------------------------------------------------
// type getter for interface's callable type
// src: https://stackoverflow.com/a/58658851/927631
// -----------------------------------------------------------------------------
export type SignatureType<T> = T extends (...args: infer R) => any ? R : never;
export type CallableType<T extends (...args: any[]) => any> = (
  ...args: SignatureType<T>
) => ReturnType<T>;
// --------------------------------------------------------------------------—

// Type for React.forwardRef --- supply only the first generic argument T
export type ForwardRef<T, P = any> = Parameters<
  CallableType<React.ForwardRefRenderFunction<T, P>>
>[1];

export type ExtractSetType<T extends Set<any>> = T extends Set<infer U>
  ? U
  : never;
