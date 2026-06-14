declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toContainEqual(expected: unknown): void;
    toHaveLength(expected: number): void;
    toBeDefined(): void;
    toBeNull(): void;
    toThrow(expected?: unknown): void;
    not: Matchers;
  }
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Matchers;
  export const mock: {
    module(specifier: string, factory: () => unknown): void;
  };
}

declare var __DEV__: boolean;
