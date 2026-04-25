/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  const setupPolyfills = async () => {
    const { polyfillGlobal } = await import(
      // @ts-expect-error — no TS declarations for this internal RN module
      "react-native/Libraries/Utilities/PolyfillFunctions"
    );

    const structuredClone = (await import("@ungap/structured-clone")).default;

    const { TextEncoderStream, TextDecoderStream } = await import(
      "@stardazed/streams-text-encoding"
    );

    if (!("structuredClone" in globalThis)) {
      polyfillGlobal("structuredClone", () => structuredClone);
    }

    polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
    polyfillGlobal("TextDecoderStream", () => TextDecoderStream);
  };

  setupPolyfills();
}

export {};
