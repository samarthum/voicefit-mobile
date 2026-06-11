import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render the coach markdown surface without a native runtime: stub react-native
// with DOM-friendly primitives, then assert on the serialized styles. Styles
// land in a data-style attribute because react-dom rejects RN style objects.

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, item) => ({ ...acc, ...flatten(item) }),
      {},
    );
  }
  if (style != null && typeof style === "object") {
    return style as Record<string, unknown>;
  }
  return {};
}

const stub =
  (tag: string) =>
  ({ style, children }: { style?: unknown; children?: React.ReactNode }) =>
    React.createElement(
      tag,
      { "data-style": JSON.stringify(flatten(style)) },
      children,
    );

mock.module("react-native", () => ({
  Text: stub("x-text"),
  View: stub("x-view"),
  ScrollView: stub("x-scroll"),
  TouchableWithoutFeedback: stub("x-touch"),
  Image: stub("x-image"),
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios },
  Linking: { openURL: () => Promise.resolve() },
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    flatten,
    hairlineWidth: 0.5,
  },
}));

const { CoachMarkdown } = await import("../coach-markdown");

const COMPARISON_TABLE = `Last two Mondays compared

| Metric | Mon Jun 1 | Mon Jun 8 | Change |
| --- | --- | --- | --- |
| Calories logged | 354 kcal | 0 kcal | -354 |
| Protein | 44 g | — | not comparable |
| Steps | — | — | no data |
| Workouts | 1 | 1 | same |
| Workout volume | 2,365 kg | 2,580 kg | **+215 kg** |

**Takeaway:** training was consistent.`;

function render(text: string): string {
  return renderToStaticMarkup(<CoachMarkdown text={text} />);
}

describe("CoachMarkdown tables", () => {
  test("renders a comparison table inside a horizontal scroll card", () => {
    const html = render(COMPARISON_TABLE);
    expect(html).toContain("<x-scroll");
    expect(html).toContain("Workout volume");
    expect(html).toContain("Takeaway");
  });

  test("numeric cells use the mono numeral face", () => {
    const html = render(COMPARISON_TABLE);
    const monoCells = html
      .split("<x-text")
      .filter((chunk) => chunk.includes("GeistMono_500Medium"));
    expect(monoCells.some((chunk) => chunk.includes("2,365 kg"))).toBe(true);
    expect(monoCells.some((chunk) => chunk.includes("354 kcal"))).toBe(true);
  });

  test("signed deltas are tinted, plain numbers are not", () => {
    const html = render(COMPARISON_TABLE);
    const cells = html.split("<x-text");
    const positive = cells.find((chunk) => chunk.includes("+215 kg"));
    const negative = cells.find((chunk) => chunk.includes("-354"));
    const plain = cells.find((chunk) => chunk.includes("0 kcal"));
    expect(positive).toContain("#34A853");
    expect(negative).toContain("#D9534F");
    expect(plain).not.toContain("#34A853");
    expect(plain).not.toContain("#D9534F");
  });

  test("bare-dash cells render muted", () => {
    const html = render(COMPARISON_TABLE);
    const dashCell = html
      .split("<x-text")
      .find((chunk) => chunk.includes("#9AA0AB"));
    expect(dashCell).toBeDefined();
    expect(dashCell).toContain("—");
  });

  test("value columns right-align, label column does not", () => {
    const html = render(COMPARISON_TABLE);
    const cells = html.split("<x-text");
    const valueCell = cells.find((chunk) => chunk.includes("44 g"));
    expect(valueCell).toContain('&quot;textAlign&quot;:&quot;right&quot;');
    const labelCell = cells.find((chunk) => chunk.includes("Protein"));
    expect(labelCell).not.toContain("right");
  });

  test("explicit markdown alignment wins over the position rule", () => {
    const html = render(
      "| A | B |\n| :--- | :---: |\n| left | centered |",
    );
    const centered = html
      .split("<x-text")
      .find((chunk) => chunk.includes("centered"));
    expect(centered).toContain('&quot;textAlign&quot;:&quot;center&quot;');
  });

  test("plain prose still renders without tables", () => {
    const html = render("Just a **plain** answer with `code`.");
    expect(html).not.toContain("<x-scroll");
    expect(html).toContain("plain");
    expect(html).toContain("code");
  });
});
