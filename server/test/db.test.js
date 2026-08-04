import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const testDbPath = path.join(rootDir, "data", `foodmenu-test-${process.pid}.sqlite`);

process.env.DATABASE_URL = testDbPath;

const store = await import("../src/db.js");

after(() => {
  store.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    const filePath = `${testDbPath}${suffix}`;
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  }
});

test("initializes with a published seed plan", () => {
  store.initializeDatabase();

  const current = store.getCurrentPlan();

  assert.equal(current.title, "Week31");
  assert.equal(current.status, "published");
  assert.equal(current.entries.length, 21);
});

test("creates, updates, publishes, and reads the current plan", () => {
  const draft = store.createWeekPlan({
    year: 2026,
    weekNumber: 32,
    title: "Week32"
  });

  assert.equal(draft.status, "draft");
  assert.equal(draft.entries.length, 21);

  const updated = store.updateWeekPlan(draft.id, {
    ...draft,
    entries: draft.entries.map((entry) =>
      entry.dayOfWeek === 1 && entry.slot === "dinner"
        ? { ...entry, text: "照烧鸡腿，米饭" }
        : entry.dayOfWeek === 1 && entry.slot === "lunch"
          ? { ...entry, text: "牛肉盖饭" }
          : entry
    )
  });

  assert.equal(
    updated.entries.find((entry) => entry.dayOfWeek === 1 && entry.slot === "dinner").text,
    "照烧鸡腿，米饭"
  );
  assert.equal(
    updated.entries.find((entry) => entry.dayOfWeek === 1 && entry.slot === "lunch").text,
    "牛肉盖饭"
  );

  const published = store.publishWeekPlan(draft.id);
  const current = store.getCurrentPlan();
  const version = store.getCurrentPlanVersion();

  assert.equal(published.status, "published");
  assert.equal(current.id, draft.id);
  assert.equal(version.id, draft.id);
  assert.equal(version.version, 2);
});

test("auto-publishes an unpublished plan for the display week", () => {
  const displayWeek = store.getDisplayWeek();
  const existing = store
    .listWeekPlans()
    .find((plan) => plan.year === displayWeek.year && plan.weekNumber === displayWeek.weekNumber);

  if (existing) {
    const current = store.getCurrentPlan();
    assert.equal(current.year, displayWeek.year);
    assert.equal(current.weekNumber, displayWeek.weekNumber);
    return;
  }

  const draft = store.createWeekPlan({
    year: displayWeek.year,
    weekNumber: displayWeek.weekNumber,
    title: `Week${displayWeek.weekNumber}`
  });

  const current = store.getCurrentPlan();

  assert.equal(draft.status, "draft");
  assert.equal(current.id, draft.id);
  assert.equal(current.status, "published");
  assert.equal(current.isDisplayWeekMismatch, false);
});

test("deletes an unlocked plan", () => {
  const draft = store.createWeekPlan({
    year: 2026,
    weekNumber: 33,
    title: "Week33"
  });

  const deleted = store.deleteWeekPlan(draft.id);
  const loaded = store.getWeekPlan(draft.id);

  assert.equal(deleted.id, draft.id);
  assert.equal(loaded, null);
});

test("locks past week plans from editing, publishing, and deleting", () => {
  const past = store.createWeekPlan({
    year: 2026,
    weekNumber: 30,
    title: "Week30"
  });

  assert.equal(store.getWeekPlan(past.id).isLocked, true);
  assert.throws(() => store.updateWeekPlan(past.id, past), /PAST_WEEK_LOCKED/);
  assert.throws(() => store.publishWeekPlan(past.id), /PAST_WEEK_LOCKED/);
  assert.throws(() => store.deleteWeekPlan(past.id), /PAST_WEEK_LOCKED/);
});
