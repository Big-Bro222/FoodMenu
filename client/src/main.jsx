import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Check,
  Eye,
  FilePlus2,
  Home,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";

const DAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const SLOTS = [
  { key: "morning", label: "上午" },
  { key: "lunch", label: "午饭" },
  { key: "dinner", label: "晚饭" }
];
const CACHE_KEY = "food-menu:lastPublishedPlan";
const FULLSCREEN_INTENT_KEY = "food-menu:displayFullscreenIntent";
const REFRESH_INTERVAL_SECONDS = 45;
const FOOD_EMOJI_RULES = [
  { emoji: "🍗", keywords: ["鸡腿", "凤爪", "鸡翅", "鸡肉", "鸡"] },
  { emoji: "🥩", keywords: ["牛肋条", "牛肉", "牛"] },
  { emoji: "🥓", keywords: ["卤肉", "猪肉", "排骨", "肉酱", "肉"] },
  { emoji: "🍄", keywords: ["蘑菇", "香菇", "菌"] },
  { emoji: "🥬", keywords: ["酸菜", "生菜", "白菜", "娃娃菜", "西兰花", "青菜", "菜"] },
  { emoji: "🧀", keywords: ["芝士", "奶酪"] },
  { emoji: "🍞", keywords: ["面包", "吐司"] },
  { emoji: "🍔", keywords: ["汉堡"] },
  { emoji: "🍚", keywords: ["米饭", "卤肉饭", "饭"] },
  { emoji: "🍜", keywords: ["面", "汤"] },
  { emoji: "🍝", keywords: ["意大利", "意面", "肉酱面"] },
  { emoji: "🌶️", keywords: ["麻辣", "辣"] },
  { emoji: "🧄", keywords: ["蒜"] },
  { emoji: "🥚", keywords: ["鸡蛋", "蛋"] },
  { emoji: "🥟", keywords: ["馄饨", "饺子", "包子"] },
  { emoji: "🫘", keywords: ["豆腐", "豆"] },
  { emoji: "🐟", keywords: ["三文鱼", "鱼"] }
];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : { error: await response.text().catch(() => "") };
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function isPadDisplayViewport() {
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    window.matchMedia("(orientation: portrait)").matches &&
    window.innerWidth <= 900 &&
    window.innerHeight >= 700
  );
}

function requestPageFullscreen() {
  return (
    document.documentElement.requestFullscreen?.() ||
    document.documentElement.webkitRequestFullscreen?.()
  );
}

function exitPageFullscreen() {
  return document.exitFullscreen?.() || document.webkitExitFullscreen?.();
}

function FullscreenButton({ compact = false, autoResumeOnPad = false }) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(getFullscreenElement()));
  const [shouldAutoFullscreen, setShouldAutoFullscreen] = useState(
    () => autoResumeOnPad && window.localStorage.getItem(FULLSCREEN_INTENT_KEY) === "on"
  );
  const canUseFullscreen = Boolean(
    document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen
  );

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!autoResumeOnPad || !shouldAutoFullscreen || !canUseFullscreen) return undefined;

    const tryResumeFullscreen = () => {
      const wantsFullscreen = window.localStorage.getItem(FULLSCREEN_INTENT_KEY) === "on";
      if (!wantsFullscreen || !isPadDisplayViewport() || getFullscreenElement()) return;
      requestPageFullscreen()?.catch(() => {});
    };

    const scheduleResumeFullscreen = () => {
      window.setTimeout(tryResumeFullscreen, 180);
    };

    scheduleResumeFullscreen();
    document.addEventListener("fullscreenchange", scheduleResumeFullscreen);
    document.addEventListener("webkitfullscreenchange", scheduleResumeFullscreen);
    window.addEventListener("focus", scheduleResumeFullscreen);
    window.addEventListener("orientationchange", scheduleResumeFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", scheduleResumeFullscreen);
      document.removeEventListener("webkitfullscreenchange", scheduleResumeFullscreen);
      window.removeEventListener("focus", scheduleResumeFullscreen);
      window.removeEventListener("orientationchange", scheduleResumeFullscreen);
    };
  }, [autoResumeOnPad, canUseFullscreen, shouldAutoFullscreen]);

  const toggleFullscreen = async () => {
    if (!canUseFullscreen) return;

    if (getFullscreenElement()) {
      if (autoResumeOnPad && isPadDisplayViewport()) {
        window.localStorage.setItem(FULLSCREEN_INTENT_KEY, "off");
        setShouldAutoFullscreen(false);
      }
      await exitPageFullscreen();
      return;
    }

    if (autoResumeOnPad && isPadDisplayViewport()) {
      window.localStorage.setItem(FULLSCREEN_INTENT_KEY, "on");
      setShouldAutoFullscreen(true);
    }
    await requestPageFullscreen();
  };

  return (
    <button
      className={compact ? "fullscreen-button compact" : "fullscreen-button"}
      type="button"
      onClick={toggleFullscreen}
      disabled={!canUseFullscreen}
    >
      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      {isFullscreen ? "退出全屏" : "全屏"}
    </button>
  );
}

function getCurrentWeek(value = new Date()) {
  const now = value;
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return {
    year: target.getUTCFullYear(),
    weekNumber: Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  };
}

function getDisplayWeek(value = new Date()) {
  const target = new Date(value);
  if (target.getDay() === 0) {
    target.setDate(target.getDate() + 1);
  }
  return getCurrentWeek(target);
}

function getDefaultTitle(weekNumber) {
  return `Week${weekNumber}`;
}

function formatTime(value) {
  if (!value) return "尚未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDisplayDate(value = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(value);
}

function entriesByCell(entries = []) {
  return new Map(entries.map((entry) => [`${entry.dayOfWeek}:${entry.slot}`, entry]));
}

function getCellKey(dayOfWeek, slot) {
  return `${dayOfWeek}:${slot}`;
}

function plansDiffer(leftPlan, rightPlan) {
  if (!leftPlan || !rightPlan) return false;

  const left = entriesByCell(leftPlan.entries);
  const right = entriesByCell(rightPlan.entries);

  for (const dayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
    for (const slot of SLOTS) {
      const key = getCellKey(dayOfWeek, slot.key);
      const leftEntry = left.get(key);
      const rightEntry = right.get(key);
      if ((leftEntry?.text || "") !== (rightEntry?.text || "")) return true;
      if ((leftEntry?.notes || "") !== (rightEntry?.notes || "")) return true;
    }
  }

  return false;
}

function createSeededRandom(seedText) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getMenuText(plan) {
  return (plan?.entries || [])
    .map((entry) => entry.text || "")
    .filter(Boolean)
    .join(" ");
}

function detectFoodEmojis(plan) {
  const menuText = getMenuText(plan);
  if (!menuText) return [];

  return FOOD_EMOJI_RULES.filter((rule) =>
    rule.keywords.some((keyword) => menuText.includes(keyword))
  ).map((rule) => rule.emoji);
}

function createMenuStickers(plan, isOnline) {
  if (!isOnline) return [];

  const emojis = detectFoodEmojis(plan);
  if (!emojis.length) return [];

  const random = createSeededRandom(`${plan?.id || "menu"}:${plan?.version || 0}:${getMenuText(plan)}`);
  const count = Math.min(14, Math.max(8, emojis.length * 2));
  const columns = 4;
  const rows = Math.ceil(count / columns);

  return Array.from({ length: count }, (_, index) => ({
    id: `${index}-${emojis[index % emojis.length]}`,
    emoji: emojis[Math.floor(random() * emojis.length)],
    left: ((index % columns) + 0.5 + (random() - 0.5) * 0.52) * (100 / columns),
    top: (Math.floor(index / columns) + 0.5 + (random() - 0.5) * 0.48) * (100 / rows),
    size: 34 + random() * 32,
    rotation: -42 + random() * 84
  }));
}

function PlanTable({
  plan,
  editable = false,
  movable = false,
  variant = "display",
  highlightToday = false,
  currentDate = new Date(),
  onChange,
  children
}) {
  const byCell = useMemo(() => entriesByCell(plan?.entries), [plan]);
  const longPressRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const today = currentDate.getDay();
  const canMove = movable && !editable && Boolean(onChange);

  const clearLongPress = () => {
    if (longPressRef.current?.timer) {
      window.clearTimeout(longPressRef.current.timer);
    }
    longPressRef.current = null;
  };

  const upsertEntry = (entries, nextEntry) => {
    const index = entries.findIndex(
      (entry) => entry.dayOfWeek === nextEntry.dayOfWeek && entry.slot === nextEntry.slot
    );

    if (index >= 0) {
      entries[index] = { ...entries[index], ...nextEntry };
    } else {
      entries.push(nextEntry);
    }
  };

  const updateCell = (dayOfWeek, slot, text) => {
    if (!onChange) return;
    const existing = byCell.get(`${dayOfWeek}:${slot}`);
    const nextEntries = [...(plan.entries || [])];
    upsertEntry(nextEntries, {
      id: existing?.id,
      weekPlanId: plan.id,
      dayOfWeek,
      slot,
      text,
      notes: existing?.notes || ""
    });

    onChange({ ...plan, entries: nextEntries });
  };

  const swapCells = (source, target) => {
    if (!onChange || !source || !target) return;
    if (getCellKey(source.dayOfWeek, source.slot) === getCellKey(target.dayOfWeek, target.slot)) {
      return;
    }

    const sourceEntry = byCell.get(getCellKey(source.dayOfWeek, source.slot));
    const targetEntry = byCell.get(getCellKey(target.dayOfWeek, target.slot));
    const nextEntries = [...(plan.entries || [])];

    upsertEntry(nextEntries, {
      id: sourceEntry?.id,
      weekPlanId: plan.id,
      dayOfWeek: source.dayOfWeek,
      slot: source.slot,
      text: targetEntry?.text || "",
      notes: targetEntry?.notes || ""
    });

    upsertEntry(nextEntries, {
      id: targetEntry?.id,
      weekPlanId: plan.id,
      dayOfWeek: target.dayOfWeek,
      slot: target.slot,
      text: sourceEntry?.text || "",
      notes: sourceEntry?.notes || ""
    });

    onChange({ ...plan, entries: nextEntries });
  };

  const getTargetCell = (event) => {
    const element = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-meal-cell='true']");

    if (!element) return null;

    return {
      dayOfWeek: Number(element.dataset.dayOfWeek),
      slot: element.dataset.slot
    };
  };

  const beginLongPress = (event, dayOfWeek, slot) => {
    if (!canMove || (event.pointerType === "mouse" && event.button !== 0)) return;

    clearLongPress();

    const source = { dayOfWeek, slot };
    const sourceEntry = byCell.get(getCellKey(dayOfWeek, slot));
    const delay = event.pointerType === "mouse" ? 280 : 760;
    const cell = event.currentTarget;
    longPressRef.current = {
      pointerId: event.pointerId,
      timer: window.setTimeout(() => {
        cell.setPointerCapture?.(event.pointerId);
        setDragState({
          active: true,
          source,
          target: source,
          pointer: { x: event.clientX, y: event.clientY },
          label: SLOTS.find((item) => item.key === slot)?.label || "",
          text: sourceEntry?.text || ""
        });
      }, delay)
    };
  };

  const updateDragTarget = (event) => {
    if (!dragState?.active) return;
    event.preventDefault();
    const target = getTargetCell(event);
    setDragState((current) =>
      current
        ? {
            ...current,
            pointer: { x: event.clientX, y: event.clientY },
            target: target || current.target
          }
        : current
    );
  };

  const finishDrag = (event) => {
    clearLongPress();
    if (!dragState?.active) return;
    event.preventDefault();
    const target = getTargetCell(event) || dragState.target;
    swapCells(dragState.source, target);
    setDragState(null);
  };

  const cancelDrag = () => {
    clearLongPress();
    setDragState(null);
  };

  useEffect(() => clearLongPress, []);

  if (!plan) {
    return <div className="empty-state">暂无已发布计划</div>;
  }

  const getMealCellClassName = (dayOfWeek, slot) => {
    const cellKey = getCellKey(dayOfWeek, slot);
    const sourceKey = dragState?.source
      ? getCellKey(dragState.source.dayOfWeek, dragState.source.slot)
      : null;
    const targetKey = dragState?.target
      ? getCellKey(dragState.target.dayOfWeek, dragState.target.slot)
      : null;

    return [
      canMove ? "movable-meal-cell" : "",
      dragState?.active && sourceKey === cellKey ? "meal-drag-source" : "",
      dragState?.active && targetKey === cellKey ? "meal-drag-target" : ""
    ]
      .filter(Boolean)
      .join(" ");
  };

  const getMoveHandlers = (dayOfWeek, slot) => {
    if (!canMove) return {};

    return {
      onContextMenu: (event) => event.preventDefault(),
      onPointerCancel: cancelDrag,
      onPointerDown: (event) => beginLongPress(event, dayOfWeek, slot),
      onPointerLeave: updateDragTarget,
      onPointerMove: updateDragTarget,
      onPointerUp: finishDrag
    };
  };

  if (!editable && variant === "display") {
    return (
      <div className="display-meal-board">
        {dragState?.active ? (
          <div
            className="meal-drag-preview"
            style={{
              left: `${dragState.pointer.x}px`,
              top: `${dragState.pointer.y}px`
            }}
          >
            <span>{dragState.label}</span>
            <strong>{dragState.text || "空餐格"}</strong>
          </div>
        ) : null}
        {DAYS.map((day, dayOfWeek) => (
          <section
            className={highlightToday && dayOfWeek === today ? "display-day today-row" : "display-day"}
            key={day}
          >
            <div className="display-day-label">
              <strong>{day}</strong>
              {highlightToday && dayOfWeek === today ? <span>今天</span> : null}
            </div>
            <div className="display-day-meals">
              {SLOTS.map((slot) => {
                const entry = byCell.get(getCellKey(dayOfWeek, slot.key));
                const cellClassName = getMealCellClassName(dayOfWeek, slot.key);

                return (
                  <article
                    className={`display-meal-card ${slot.key} ${cellClassName}`}
                    data-day-of-week={dayOfWeek}
                    data-meal-cell={canMove ? "true" : undefined}
                    data-slot={slot.key}
                    key={slot.key}
                    {...getMoveHandlers(dayOfWeek, slot.key)}
                  >
                    <span>{slot.label}</span>
                    <strong>{entry?.text || " "}</strong>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {children}
      </div>
    );
  }

  return (
    <table
      className={
        editable
          ? "plan-table editable-table"
          : variant === "compact"
            ? "plan-table readonly-table"
            : "plan-table display-table"
      }
    >
      <thead>
        <tr>
          <th>星期</th>
          {SLOTS.map((slot) => (
            <th key={slot.key}>{slot.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {DAYS.map((day, dayOfWeek) => (
          <tr
            className={highlightToday && dayOfWeek === today ? "today-row" : undefined}
            key={day}
          >
            <th>
              <span>{day}</span>
              {highlightToday && dayOfWeek === today ? <small>今天</small> : null}
            </th>
            {SLOTS.map((slot) => {
              const entry = byCell.get(`${dayOfWeek}:${slot.key}`);

              return (
                <td key={slot.key}>
                  {editable ? (
                    <textarea
                      value={entry?.text || ""}
                      onChange={(event) => updateCell(dayOfWeek, slot.key, event.target.value)}
                      aria-label={`${day}${slot.label}`}
                    />
                  ) : (
                    <span className="meal-text">{entry?.text || " "}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DisplayPage() {
  const [plan, setPlan] = useState(() => {
    const cached = window.localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [serverPlan, setServerPlan] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(plan?.publishedAt || null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const displayWeek = useMemo(() => getDisplayWeek(currentDate), [currentDate]);
  const weekLabel = plan
    ? `${plan.year}-W${String(plan.weekNumber).padStart(2, "0")}`
    : "等待发布";
  const hasWeekWarning = Boolean(
    plan && (plan.year !== displayWeek.year || plan.weekNumber !== displayWeek.weekNumber)
  );
  const isLocallyAdjusted = useMemo(
    () =>
      Boolean(
        plan &&
          serverPlan &&
          plan.id === serverPlan.id &&
          plan.version === serverPlan.version &&
          plansDiffer(plan, serverPlan)
      ),
    [plan, serverPlan]
  );
  const menuStickers = useMemo(() => createMenuStickers(plan, isOnline), [plan, isOnline]);

  const cacheDisplayPlan = (nextPlan) => {
    setPlan(nextPlan);
    setLastUpdated(new Date().toISOString());
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(nextPlan));
  };

  const loadPlan = async ({ quiet = false } = {}) => {
    try {
      const data = await api("/api/current-plan");
      setServerPlan(data.plan);
      setPlan((currentPlan) => {
        const shouldKeepLocalAdjustment =
          currentPlan &&
          currentPlan.id === data.plan.id &&
          currentPlan.version === data.plan.version &&
          plansDiffer(currentPlan, data.plan);
        const nextPlan = shouldKeepLocalAdjustment ? currentPlan : data.plan;
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(nextPlan));
        setLastUpdated(new Date().toISOString());
        return nextPlan;
      });
      setIsOnline(true);
    } catch (_error) {
      setIsOnline(false);
      if (!quiet && !plan) {
        setPlan(null);
      }
    }
  };

  useEffect(() => {
    loadPlan();

    const interval = window.setInterval(async () => {
      try {
        const version = await api("/api/current-plan/version");
        setIsOnline(true);
        if (!plan || version.id !== plan.id || version.version !== plan.version) {
          await loadPlan({ quiet: true });
        }
      } catch (_error) {
        setIsOnline(false);
      }
    }, REFRESH_INTERVAL_SECONDS * 1000);

    return () => window.clearInterval(interval);
  }, [plan?.id, plan?.version]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  const adjustDisplayPlan = (nextPlan) => {
    cacheDisplayPlan(nextPlan);
  };

  const applyDisplayChangesToAdmin = async () => {
    if (!plan) return;

    try {
      const data = await api(`/api/week-plans/${plan.id}`, {
        method: "PUT",
        body: JSON.stringify(plan)
      });
      const published = await api(`/api/week-plans/${plan.id}/publish`, { method: "POST" });
      const nextPlan = published.plan || data.plan;
      setServerPlan(nextPlan);
      cacheDisplayPlan(nextPlan);
      setIsOnline(true);
    } catch (_error) {
      setIsOnline(false);
    }
  };

  const discardDisplayChanges = () => {
    if (!serverPlan) return;
    cacheDisplayPlan(serverPlan);
  };

  const refreshDisplayPlan = () => {
    loadPlan({ quiet: true });
  };

  return (
    <main className="display-page">
      <header className="display-header">
        <div className="display-title-block">
          <p className="display-kicker">家庭餐食计划</p>
          <h1>{plan?.title || "Week"}</h1>
          <div className="display-subline">
            <span>{formatDisplayDate(currentDate)}</span>
            <span className={hasWeekWarning ? "display-week-chip warning" : "display-week-chip"}>
              {weekLabel}
              {hasWeekWarning ? <AlertTriangle size={16} /> : null}
            </span>
          </div>
        </div>
        <div className="display-side-panel">
          <div className={isOnline ? "display-status online" : "display-status offline"}>
            {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
            <span>{isOnline ? "在线" : "离线"}</span>
            <button
              aria-label="Refresh display data"
              className="display-refresh-button"
              title="Refresh"
              type="button"
              disabled={!isOnline}
              onClick={refreshDisplayPlan}
            >
              <RefreshCw size={16} />
            </button>
            <small>{formatTime(lastUpdated)}</small>
          </div>
          <div className="display-note">
            <span>当前展示</span>
            <strong>{plan?.title || "暂无计划"}</strong>
          </div>
          <FullscreenButton autoResumeOnPad />
          {isLocallyAdjusted ? (
            <div className="display-sync adjusted">
              <span>和管理端不同</span>
              <button type="button" onClick={applyDisplayChangesToAdmin}>
                保存到管理端
              </button>
              <button type="button" onClick={discardDisplayChanges}>
                放弃调整
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <section className="display-board">
        {menuStickers.length ? (
          <div className="menu-sticker-layer" aria-hidden="true">
            {menuStickers.map((sticker) => (
              <span
                className="menu-sticker"
                key={sticker.id}
                style={{
                  "--sticker-left": `${sticker.left}%`,
                  "--sticker-top": `${sticker.top}%`,
                  "--sticker-size": `${sticker.size}px`,
                  "--sticker-rotation": `${sticker.rotation}deg`
                }}
              >
                {sticker.emoji}
              </span>
            ))}
          </div>
        ) : null}
        <PlanTable
          plan={plan}
          movable
          highlightToday
          currentDate={currentDate}
          onChange={adjustDisplayPlan}
        >
          <article className="display-info-card">
            <div className="display-info-title">
              <span>家庭餐食计划</span>
              <strong>{plan?.title || "暂无计划"}</strong>
              <small>
                {formatDisplayDate(currentDate)} ·{" "}
                <span className={hasWeekWarning ? "display-info-week warning" : "display-info-week"}>
                  {weekLabel}
                  {hasWeekWarning ? <AlertTriangle size={13} /> : null}
                </span>
              </small>
              <small>每 {REFRESH_INTERVAL_SECONDS} 秒检查更新</small>
            </div>
            <div className="display-info-row">
              {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
              <span>{isOnline ? "在线" : "离线"}</span>
              <button
                aria-label="Refresh display data"
                className="display-refresh-button"
                title="Refresh"
                type="button"
                disabled={!isOnline}
                onClick={refreshDisplayPlan}
              >
                <RefreshCw size={16} />
              </button>
              <small>{formatTime(lastUpdated)}</small>
            </div>
            <FullscreenButton compact autoResumeOnPad />
            {isLocallyAdjusted ? (
              <div className="display-info-actions">
                <span>和管理端不同</span>
                <button type="button" onClick={applyDisplayChangesToAdmin}>
                  保存到管理端
                </button>
                <button type="button" onClick={discardDisplayChanges}>
                  放弃调整
                </button>
              </div>
            ) : null}
          </article>
        </PlanTable>
      </section>
    </main>
  );
}

function AdminLayout({ children }) {
  return (
    <main className="admin-page">
      <nav className="admin-nav">
        <div className="admin-brand">
          <span>FoodMenu</span>
          <strong>家庭餐食计划</strong>
        </div>
        <div className="admin-nav-actions">
          <button type="button" onClick={() => navigate("/admin")}>
            <Home size={18} />
            管理端
          </button>
          <button type="button" onClick={() => navigate("/display")}>
            <Eye size={18} />
            展示端
          </button>
        </div>
      </nav>
      {children}
    </main>
  );
}

function AdminListPage() {
  const currentWeek = getDisplayWeek();
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    year: currentWeek.year,
    weekNumber: currentWeek.weekNumber,
    title: getDefaultTitle(currentWeek.weekNumber)
  });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const loadPlans = async () => {
    setStatus("loading");
    try {
      const data = await api("/api/week-plans");
      setPlans(data.plans);
      setStatus("idle");
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const createPlan = async (event) => {
    event.preventDefault();
    const year = Number(form.year);
    const weekNumber = Number(form.weekNumber);
    const existingPlan = plans.find(
      (plan) => plan.year === year && plan.weekNumber === weekNumber
    );

    if (existingPlan) {
      navigate(`/admin/week-plans/${existingPlan.id}`);
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      const data = await api("/api/week-plans", {
        method: "POST",
        body: JSON.stringify({
          year,
          weekNumber,
          title: form.title
        })
      });
      navigate(`/admin/week-plans/${data.plan.id}`);
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  };

  const publishPlan = async (id) => {
    setStatus("publishing");
    setMessage("");
    try {
      await api(`/api/week-plans/${id}/publish`, { method: "POST" });
      await loadPlans();
      setMessage("已发布到展示端");
      setStatus("idle");
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  };

  const deletePlan = async (plan) => {
    const confirmed = window.confirm(`确定删除 ${plan.title} 吗？这个操作不能撤销。`);
    if (!confirmed) return;

    setStatus("deleting");
    setMessage("");
    try {
      await api(`/api/week-plans/${plan.id}`, { method: "DELETE" });
      await loadPlans();
      setMessage("计划已删除");
      setStatus("idle");
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  };

  return (
    <AdminLayout>
      <section className="admin-heading">
        <div>
          <p>本地管理</p>
          <h1>每周计划</h1>
        </div>
      </section>

      <form className="new-plan-form" onSubmit={createPlan}>
        <label>
          年份
          <input
            type="number"
            value={form.year}
            onChange={(event) => setForm({ ...form, year: event.target.value })}
          />
        </label>
        <label>
          周数
          <input
            type="number"
            min="1"
            max="53"
            value={form.weekNumber}
            onChange={(event) =>
              setForm({
                ...form,
                weekNumber: event.target.value,
                title: getDefaultTitle(event.target.value)
              })
            }
          />
        </label>
        <label>
          标题
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <button type="submit" disabled={status === "saving"}>
          <FilePlus2 size={18} />
          新建
        </button>
      </form>

      {message ? (
        <div className={status === "error" ? "notice error" : "notice success"}>
          {status === "error" ? <WifiOff size={18} /> : <Check size={18} />}
          {message}
        </div>
      ) : null}

      <section className="plan-list">
        {status === "loading" ? (
          <div className="loading-line">
            <Loader2 size={18} />
            加载中
          </div>
        ) : null}
        {plans.map((plan) => {
          const statusLabel = plan.isCurrentPublished
            ? "当前展示"
            : plan.isLocked
              ? "已锁定"
              : plan.status === "published"
                ? "已发布"
                : "草稿";

          return (
            <article className="plan-row" key={plan.id}>
              <div>
                <strong>{plan.title}</strong>
                <div className="plan-row-meta">
                  <span>{plan.year}-W{String(plan.weekNumber).padStart(2, "0")}</span>
                  <span className={`status-badge ${plan.isLocked ? "locked" : plan.isCurrentPublished ? "current" : plan.status}`}>
                    {statusLabel}
                  </span>
                  <span>v{plan.version}</span>
                </div>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => navigate(`/admin/week-plans/${plan.id}`)}>
                  <Eye size={18} />
                  {plan.isLocked ? "查看" : "编辑"}
                </button>
                {!plan.isLocked ? (
                  <>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => publishPlan(plan.id)}
                      disabled={status === "publishing"}
                    >
                      {status === "publishing" ? <Loader2 size={18} /> : <Send size={18} />}
                      发布
                    </button>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => deletePlan(plan)}
                      disabled={status === "deleting"}
                    >
                      <Trash2 size={18} />
                      删除
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </AdminLayout>
  );
}

function EditorPage({ id }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  const loadPlan = async () => {
    setStatus("loading");
    try {
      const data = await api(`/api/week-plans/${id}`);
      setPlan(data.plan);
      setStatus("idle");
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  };

  useEffect(() => {
    loadPlan();
  }, [id]);

  const savePlan = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const data = await api(`/api/week-plans/${id}`, {
        method: "PUT",
        body: JSON.stringify(plan)
      });
      setPlan(data.plan);
      setStatus("idle");
      setMessage("草稿已保存");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  };

  return (
    <AdminLayout>
      {plan ? (
        <>
          <section className="editor-header">
            <div>
              <p>{plan.isLocked ? "只读" : plan.status === "published" ? "已发布" : "草稿"}</p>
              <h1>{plan.title}</h1>
            </div>
            <div className="editor-actions">
              {!plan.isLocked ? (
                <button type="button" onClick={savePlan} disabled={status === "saving"}>
                  {status === "saving" ? <Loader2 size={18} /> : <Save size={18} />}
                  保存
                </button>
              ) : null}
            </div>
          </section>

          {plan.isLocked ? (
            <div className="notice read-only">
              过去周计划只能查看，不能编辑、发布或删除。
            </div>
          ) : null}

          <section className="plan-meta">
            <label>
              年份
              <input
                type="number"
                value={plan.year}
                disabled={plan.isLocked}
                onChange={(event) => setPlan({ ...plan, year: Number(event.target.value) })}
              />
            </label>
            <label>
              周数
              <input
                type="number"
                min="1"
                max="53"
                value={plan.weekNumber}
                disabled={plan.isLocked}
                onChange={(event) =>
                  setPlan({ ...plan, weekNumber: Number(event.target.value) })
                }
              />
            </label>
            <label>
              标题
              <input
                value={plan.title}
                disabled={plan.isLocked}
                onChange={(event) => setPlan({ ...plan, title: event.target.value })}
              />
            </label>
          </section>

          {message ? (
            <div className={status === "error" ? "notice error" : "notice success"}>
              {status === "error" ? <WifiOff size={18} /> : <Check size={18} />}
              {message}
            </div>
          ) : null}

          <PlanTable
            plan={plan}
            editable={!plan.isLocked}
            variant={plan.isLocked ? "compact" : "display"}
            onChange={plan.isLocked ? undefined : setPlan}
          />
        </>
      ) : (
        <div className="loading-line">
          <RefreshCw size={18} />
          读取计划
        </div>
      )}
    </AdminLayout>
  );
}

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const editorMatch = path.match(/^\/admin\/week-plans\/(\d+)/);
  if (path === "/" || path === "/display") return <DisplayPage />;
  if (path === "/admin") return <AdminListPage />;
  if (editorMatch) return <EditorPage id={editorMatch[1]} />;

  return (
    <AdminLayout>
      <div className="empty-state">
        页面不存在
        <button type="button" onClick={() => navigate("/display")}>
          <Eye size={18} />
          回到展示端
        </button>
      </div>
    </AdminLayout>
  );
}

createRoot(document.getElementById("root")).render(<App />);
