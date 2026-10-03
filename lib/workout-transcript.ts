import { EXERCISE_CATALOG } from "./exercise-catalog";

/** Equipment comes from an explicit identity/catalog item, never a resistance default. */
export function workoutEquipmentLabel(name: string, exerciseType: string) {
  if (exerciseType === "cardio") return "CARDIO";
  const explicit = name.match(/\b(dumbbell|barbell|kettlebell|cable|machine|bodyweight)\b/i)?.[1];
  return (explicit ?? EXERCISE_CATALOG.find((item) => item.name.toLowerCase() === name.toLowerCase())?.equipment ?? "Resistance").toUpperCase();
}

/** Single-identity review cannot represent multiple exercises. Longest catalog
 * names win; ambiguity is rejected for correction, not assigned to a current lift. */
export function assertSingleWorkoutExercise(transcript: string, interpretedName?: string) {
  const text = transcript.toLowerCase().replace(/[-–]/g, " ");
  const matches: Array<{ start: number; end: number; name: string }> = [];
  for (const exercise of [...EXERCISE_CATALOG].sort((a, b) => b.name.length - a.name.length)) {
    const name = exercise.name.toLowerCase().replace(/-/g, " ");
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*")}s?\\b`, "g");
    for (const match of text.matchAll(pattern)) {
      const start = match.index!;
      const end = start + match[0].length;
      if (!matches.some((prior) => start < prior.end && end > prior.start)) {
        matches.push({ start, end, name });
      }
    }
  }
  // Protect the complete, explicitly spoken identity before splitting clauses:
  // its qualifiers (and words such as "and" in Clean and Jerk) are not another
  // exercise. Keep catalog matches separately for the identity checks below.
  const identitySpans: Array<{ start: number; end: number }> = [];
  if (interpretedName?.trim()) {
    const name = interpretedName.toLowerCase().replace(/[-–]/g, " ").trim();
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}s?\\b`, "g");
    for (const match of text.matchAll(pattern)) {
      identitySpans.push({ start: match.index!, end: match.index! + match[0].length });
    }
  }
  const normalize = (name: string) => name.toLowerCase().replace(/[-–]/g, " ").replace(/\s+/g, " ").trim().replace(/\bsquats\b/g, "squat");
  // Equipment is an identity qualifier, not arbitrary numeric scaffold. Extend
  // only an adjacent catalog span whose identity and equipment are preserved.
  // Do not cross punctuation, quantities or clause boundaries to find a lift.
  const equipmentSpans: Array<{ start: number; end: number }> = [];
  if (interpretedName) {
    const returned = normalize(interpretedName);
    const returnedEquipment = workoutEquipmentLabel(interpretedName, "resistance").toLowerCase();
    for (const match of matches) {
      const spoken = normalize(match.name);
      const catalog = EXERCISE_CATALOG.find((item) => normalize(item.name) === spoken);
      const equipment = catalog?.equipment.toLowerCase();
      if (!equipment || equipment !== returnedEquipment ||
          (spoken !== returned && !(equipment === "barbell" && `barbell ${spoken}` === returned))) continue;
      const plural = /^(?:barbell|dumbbell|kettlebell)$/.test(equipment) ? "s?" : "";
      const prefix = text.slice(0, match.start).match(new RegExp(`\\b${equipment}${plural}[ \\t]+$`));
      if (prefix) equipmentSpans.push({ start: match.start - prefix[0].length, end: match.end });
    }
  }
  const spans = [...matches, ...identitySpans, ...equipmentSpans];
  const remainder = [...text].map((char, index) => spans.some((span) => index >= span.start && index < span.end) ? "#" : char).join("");
  // Validate the *whole* remaining scaffold, not a name at an assumed clause
  // position. Numeric-leading counts/reps/weights never make later words safe.
  // Only full preserved identities above may consume arbitrary name tokens.
  const unknownNames = remainder.split(/[,;\r\n]|\b(?:then|and)\b/).flatMap((clause) => {
    const value = clause.trim().replace(/^i\s+did\s+/, "");
    const scaffold = /(?:#+|\d+(?:\.\d+)?|[\s:.!?@()[\]\/×]+|(?:sets?|reps?|of|at|for|x|kgs?|kilograms?|kilos?|lbs?|pounds?|another|backoff|warmup)(?![a-z]))/gy;
    const unconsumed: string[] = [];
    let offset = 0;
    while (offset < value.length) {
      scaffold.lastIndex = offset;
      const token = scaffold.exec(value);
      if (token) {
        offset = scaffold.lastIndex;
      } else {
        // Keep every unconsumed character, including names interleaved among
        // quantities. Unsupported grammar fails closed instead of losing rows.
        unconsumed.push(value[offset++]);
      }
    }
    const name = unconsumed.join("").trim();
    return name ? [name] : [];
  });
  if (new Set(matches.map((match) => match.name)).size > 1) {
    throw new Error("Log one exercise at a time. Split this entry so sets are not assigned to the wrong exercise.");
  }
  if (interpretedName) {
    const explicitEquipment = Array.from(text.matchAll(/\b(dumbbells?|barbells?|kettlebells?|cable|machine|bodyweight)\b/g), (match) => match[1].replace(/s$/, ""));
    const equipment = workoutEquipmentLabel(interpretedName, "resistance").toLowerCase();
    const variants = ["incline", "decline", "romanian", "goblet", "front", "bulgarian", "sumo", "single arm", "close grip"];
    if (explicitEquipment.some((item) => item !== equipment) || variants.some((variant) => text.includes(variant) && !normalize(interpretedName).includes(variant))) {
      throw new Error("Specify the exact exercise and equipment; the interpretation did not preserve them.");
    }
    if (!matches.length && /\b(curls?|rows?|press(?:es)?|raises?)\b/.test(text)) {
      throw new Error("Specify the exact exercise and equipment instead of ambiguous shorthand.");
    }
  }
  if ((unknownNames.length > 0 && (interpretedName || spans.length > 0)) || new Set(unknownNames).size > 1) {
    throw new Error("Log one exercise at a time. Split this entry so sets are not assigned to the wrong exercise.");
  }
  if (interpretedName && matches.some((match) => {
    const spoken = normalize(match.name);
    const returned = normalize(interpretedName);
    const barbellDefault = EXERCISE_CATALOG.find((item) => normalize(item.name) === spoken)?.equipment === "Barbell";
    const explicitlyPreserved = identitySpans.some((span) => match.start >= span.start && match.end <= span.end) &&
      (returned.endsWith(` ${spoken}`) || /\band\b/.test(returned));
    return spoken !== returned && !(barbellDefault && `barbell ${spoken}` === returned) && !explicitlyPreserved;
  })) {
    throw new Error("The interpreted exercise differs from your entry. Specify the exact exercise and equipment, then try again.");
  }
}
