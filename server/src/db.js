import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const dataDir = path.join(rootDir, "data");
const dbPath = process.env.DATABASE_URL || path.join(dataDir, "foodmenu.sqlite");

const days = [0, 1, 2, 3, 4, 5, 6];
const slots = ["morning", "lunch", "dinner"];

fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

function now() {
  return new Date().toISOString();
}

function getIsoWeek(value = new Date()) {
  const current = value;
  const target = new Date(
    Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return {
    year: target.getUTCFullYear(),
    weekNumber: Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  };
}

export function getDisplayWeek(value = new Date()) {
  const target = new Date(value);
  if (target.getDay() === 0) {
    target.setDate(target.getDate() + 1);
  }
  return getIsoWeek(target);
}

function getPreviousWeek({ year, weekNumber }) {
  const monday = new Date(Date.UTC(year, 0, 4 + (weekNumber - 1) * 7));
  const mondayDayNumber = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() + 1 - mondayDayNumber);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() - 1);
  return getIsoWeek(sunday);
}

function getCurrentWeek() {
  return getIsoWeek();
}

function isPastWeekPlan(plan) {
  const currentWeek = getCurrentWeek();
  return (
    plan.year < currentWeek.year ||
    (plan.year === currentWeek.year && plan.weekNumber < currentWeek.weekNumber)
  );
}

function getSetting(key) {
  return db.prepare("select value from app_settings where key = ?").get(key)?.value ?? null;
}

function setSetting(key, value) {
  db.prepare(
    `insert into app_settings (key, value)
     values (?, ?)
     on conflict(key) do update set value = excluded.value`
  ).run(key, String(value));
}

function deleteSetting(key) {
  db.prepare("delete from app_settings where key = ?").run(key);
}

function createEntries(weekPlanId, entries = []) {
  const byKey = new Map(entries.map((entry) => [`${entry.dayOfWeek}:${entry.slot}`, entry]));
  const insert = db.prepare(
    `insert into meal_entries (week_plan_id, day_of_week, slot, text, notes)
     values (?, ?, ?, ?, ?)`
  );

  for (const dayOfWeek of days) {
    for (const slot of slots) {
      const entry = byKey.get(`${dayOfWeek}:${slot}`);
      insert.run(weekPlanId, dayOfWeek, slot, entry?.text ?? "", entry?.notes ?? "");
    }
  }
}

function normalizePlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    weekNumber: row.week_number,
    title: row.title,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

function normalizeEntry(row) {
  return {
    id: row.id,
    weekPlanId: row.week_plan_id,
    dayOfWeek: row.day_of_week,
    slot: row.slot,
    text: row.text,
    notes: row.notes
  };
}

export function initializeDatabase() {
  db.exec(`
    create table if not exists week_plans (
      id integer primary key autoincrement,
      year integer not null,
      week_number integer not null,
      title text not null,
      status text not null check(status in ('draft', 'published')),
      version integer not null default 1,
      created_at text not null,
      updated_at text not null,
      published_at text,
      unique(year, week_number)
    );

    create table if not exists meal_entries (
      id integer primary key autoincrement,
      week_plan_id integer not null,
      day_of_week integer not null check(day_of_week between 0 and 6),
      slot text not null,
      text text not null default '',
      notes text not null default '',
      foreign key (week_plan_id) references week_plans(id) on delete cascade,
      unique(week_plan_id, day_of_week, slot)
    );

    create table if not exists app_settings (
      key text primary key,
      value text not null
    );
  `);

  seedInitialPlan();
  backfillMissingMealEntries();
}

function seedInitialPlan() {
  const count = db.prepare("select count(*) as count from week_plans").get().count;
  if (count > 0) return;

  const seedEntries = [
    { dayOfWeek: 0, slot: "morning", text: "" },
    { dayOfWeek: 0, slot: "lunch", text: "" },
    { dayOfWeek: 0, slot: "dinner", text: "炒酸菜，豉汁凤爪，鸡腿蘑菇汤" },
    { dayOfWeek: 1, slot: "morning", text: "面包香肠生菜" },
    { dayOfWeek: 1, slot: "lunch", text: "" },
    { dayOfWeek: 1, slot: "dinner", text: "清水牛肋条，清蒸娃娃菜" },
    { dayOfWeek: 2, slot: "morning", text: "面包香肠生菜" },
    { dayOfWeek: 2, slot: "lunch", text: "" },
    { dayOfWeek: 2, slot: "dinner", text: "孜然牛肉粒，白菜豆腐" },
    { dayOfWeek: 3, slot: "morning", text: "汉堡包，切达芝士" },
    { dayOfWeek: 3, slot: "lunch", text: "" },
    { dayOfWeek: 3, slot: "dinner", text: "麻辣拌" },
    { dayOfWeek: 4, slot: "morning", text: "汉堡包，切达芝士" },
    { dayOfWeek: 4, slot: "lunch", text: "" },
    { dayOfWeek: 4, slot: "dinner", text: "卤肉饭，冷冻西兰花" },
    { dayOfWeek: 5, slot: "morning", text: "馄饨" },
    { dayOfWeek: 5, slot: "lunch", text: "" },
    { dayOfWeek: 5, slot: "dinner", text: "意大利肉酱面" },
    { dayOfWeek: 6, slot: "morning", text: "馄饨" },
    { dayOfWeek: 6, slot: "lunch", text: "" },
    { dayOfWeek: 6, slot: "dinner", text: "" }
  ];

  const createSeed = db.transaction(() => {
    const timestamp = now();
    const result = db
      .prepare(
        `insert into week_plans
          (year, week_number, title, status, version, created_at, updated_at, published_at)
         values (?, ?, ?, 'published', 1, ?, ?, ?)`
      )
      .run(2026, 31, "Week31", timestamp, timestamp, timestamp);

    createEntries(result.lastInsertRowid, seedEntries);
    setSetting("currentPublishedWeekPlanId", result.lastInsertRowid);
  });

  createSeed();
}

function backfillMissingMealEntries() {
  const plans = db.prepare("select id from week_plans").all();
  const insert = db.prepare(
    `insert into meal_entries (week_plan_id, day_of_week, slot, text, notes)
     values (?, ?, ?, '', '')
     on conflict(week_plan_id, day_of_week, slot) do nothing`
  );

  const backfill = db.transaction(() => {
    for (const plan of plans) {
      for (const dayOfWeek of days) {
        for (const slot of slots) {
          insert.run(plan.id, dayOfWeek, slot);
        }
      }
    }
  });

  backfill();
}

export function listWeekPlans() {
  const currentPublishedWeekPlanId = getSetting("currentPublishedWeekPlanId");
  return db
    .prepare(
      `select * from week_plans
       order by year desc, week_number desc, updated_at desc`
    )
    .all()
    .map((row) => {
      const plan = normalizePlan(row);
      return {
        ...plan,
        isCurrentPublished: String(plan.id) === String(currentPublishedWeekPlanId),
        isLocked: isPastWeekPlan(plan)
      };
    });
}

export function getWeekPlan(id) {
  const currentPublishedWeekPlanId = getSetting("currentPublishedWeekPlanId");
  const plan = normalizePlan(db.prepare("select * from week_plans where id = ?").get(id));
  if (!plan) return null;

  const entries = db
    .prepare(
      `select * from meal_entries
       where week_plan_id = ?
       order by day_of_week asc, slot asc`
    )
    .all(id)
    .map(normalizeEntry);

  return {
    ...plan,
    entries,
    isCurrentPublished: String(plan.id) === String(currentPublishedWeekPlanId),
    isLocked: isPastWeekPlan(plan)
  };
}

function getWeekPlanByWeek(year, weekNumber) {
  const row = db
    .prepare("select id from week_plans where year = ? and week_number = ?")
    .get(year, weekNumber);
  return row ? getWeekPlan(row.id) : null;
}

function publishPlanForDisplay(id) {
  const timestamp = now();
  db.prepare(
    `update week_plans
     set status = 'published',
         version = version + 1,
         updated_at = ?,
         published_at = ?
     where id = ?`
  ).run(timestamp, timestamp, id);
  setSetting("currentPublishedWeekPlanId", id);
}

function addDisplayMetadata(plan, displayWeek) {
  if (!plan) return null;

  const previousWeek = getPreviousWeek(displayWeek);
  const previousPlan = getWeekPlanByWeek(previousWeek.year, previousWeek.weekNumber);
  const previousSundayEntries =
    previousPlan?.entries.filter((entry) => entry.dayOfWeek === 0) ?? [];
  const entries = previousSundayEntries.length
    ? [...previousSundayEntries, ...plan.entries.filter((entry) => entry.dayOfWeek !== 0)]
    : plan.entries;

  return {
    ...plan,
    entries,
    displayWeek,
    previousSundayWeek: previousPlan
      ? { year: previousPlan.year, weekNumber: previousPlan.weekNumber, title: previousPlan.title }
      : null,
    isDisplayWeekMismatch:
      plan.year !== displayWeek.year || plan.weekNumber !== displayWeek.weekNumber
  };
}

export function createWeekPlan({ year, weekNumber, title }) {
  const createPlan = db.transaction(() => {
    const timestamp = now();
    const result = db
      .prepare(
        `insert into week_plans
          (year, week_number, title, status, version, created_at, updated_at)
         values (?, ?, ?, 'draft', 1, ?, ?)`
      )
      .run(year, weekNumber, title || `Week${weekNumber}`, timestamp, timestamp);

    createEntries(result.lastInsertRowid);
    return getWeekPlan(result.lastInsertRowid);
  });

  return createPlan();
}

export function updateWeekPlan(id, { year, weekNumber, title, entries }) {
  const updatePlan = db.transaction(() => {
    const current = getWeekPlan(id);
    if (!current) return null;
    if (current.isLocked) {
      throw new Error("PAST_WEEK_LOCKED");
    }

    db.prepare(
      `update week_plans
       set year = ?, week_number = ?, title = ?, updated_at = ?
       where id = ?`
    ).run(year, weekNumber, title, now(), id);

    const updateEntry = db.prepare(
      `insert into meal_entries (week_plan_id, day_of_week, slot, text, notes)
       values (?, ?, ?, ?, ?)
       on conflict(week_plan_id, day_of_week, slot)
       do update set text = excluded.text, notes = excluded.notes`
    );

    for (const entry of entries || []) {
      updateEntry.run(id, entry.dayOfWeek, entry.slot, entry.text ?? "", entry.notes ?? "");
    }

    return getWeekPlan(id);
  });

  return updatePlan();
}

export function publishWeekPlan(id) {
  const publishPlan = db.transaction(() => {
    const current = getWeekPlan(id);
    if (!current) return null;
    if (current.isLocked) {
      throw new Error("PAST_WEEK_LOCKED");
    }

    publishPlanForDisplay(id);
    return getWeekPlan(id);
  });

  return publishPlan();
}

export function deleteWeekPlan(id) {
  const deletePlan = db.transaction(() => {
    const current = getWeekPlan(id);
    if (!current) return null;
    if (current.isLocked) {
      throw new Error("PAST_WEEK_LOCKED");
    }

    const currentPublishedWeekPlanId = getSetting("currentPublishedWeekPlanId");
    db.prepare("delete from week_plans where id = ?").run(id);
    if (String(id) === String(currentPublishedWeekPlanId)) {
      deleteSetting("currentPublishedWeekPlanId");
    }

    return current;
  });

  return deletePlan();
}

export function getCurrentPlan() {
  const loadCurrentPlan = db.transaction(() => {
    const displayWeek = getDisplayWeek();
    const displayPlan = getWeekPlanByWeek(displayWeek.year, displayWeek.weekNumber);

    if (displayPlan) {
      if (displayPlan.status !== "published") {
        publishPlanForDisplay(displayPlan.id);
      } else {
        setSetting("currentPublishedWeekPlanId", displayPlan.id);
      }

      return addDisplayMetadata(getWeekPlan(displayPlan.id), displayWeek);
    }

    const id = getSetting("currentPublishedWeekPlanId");
    if (!id) return null;

    const plan = getWeekPlan(id);
    if (!plan || plan.status !== "published") return null;
    return addDisplayMetadata(plan, displayWeek);
  });

  return loadCurrentPlan();
}

export function getCurrentPlanVersion() {
  const plan = getCurrentPlan();
  if (!plan) return null;
  return {
    id: plan.id,
    version: plan.version,
    publishedAt: plan.publishedAt,
    displayWeek: plan.displayWeek,
    isDisplayWeekMismatch: plan.isDisplayWeekMismatch
  };
}
