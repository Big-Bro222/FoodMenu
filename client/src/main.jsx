import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  Eye,
  FilePlus2,
  Home,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";

const DAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const SLOTS = [
  { key: "morning", label: "上午" },
  { key: "dinner", label: "晚饭" }
];
const CACHE_KEY = "food-menu:lastPublishedPlan";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOffset = Math.floor((now - start) / 86400000);
  return {
    year: now.getFullYear(),
    weekNumber: Math.ceil((dayOffset + start.getDay() + 1) / 7)
  };
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

function entriesByCell(entries = []) {
  return new Map(entries.map((entry) => [`${entry.dayOfWeek}:${entry.slot}`, entry]));
}

function PlanTable({ plan, editable = false, onChange }) {
  const byCell = useMemo(() => entriesByCell(plan?.entries), [plan]);

  if (!plan) {
    return <div className="empty-state">暂无已发布计划</div>;
  }

  const updateCell = (dayOfWeek, slot, text) => {
    if (!onChange) return;
    const existing = byCell.get(`${dayOfWeek}:${slot}`);
    const nextEntries = [...(plan.entries || [])];
    const index = nextEntries.findIndex(
      (entry) => entry.dayOfWeek === dayOfWeek && entry.slot === slot
    );
    const nextEntry = {
      id: existing?.id,
      weekPlanId: plan.id,
      dayOfWeek,
      slot,
      text,
      notes: existing?.notes || ""
    };

    if (index >= 0) {
      nextEntries[index] = nextEntry;
    } else {
      nextEntries.push(nextEntry);
    }

    onChange({ ...plan, entries: nextEntries });
  };

  return (
    <table className={editable ? "plan-table editable-table" : "plan-table display-table"}>
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
          <tr key={day}>
            <th>{day}</th>
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
                    <span>{entry?.text || " "}</span>
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
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(plan?.publishedAt || null);

  const savePlan = (nextPlan) => {
    setPlan(nextPlan);
    setLastUpdated(new Date().toISOString());
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(nextPlan));
  };

  const loadPlan = async ({ quiet = false } = {}) => {
    try {
      const data = await api("/api/current-plan");
      savePlan(data.plan);
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
    }, 45000);

    return () => window.clearInterval(interval);
  }, [plan?.id, plan?.version]);

  return (
    <main className="display-page">
      <header className="display-header">
        <div>
          <p className="display-kicker">家庭餐食计划</p>
          <h1>{plan?.title || "Week"}</h1>
        </div>
        <div className={isOnline ? "display-status online" : "display-status offline"}>
          {isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
          <span>{isOnline ? "在线" : "离线"}</span>
          <small>{formatTime(lastUpdated)}</small>
        </div>
      </header>
      <PlanTable plan={plan} />
    </main>
  );
}

function AdminLayout({ children }) {
  return (
    <main className="admin-page">
      <nav className="admin-nav">
        <button type="button" onClick={() => navigate("/admin")}>
          <Home size={18} />
          管理端
        </button>
        <button type="button" onClick={() => navigate("/display")}>
          <Eye size={18} />
          展示端
        </button>
      </nav>
      {children}
    </main>
  );
}

function AdminListPage() {
  const currentWeek = getCurrentWeek();
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    year: currentWeek.year,
    weekNumber: currentWeek.weekNumber,
    title: `Week${currentWeek.weekNumber}`
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
    setStatus("saving");
    setMessage("");
    try {
      const data = await api("/api/week-plans", {
        method: "POST",
        body: JSON.stringify({
          year: Number(form.year),
          weekNumber: Number(form.weekNumber),
          title: form.title
        })
      });
      navigate(`/admin/week-plans/${data.plan.id}`);
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
    }
  };

  return (
    <AdminLayout>
      <section className="admin-heading">
        <p>本地管理</p>
        <h1>每周计划</h1>
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
                title: `Week${event.target.value}`
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

      {message ? <div className="notice error">{message}</div> : null}

      <section className="plan-list">
        {status === "loading" ? (
          <div className="loading-line">
            <Loader2 size={18} />
            加载中
          </div>
        ) : null}
        {plans.map((plan) => (
          <article className="plan-row" key={plan.id}>
            <div>
              <strong>{plan.title}</strong>
              <span>
                {plan.year}-W{String(plan.weekNumber).padStart(2, "0")} ·{" "}
                {plan.status === "published" ? "已发布" : "草稿"} · v{plan.version}
              </span>
            </div>
            <button type="button" onClick={() => navigate(`/admin/week-plans/${plan.id}`)}>
              <Eye size={18} />
              编辑
            </button>
          </article>
        ))}
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

  const publishPlan = async () => {
    await savePlan();
    setStatus("publishing");
    setMessage("");
    try {
      const data = await api(`/api/week-plans/${id}/publish`, { method: "POST" });
      setPlan(data.plan);
      setStatus("idle");
      setMessage("已发布到展示端");
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
              <p>{plan.status === "published" ? "已发布" : "草稿"}</p>
              <h1>{plan.title}</h1>
            </div>
            <div className="editor-actions">
              <button type="button" onClick={savePlan} disabled={status === "saving"}>
                {status === "saving" ? <Loader2 size={18} /> : <Save size={18} />}
                保存
              </button>
              <button className="primary" type="button" onClick={publishPlan}>
                <Send size={18} />
                发布
              </button>
            </div>
          </section>

          <section className="plan-meta">
            <label>
              年份
              <input
                type="number"
                value={plan.year}
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
                onChange={(event) =>
                  setPlan({ ...plan, weekNumber: Number(event.target.value) })
                }
              />
            </label>
            <label>
              标题
              <input
                value={plan.title}
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

          <PlanTable plan={plan} editable onChange={setPlan} />
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
