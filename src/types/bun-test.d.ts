declare module "bun:test" {
  type TestCallback = () => unknown | Promise<unknown>;
  type TestFunction = ((name: string, callback: TestCallback) => void) & {
    only: (name: string, callback: TestCallback) => void;
    skip: (name: string, callback: TestCallback) => void;
    todo: (name: string, callback?: TestCallback) => void;
  };

  export const describe: TestFunction;
  export const test: TestFunction;
  export const it: TestFunction;
  export const beforeEach: (callback: TestCallback) => void;
  export const afterEach: (callback: TestCallback) => void;
  export const beforeAll: (callback: TestCallback) => void;
  export const afterAll: (callback: TestCallback) => void;
  export const expect: (actual: unknown) => any;
}