// Minimal ambient types: the repo's @types/node (v17) predates node:test.
// Node provides these modules at runtime; we only declare the surface we use.
declare module 'node:test' {
   export function test (name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert' {
   interface AssertFn {
      (value: unknown, message?: string): void;
      ok (value: unknown, message?: string): void;
      strictEqual (actual: unknown, expected: unknown, message?: string): void;
      deepStrictEqual (actual: unknown, expected: unknown, message?: string): void;
   }
   const assert: AssertFn;
   export default assert;
}
