import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:19009/dashboard";
const FLAGS_KEY = "__vf_home_preview_flags";
const outDir = "/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states";

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

async function shot(name) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function setFlags(flags) {
  await page.evaluate(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [FLAGS_KEY, flags]
  );
}

async function clearFlags() {
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
  }, FLAGS_KEY);
}

async function reloadWithFlags(flags = "") {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  if (flags) {
    await setFlags(flags);
  } else {
    await clearFlags();
  }
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
}

async function openExpandedAny() {
  await page.getByTestId("cc-collapsed-open").click();
  await Promise.race([
    page.getByTestId("cc-sheet-cc_expanded_empty").waitFor({ timeout: 6000 }),
    page.getByTestId("cc-sheet-cc_expanded_typing").waitFor({ timeout: 6000 }),
  ]);
}

async function openExpandedEmpty() {
  await page.getByTestId("cc-collapsed-open").click();
  await page.getByTestId("cc-sheet-cc_expanded_empty").waitFor({ timeout: 6000 });
}

await reloadWithFlags("hold_typed_submit");
await shot("01-home-collapsed");

await openExpandedEmpty();
await shot("02-cc-expanded-empty");

await page.getByTestId("cc-input-text").fill("Chicken salad 450 calories");
await page.getByTestId("cc-sheet-cc_expanded_typing").waitFor({ timeout: 4000 });
await shot("03-cc-expanded-typing");

await page.getByTestId("cc-send").click();
await page.getByTestId("cc-sheet-cc_submitting_typed").waitFor({ timeout: 4000 });
await shot("04-cc-submitting-typed");

await Promise.race([
  page.getByTestId("cc-sheet-cc_review_meal").waitFor({ timeout: 6000 }),
  page.getByTestId("cc-sheet-cc_review_workout").waitFor({ timeout: 6000 }),
]);
await shot("05-cc-review-state");

await page.getByTestId("cc-review-save").click();
await Promise.race([
  page.getByTestId("cc-sheet-cc_saving").waitFor({ timeout: 5000 }),
  page.getByTestId("cc-sheet-cc_auto_saving").waitFor({ timeout: 5000 }),
]);
await shot("05-cc-auto-saving");

await page.getByTestId("cc-collapsed-open").waitFor({ timeout: 7000 });
await shot("06-home-after-typed-save");

await reloadWithFlags("hold_typed_submit");
await openExpandedEmpty();
await page.getByTestId("cc-input-text").fill("Bench press 80kg for 10 reps");
await page.getByTestId("cc-send").click();
await page.getByTestId("cc-sheet-cc_submitting_typed").waitFor({ timeout: 4000 });
await page.getByTestId("cc-sheet-cc_review_workout").waitFor({ timeout: 6000 });
await shot("06b-cc-review-workout");
await page.getByTestId("cc-review-save").click();
await page.getByTestId("cc-collapsed-open").waitFor({ timeout: 7000 });

await openExpandedAny();
await page.getByTestId("cc-quick-add-0").click();
await page.getByTestId("cc-sheet-cc_quick_add_saving").waitFor({ timeout: 5000 });
await shot("07-cc-quick-add-saving");

await page.getByTestId("cc-collapsed-open").waitFor({ timeout: 7000 });
await shot("08-home-after-quick-add");

await reloadWithFlags("hold_interpreting");
await page.getByTestId("cc-collapsed-mic").click();
await page.getByTestId("cc-sheet-cc_recording").waitFor({ timeout: 6000 });
await shot("09-cc-recording");

await page.getByTestId("cc-recording-stop").click();
await page.getByTestId("cc-sheet-cc_interpreting_voice").waitFor({ timeout: 6000 });
await shot("10-cc-interpreting-voice");
await page.getByTestId("cc-interpreting-discard").click();

await reloadWithFlags("voice_fail,hold_interpreting");
await page.getByTestId("cc-collapsed-mic").click();
await page.getByTestId("cc-recording-stop").click();
await page.getByTestId("cc-sheet-cc_interpreting_voice").waitFor({ timeout: 6000 });
await page.getByTestId("cc-interpreting-edit").click();
await page.getByTestId("cc-sheet-cc_error").waitFor({ timeout: 6000 });
await shot("11-cc-error-voice");

await page.getByTestId("cc-error-secondary").click();
await page.getByTestId("cc-sheet-cc_expanded_typing").waitFor({ timeout: 6000 });
await shot("12-cc-error-edit-text-fallback");

await reloadWithFlags("typed_fail");
await openExpandedEmpty();
await page.getByTestId("cc-input-text").fill("I had yogurt for breakfast");
await page.getByTestId("cc-send").click();
await page.getByTestId("cc-sheet-cc_error").waitFor({ timeout: 6000 });
await shot("13-cc-error-typed");

await reloadWithFlags("save_fail");
await openExpandedEmpty();
await page.getByTestId("cc-input-text").fill("I had oats for breakfast");
await page.getByTestId("cc-send").click();
await Promise.race([
  page.getByTestId("cc-sheet-cc_review_meal").waitFor({ timeout: 6000 }),
  page.getByTestId("cc-sheet-cc_review_workout").waitFor({ timeout: 6000 }),
]);
await page.getByTestId("cc-review-save").click();
await page.getByTestId("cc-sheet-cc_error").waitFor({ timeout: 6000 });
await shot("14-cc-error-save");

await reloadWithFlags("mic_denied");
await page.getByTestId("cc-collapsed-mic").click();
await page.getByTestId("cc-sheet-cc_error").waitFor({ timeout: 6000 });
await shot("15-cc-error-mic-permission");

await reloadWithFlags("quick_add_fail");
await openExpandedEmpty();
await page.getByTestId("cc-quick-add-0").click();
await page.getByTestId("cc-sheet-cc_error").waitFor({ timeout: 6000 });
await shot("16-cc-error-quick-add");

await reloadWithFlags();
await browser.close();

console.log(`Captured home flow screenshots in ${outDir}`);
