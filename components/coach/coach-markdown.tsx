import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Markdown, {
  hasParents,
  type ASTNode,
  type RenderRules,
} from "react-native-markdown-display";
import { color as token, font, radius as rad, rounded } from "@/lib/tokens";

// Markdown surface for coach replies. The library's default table chrome
// (solid black 1px grid) fights the Bevel-light canvas, so tables are fully
// re-rendered here: hairline row separators only, numeric cells in Geist Mono
// (the app-wide convention for numerals), value columns right-aligned, and a
// horizontal scroll fallback so wide tables never break words mid-glyph.

type CoachMarkdownProps = { text: string };

export const CoachMarkdown = React.memo(function CoachMarkdown({
  text,
}: CoachMarkdownProps) {
  return (
    <Markdown style={markdownStyles} rules={tableRules}>
      {text}
    </Markdown>
  );
});

// ---------------------------------------------------------------------------
// Table rules
// ---------------------------------------------------------------------------

// Cells that are a bare dash ("—" / "–" / "-") mean "no data" — render muted.
const DASH_ONLY_RE = /^[—–-]$/;
// Numeric-ish cells ("354 kcal", "2,365 kg", "-354", "+215 kg", "44%", "1").
const NUMERIC_RE = /^[+\-−]?[\d,.]+(\s?[a-zA-Z%]{1,8})?$/;
// Signed deltas get the positive/negative tint.
const DELTA_RE = /^[+\-−][\d,.]/;

function nodeToText(node: ASTNode): string {
  if (node.type === "text" || node.type === "code_inline") {
    return node.content ?? "";
  }
  return (node.children ?? []).map(nodeToText).join("");
}

type CellAlign = "left" | "right" | "center";

// First column reads left (labels), every other column right (values) — the
// classic data-table layout. An explicit `:---:` alignment in the markdown
// (markdown-it emits a text-align style attribute) wins over the position rule.
function getCellAlign(node: ASTNode, parents: ASTNode[]): CellAlign {
  const styleAttr = node.attributes?.style;
  const explicit =
    typeof styleAttr === "string"
      ? styleAttr.match(/text-align:\s*(left|center|right)/)
      : null;
  if (explicit) return explicit[1] as CellAlign;
  const row = parents[0];
  return row != null && row.children.indexOf(node) > 0 ? "right" : "left";
}

function TableCell({
  node,
  parents,
  children,
  isHeader,
}: {
  node: ASTNode;
  parents: ASTNode[];
  children: React.ReactNode;
  isHeader: boolean;
}) {
  const align = getCellAlign(node, parents);
  const isFirst = parents[0]?.children.indexOf(node) === 0;
  const raw = nodeToText(node).trim();

  let content: React.ReactNode;
  if (isHeader) {
    // Font/size/color cascade onto the leaf <Text> via the `th` style key;
    // the wrapper only steers paragraph alignment.
    content = <Text style={{ textAlign: align }}>{children}</Text>;
  } else if (DASH_ONLY_RE.test(raw)) {
    content = <Text style={[t.noDataText, { textAlign: align }]}>—</Text>;
  } else if (NUMERIC_RE.test(raw)) {
    const deltaStyle = DELTA_RE.test(raw)
      ? raw.startsWith("+")
        ? t.numPositive
        : t.numNegative
      : null;
    content = (
      <Text style={[t.numText, deltaStyle, { textAlign: align }]}>{raw}</Text>
    );
  } else {
    content = <Text style={{ textAlign: align }}>{children}</Text>;
  }

  return (
    <View
      key={node.key}
      style={[
        t.cell,
        isFirst ? t.cellFirst : null,
        align === "right" ? t.cellRight : null,
        align === "center" ? t.cellCenter : null,
      ]}
    >
      {content}
    </View>
  );
}

const tableRules: RenderRules = {
  table: (node, children) => (
    // flexGrow on the content lets narrow tables stretch edge-to-edge inside
    // the card while wide ones overflow into a horizontal scroll.
    <ScrollView
      key={node.key}
      horizontal
      bounces={false}
      showsHorizontalScrollIndicator={false}
      style={t.card}
      contentContainerStyle={t.cardContent}
    >
      <View style={t.table}>{children}</View>
    </ScrollView>
  ),
  tr: (node, children, parents) => {
    const isHeader = hasParents(parents, "thead");
    // The header's bottom rule doubles as the first body row's separator.
    const needsSeparator =
      !isHeader && parents[0]?.children.indexOf(node) !== 0;
    return (
      <View
        key={node.key}
        style={[
          t.row,
          isHeader ? t.headerRow : null,
          needsSeparator ? t.rowSeparator : null,
        ]}
      >
        {children}
      </View>
    );
  },
  th: (node, children, parents) => (
    <TableCell key={node.key} node={node} parents={parents} isHeader>
      {children}
    </TableCell>
  ),
  td: (node, children, parents) => (
    <TableCell key={node.key} node={node} parents={parents} isHeader={false}>
      {children}
    </TableCell>
  ),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const t = StyleSheet.create({
  card: {
    marginVertical: 8,
    backgroundColor: token.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: token.line2,
    ...rounded(rad.sm),
    overflow: "hidden",
  },
  cardContent: { flexGrow: 1 },
  table: { flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "stretch" },
  headerRow: {
    backgroundColor: token.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: token.line2,
  },
  rowSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: token.line,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 92,
    paddingVertical: 9,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  cellFirst: { flexGrow: 1.3, minWidth: 104 },
  cellRight: { alignItems: "flex-end" },
  cellCenter: { alignItems: "center" },
  numText: {
    fontFamily: font.mono[500],
    fontSize: 13,
    lineHeight: 19,
    color: token.text,
  },
  numPositive: { color: token.positive },
  numNegative: { color: token.negative },
  noDataText: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    lineHeight: 19,
    color: token.textMute,
  },
});

// Text props on the th/td keys cascade down to the leaf <Text> nodes the
// library renders inside the custom cells above.
export const markdownStyles = {
  body: {
    fontFamily: font.sans[400],
    fontSize: 15,
    lineHeight: 24,
    color: token.text,
    letterSpacing: -0.07,
  },
  strong: {
    fontFamily: font.sans[600],
    fontWeight: "600" as const,
    color: token.text,
  },
  em: { fontFamily: font.sans[400], fontStyle: "italic" as const },
  link: { color: token.accentDim, textDecorationLine: "underline" as const },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 3 },
  bullet_list_icon: { fontSize: 14, lineHeight: 24, color: token.textMute },
  ordered_list_icon: { fontSize: 14, lineHeight: 24, color: token.textMute },
  heading1: {
    fontFamily: font.sans[600],
    fontSize: 19,
    fontWeight: "600" as const,
    marginTop: 8,
    color: token.text,
  },
  heading2: {
    fontFamily: font.sans[600],
    fontSize: 17,
    fontWeight: "600" as const,
    marginTop: 8,
    color: token.text,
  },
  heading3: {
    fontFamily: font.sans[600],
    fontSize: 16,
    fontWeight: "600" as const,
    marginTop: 6,
    color: token.text,
  },
  paragraph: { marginTop: 0, marginBottom: 8 },
  th: {
    fontFamily: font.sans[600],
    fontWeight: "600" as const,
    fontSize: 12,
    lineHeight: 16,
    color: token.textSoft,
  },
  td: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    lineHeight: 19,
    color: token.text,
    letterSpacing: -0.07,
  },
  code_inline: {
    fontFamily: font.mono[500],
    fontSize: 13,
    color: token.text,
    backgroundColor: token.surface2,
    borderWidth: 0,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  fence: {
    fontFamily: font.mono[400],
    fontSize: 12.5,
    lineHeight: 19,
    color: token.text,
    backgroundColor: token.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: token.line2,
    borderRadius: rad.xs,
    padding: 12,
    marginBottom: 8,
  },
  code_block: {
    fontFamily: font.mono[400],
    fontSize: 12.5,
    lineHeight: 19,
    color: token.text,
    backgroundColor: token.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: token.line2,
    borderRadius: rad.xs,
    padding: 12,
    marginBottom: 8,
  },
  blockquote: {
    backgroundColor: "transparent",
    borderLeftWidth: 3,
    borderLeftColor: token.accent,
    color: token.textSoft,
    marginLeft: 0,
    paddingLeft: 12,
    paddingVertical: 2,
    marginBottom: 8,
  },
  hr: {
    backgroundColor: token.line2,
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
};
