declare module "@ungap/structured-clone" {
  const structuredClone: <T>(value: T, options?: StructuredSerializeOptions) => T;
  export default structuredClone;
}

declare module "@stardazed/streams-text-encoding" {
  export const TextEncoderStream: typeof globalThis.TextEncoderStream;
  export const TextDecoderStream: typeof globalThis.TextDecoderStream;
}

// Used only by tests to render components to markup without a native runtime.
declare module "react-dom/server" {
  import type { ReactElement } from "react";
  export function renderToStaticMarkup(element: ReactElement): string;
}
