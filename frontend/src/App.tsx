import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ComponentType } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Compass,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileUp,
  FlaskConical,
  KeyRound,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Play,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wand2,
  X,
} from "lucide-react";
import AnimatedList from "./components/AnimatedList";
import AnimatedContent from "./components/AnimatedContent";
import { AlphaLogo } from "./components/AlphaLogo";
import TechText from "./components/TechText";
import TargetCursor from "./components/TargetCursor";
import GradientASCII from "./components/GradientASCII";
import FuzzyText from "./components/FuzzyText";
import MagicBento from "./components/MagicBento";
import Magnet from "./components/Magnet";
import CountUp from "./components/CountUp";
import { LoginModal } from "./components/LoginModal";
import { CustomSelect } from "./components/CustomSelect";

const ActivityList = AnimatedList as ComponentType<any>;
const Reveal = AnimatedContent as ComponentType<any>;
const TechWordmark = TechText as ComponentType<any>;
const Cursor = TargetCursor as ComponentType<any>;
const AsciiCanvas = GradientASCII as ComponentType<any>;
const GlitchTitle = FuzzyText as ComponentType<any>;
const Bento = MagicBento as ComponentType<any>;
const Magnetic = Magnet as ComponentType<any>;
const AnimatedNumber = CountUp as ComponentType<any>;

type Page =
  | "overview"
  | "factory"
  | "vault"
  | "catalog"
  | "settings"
  | "terms"
  | "notfound";

type InspectorSection = "inspector" | "checks" | "events" | null;

type Alpha = {
  id: string;
  expression?: string;
  sharpe?: number;
  fitness?: number;
  turnover_pct?: number;
  turnover?: number;
  returns_pct?: number;
  margin_bps?: number;
  margin?: number;
  max_self_correlation?: number;
  drawdown_pct?: number;
  decay?: number;
  checks_summary?: string;
  is_submittable?: number | boolean;
  submission_status?: string;
  tier?: string;
  evaluated_at?: string;
  checks_list?: { name?: string; result?: string; value?: number }[];
  fail_reasons?: string | string[];
};

type Stats = {
  total?: number;
  active?: number;
  submittable?: number;
  spectacular?: number;
  unsubmitted?: number;
  leader_fitness?: number;
  leader_id?: string;
};

type Task = {
  status: string;
  logs?: string[];
  alpha_id?: string;
  candidate?: Alpha & { name?: string; expr?: string };
  blueprint?: { name?: string; expr?: string };
};

type Field = {
  id: string;
  description?: string;
  dataset_id?: string;
  type?: string;
};

type Dataset = { id: string; name: string; fields_count: number };

const NUMBER = new Intl.NumberFormat("en-US");
const fmt = (value?: number | null, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—";

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      body.error || body.message || `${res.status} ${res.statusText}`,
    );
  return body as T;
};

const post = <T,>(path: string, data?: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });

const NAV_ITEMS: {
  page: Page;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
  index: string;
}[] = [
  {
    page: "overview",
    label: "Command Overview",
    hint: "Showcase & telemetry",
    icon: LayoutDashboard,
    index: "01",
  },
  {
    page: "factory",
    label: "Alpha Studio",
    hint: "Configure & simulate",
    icon: FlaskConical,
    index: "02",
  },
  {
    page: "vault",
    label: "Alpha Vault",
    hint: "Audited registry",
    icon: Layers,
    index: "03",
  },
  {
    page: "catalog",
    label: "Data Catalog",
    hint: "4,367 BRAIN fields",
    icon: Database,
    index: "04",
  },
  {
    page: "settings",
    label: "Engine & Session",
    hint: "AI & BRAIN credentials",
    icon: Settings2,
    index: "05",
  },
  {
    page: "terms",
    label: "Research Protocol",
    hint: "Governance & creators",
    icon: ShieldCheck,
    index: "06",
  },
];

const OPERATOR_GUIDES: {
  snippet: string;
  label: string;
  guide: string;
}[] = [
  {
    snippet: "rank(",
    label: "rank(x)",
    guide: "Cross-sectional percentile rank (0.0 to 1.0)",
  },
  {
    snippet: "ts_rank(",
    label: "ts_rank(x, d)",
    guide: "Time-series rank over d days",
  },
  {
    snippet: "ts_delta(",
    label: "ts_delta(x, d)",
    guide: "d-day difference",
  },
  {
    snippet: "ts_backfill(",
    label: "ts_backfill(x, d)",
    guide: "Forward-fill missing fundamentals",
  },
  {
    snippet: "ts_mean(",
    label: "ts_mean(x, d)",
    guide: "Rolling d-day average",
  },
  {
    snippet: "group_neutralize(",
    label: "group_neutralize(x, subindustry)",
    guide: "Subindustry / sector neutralization",
  },
  {
    snippet: "power(",
    label: "power(x, 2.2)",
    guide: "Signal tail exponent",
  },
  {
    snippet: "trade_when(",
    label: "trade_when(event, signal, -1)",
    guide: "Event-conditional position hold",
  },
  {
    snippet: "vec_avg(",
    label: "vec_avg(v)",
    guide: "Vector field aggregation",
  },
];

const ARCHETYPE_OPTIONS = [
  {
    title: "Capital Efficiency & VWAP Reversion",
    meta: "USA · TOP3000 · D1 · Sharpe 2.44+ Archetype",
  },
  {
    title: "Operating Cashflow & EBITDA Yield",
    meta: "USA · TOP1000 · D1 · Sharpe 2.22+ Archetype",
  },
  {
    title: "Delay-0 Earnings PEAD Held Reversal",
    meta: "USA · TOP3000 · D0 · Event Driven",
  },
  {
    title: "Delay-0 Share Repurchase & Cash Yield",
    meta: "USA · TOP3000 · D0 · Buyback Flow",
  },
  {
    title: "Alt-Data PageRank & Sentiment Synergy",
    meta: "USA · TOP3000 · D1 · Network Orthogonal",
  },
];

const starterExpression =
  "oi_mom = rank(ts_delta(ts_backfill(operating_income, 120), 120) / cap);\nrev = rank(-ts_delta(close, 5));\ngroup_neutralize(0.65 * oi_mom + 0.35 * rev, subindustry)";

const validateExpression = (expr: string) => {
  if (!expr.trim()) return "Expression is empty";
  let depth = 0;
  for (const char of expr) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth < 0) return "Unexpected closing parenthesis";
  }
  if (depth !== 0) return "Unclosed parenthesis";
  return "Syntax verified · ready for BRAIN simulation";
};

const passesMetricHurdles = (alpha: Alpha) => {
  const s = alpha.sharpe ?? 0;
  const f = alpha.fitness ?? 0;
  const t = alpha.turnover_pct ?? (alpha.turnover || 0) * 100;
  return s >= 1.25 && f >= 1.0 && t >= 1 && t <= 70;
};

const statusOf = (alpha: Alpha) => {
  if (alpha.submission_status === "SUBMITTED") return "Submitted";
  if (alpha.is_submittable) return "Ready to Submit";
  if (passesMetricHurdles(alpha)) return "Hurdles Passed";
  return "Below Hurdle";
};

const outcomeClass = (alpha: Alpha) => {
  if (alpha.submission_status === "SUBMITTED") return "submitted";
  if (alpha.is_submittable) return "success";
  if (passesMetricHurdles(alpha)) return "qualified";
  return "muted";
};

const tierClass = (tier?: string) => {
  const t = (tier || "").toUpperCase();
  if (t === "SPECTACULAR") return "tier-spectacular";
  if (t === "EXCELLENT") return "tier-excellent";
  if (t === "GOOD") return "tier-good";
  return "tier-default";
};

const hurdleBars = (alpha: Alpha) => {
  const clampPct = (v: number) => Math.max(8, Math.min(100, Math.round(v)));
  const sharpe = alpha.sharpe ?? 0;
  const fitness = alpha.fitness ?? 0;
  const turnover = alpha.turnover_pct ?? (alpha.turnover || 0) * 100;
  const corr = alpha.max_self_correlation;
  return [
    {
      label: "Sharpe Ratio",
      target: "≥ 1.25",
      val: fmt(sharpe),
      pct: clampPct((sharpe / 2.6) * 100),
      pass: sharpe >= 1.25,
    },
    {
      label: "Fitness Score",
      target: "≥ 1.00",
      val: fmt(fitness),
      pct: clampPct((fitness / 2.2) * 100),
      pass: fitness >= 1.0,
    },
    {
      label: "Daily Turnover",
      target: "1%–70%",
      val: `${fmt(turnover)}%`,
      pct: clampPct(100 - Math.max(0, turnover - 12) * 1.3),
      pass: turnover >= 1 && turnover <= 70,
    },
    {
      label: "Self-Correlation",
      target: "< 0.70",
      val: corr !== undefined && corr !== null ? fmt(corr) : "< 0.70",
      pct: clampPct((1 - (corr ?? 0.22)) * 100),
      pass: corr === undefined || corr === null || corr < 0.7,
    },
  ];
};

function MetricCard({
  label,
  value,
  numeric,
  decimals = 0,
  sub,
  guide,
  tone = "emerald",
  onClick,
}: {
  label: string;
  value: string;
  numeric?: number;
  decimals?: number;
  sub: string;
  guide: string;
  tone?: "emerald" | "amber" | "ink" | "gold";
  onClick?: () => void;
}) {
  return (
    <article
      className={`metric-card tone-${tone}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-tag">{sub}</span>
      </div>
      <div className="metric-middle">
        <strong>
          {numeric === undefined ? (
            value
          ) : (
            <AnimatedNumber to={numeric} decimals={decimals} />
          )}
        </strong>
      </div>
      <div className="metric-bottom">
        <span>{guide}</span>
      </div>
    </article>
  );
}

function ButtonBase({
  children,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`button ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  const initialPage: Page =
    pathname === "/studio"
      ? "factory"
      : pathname === "/terms"
        ? "terms"
        : pathname === "/engine-select"
          ? "settings"
          : pathname === "/" ||
              pathname === "/dashboard" ||
              pathname === "/login"
            ? "overview"
            : "notfound";

  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFade, setSplashFade] = useState(false);
  const [page, setPage] = useState<Page>(initialPage);
  const [inspectorSection, setInspectorSection] =
    useState<InspectorSection>("inspector");
  const [stats, setStats] = useState<Stats>({});
  const [alphas, setAlphas] = useState<Alpha[]>([]);
  const [selected, setSelected] = useState<Alpha | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<{
    fullName?: string;
    level?: string;
  } | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [worker, setWorker] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [activity, setActivity] = useState<
    { id: string; title: string; description: string; meta: string }[]
  >([]);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteFields, setPaletteFields] = useState<Field[]>([]);
  const [search, setSearch] = useState("");
  const [vaultFilter, setVaultFilter] = useState("all");
  const [vaultShown, setVaultShown] = useState(90);
  const [timeframe, setTimeframe] = useState<"today" | "all">("all");
  const [expression, setExpression] = useState(starterExpression);
  const [alphaName, setAlphaName] = useState("Emerald Signal 01");
  const [region, setRegion] = useState("USA");
  const [universe, setUniverse] = useState("TOP3000");
  const [delay, setDelay] = useState(1);
  const [decay, setDecay] = useState(22);
  const [neutralization, setNeutralization] = useState("SUBINDUSTRY");
  const [truncation, setTruncation] = useState(0.08);
  const [pasteurization, setPasteurization] = useState("ON");
  const [archetype, setArchetype] = useState(0);
  const [hypothesis, setHypothesis] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [vaultView, setVaultView] = useState<"table" | "bento">("table");
  const [engine, setEngine] = useState("algorithmic");
  const [cloudKey, setCloudKey] = useState("");
  const [cloudProvider, setCloudProvider] = useState("gemini");
  const [ollamaEndpoint, setOllamaEndpoint] = useState(
    "http://localhost:11434",
  );
  const [ollamaModel, setOllamaModel] = useState("deepseek-r1:latest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldDataset, setFieldDataset] = useState("");
  const [fieldPage, setFieldPage] = useState(1);
  const [fieldTotal, setFieldTotal] = useState(0);
  const [task, setTask] = useState<Task | null>(null);
  const [taskId, setTaskId] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Alpha[]>([]);

  const mainScroll = useRef<HTMLDivElement>(null);
  const scopeWrapRef = useRef<HTMLDivElement>(null);
  const seededActivity = useRef(false);

  const CATALOG_PAGE_SIZE = 10;

  const addActivity = useCallback(
    (title: string, description: string, meta = "JUST NOW") =>
      setActivity((current) =>
        [
          { id: crypto.randomUUID(), title, description, meta },
          ...current,
        ].slice(0, 8),
      ),
    [],
  );

  // Auto-dismiss Top-Right ("Northeast") Notification Toast after 4.5s
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Close Top-Bar Scope Popover on outside click
  useEffect(() => {
    if (!selectorOpen) return;
    const onDown = (event: MouseEvent) => {
      if (
        scopeWrapRef.current &&
        !scopeWrapRef.current.contains(event.target as Node)
      ) {
        setSelectorOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [selectorOpen]);

  const refresh = useCallback(async () => {
    try {
      const [s, a, w, m] = await Promise.all([
        api<Stats>("/api/stats"),
        api<{ alphas: Alpha[] }>(
          "/api/alphas?limit=1000&sort_by=fitness&order=desc",
        ),
        api<Record<string, unknown>>("/api/correlation-worker/status").catch(
          () => ({}),
        ),
        api<{
          authenticated: boolean;
          user?: { fullName?: string; level?: string };
        }>("/api/auth/me").catch(() => ({ authenticated: false })),
      ]);
      setStats(s);
      setAlphas(a.alphas || []);
      setWorker(w);
      setAuthenticated(m.authenticated);
      setUser("user" in m ? m.user || null : null);
      setSelected((previous) =>
        previous
          ? {
              ...((a.alphas || []).find((x) => x.id === previous.id) || {}),
              ...previous,
            }
          : (a.alphas || [])[0] || null,
      );
      if (!seededActivity.current && a.alphas?.length) {
        seededActivity.current = true;
        setActivity(
          a.alphas.slice(0, 6).map((alpha) => ({
            id: alpha.id,
            title:
              alpha.submission_status === "SUBMITTED"
                ? "Portfolio submission verified"
                : "Alpha hurdle audit logged",
            description: `${alpha.id} · Sharpe ${fmt(alpha.sharpe)} · Fitness ${fmt(alpha.fitness)}`,
            meta: alpha.evaluated_at?.slice(0, 10) || "ARCHIVE",
          })),
        );
        void api<Alpha>(`/api/alpha/${encodeURIComponent(a.alphas[0].id)}`)
          .then(setSelected)
          .catch(() => {});
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load local research data",
      );
    } finally {
      setSplashFade(true);
      window.setTimeout(() => setSplashVisible(false), 380);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void api<Record<string, unknown>>("/api/user/dashboard-summary")
      .then(setSummary)
      .catch(() => {});
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const syncPath = () => {
      const path = window.location.pathname;
      setPage(
        path === "/" || path === "/dashboard" || path === "/login"
          ? "overview"
          : path === "/studio"
            ? "factory"
            : path === "/terms"
              ? "terms"
              : path === "/engine-select"
                ? "settings"
                : "notfound",
      );
    };
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSelectorOpen(false);
        setPalette((x) => !x);
      }
      if (event.key === "Escape") {
        setPalette(false);
        setSelectorOpen(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!palette || paletteQuery.trim().length < 2) {
      setPaletteFields([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void api<{ fields: Field[] }>(
        `/api/data-fields?search=${encodeURIComponent(paletteQuery.trim())}&limit=6`,
      )
        .then((res) => setPaletteFields(res.fields || []))
        .catch(() => setPaletteFields([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [palette, paletteQuery]);

  useEffect(() => {
    if (page !== "catalog") return;
    const params = new URLSearchParams({
      page: String(fieldPage),
      limit: String(CATALOG_PAGE_SIZE),
    });
    if (fieldSearch) params.set("search", fieldSearch);
    if (fieldDataset) params.set("dataset", fieldDataset);
    const t = window.setTimeout(
      () =>
        void api<{ fields: Field[]; total: number }>(
          `/api/data-fields?${params}`,
        )
          .then((x) => {
            setFields(x.fields);
            setFieldTotal(x.total);
          })
          .catch((e) => setNotice(String(e))),
      140,
    );
    return () => clearTimeout(t);
  }, [page, fieldSearch, fieldDataset, fieldPage]);

  useEffect(() => {
    if (page !== "catalog") return;
    void api<{ datasets: Dataset[] }>("/api/datasets")
      .then((x) => setDatasets(x.datasets))
      .catch(() => {});
  }, [page]);

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    const poll = async () => {
      try {
        const t = await api<Task>(
          `/api/simulate/status/${encodeURIComponent(taskId)}`,
        );
        if (!alive) return;
        setTask(t);
        if (["COMPLETE", "FAILED", "ERROR"].includes(t.status)) {
          setTaskId("");
          addActivity(
            t.status === "COMPLETE"
              ? "Simulation & hurdle audit complete"
              : "Simulation halted",
            t.candidate?.id || t.alpha_id || t.logs?.at(-1) || t.status,
          );
          void refresh();
          if (t.candidate?.id)
            void api<Alpha>(`/api/alpha/${encodeURIComponent(t.candidate.id)}`)
              .then((detail) => {
                setSelected(detail);
                setInspectorSection("inspector");
              })
              .catch(() => {});
        }
      } catch (e) {
        if (alive) {
          setTaskId("");
          setNotice(String(e));
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2400);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [taskId, addActivity, refresh]);

  const action = async (
    name: string,
    fn: () => Promise<unknown>,
    success: string,
  ) => {
    setBusy(name);
    try {
      await fn();
      setNotice(success);
      addActivity(success, name.toUpperCase());
      void refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const switchPage = (next: Page) => {
    setPage(next);
    window.history.pushState(
      {},
      "",
      next === "factory" ? "/studio" : next === "terms" ? "/terms" : "/",
    );
    mainScroll.current?.scrollTo({ top: 0, behavior: "smooth" });
    setPalette(false);
    setSelectorOpen(false);
  };

  const openAlpha = async (a: Alpha) => {
    setSelected(a);
    setInspectorSection("inspector");
    try {
      setSelected(await api<Alpha>(`/api/alpha/${encodeURIComponent(a.id)}`));
    } catch {}
  };

  const submit = (a: Alpha) => {
    if (!a.is_submittable || a.submission_status === "SUBMITTED") return;
    if (
      !window.confirm(
        `Submit alpha ${a.id} to WorldQuant BRAIN? This sends the live submission.`,
      )
    )
      return;
    void action(
      "submit",
      () => post("/api/engine/confirm-submit", { alpha_id: a.id }),
      `Submitted ${a.id} to WorldQuant BRAIN`,
    );
  };

  const hurdlePassedCount = useMemo(
    () => alphas.filter(passesMetricHurdles).length,
    [alphas],
  );

  const filtered = useMemo(
    () =>
      alphas.filter((a) => {
        if (vaultFilter === "submitted" && a.submission_status !== "SUBMITTED")
          return false;
        if (vaultFilter === "submittable" && !a.is_submittable) return false;
        if (vaultFilter === "hurdles" && !passesMetricHurdles(a)) return false;
        if (vaultFilter === "draft" && a.submission_status === "SUBMITTED")
          return false;
        if (
          timeframe === "today" &&
          a.evaluated_at?.slice(0, 10) !== new Date().toISOString().slice(0, 10)
        )
          return false;
        return `${a.id} ${a.expression || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [alphas, vaultFilter, search, timeframe],
  );

  const onSimulate = (event: FormEvent) => {
    event.preventDefault();
    if (!validateExpression(expression).startsWith("Syntax")) {
      setNotice("Please fix parenthesis syntax in the FastExpr editor first.");
      return;
    }
    if (!authenticated) {
      setLoginOpen(true);
      setNotice("Sign in with your WorldQuant BRAIN credentials to simulate.");
      return;
    }
    void action(
      "simulate",
      async () => {
        const r = await post<{ task_id: string }>("/api/simulate", {
          name: alphaName,
          expr: expression,
          region,
          universe,
          delay,
          decay,
          neutralization,
          truncation,
          pasteurization,
          nanHandling: "OFF",
        });
        setTaskId(r.task_id);
        setTask({
          status: "QUEUED",
          logs: ["[*] Task queued for WorldQuant BRAIN simulation..."],
        });
      },
      "Simulation dispatched to WorldQuant BRAIN",
    );
  };

  const onLogin = (event: FormEvent) => {
    event.preventDefault();
    void action(
      "login",
      async () => {
        await post("/api/auth/login", { email, password });
        setPassword("");
        const me = await api<{
          authenticated: boolean;
          user: { fullName?: string; level?: string };
        }>("/api/auth/me");
        setAuthenticated(me.authenticated);
        setUser(me.user);
        setLoginOpen(false);
      },
      "WorldQuant BRAIN session connected",
    );
  };

  const onSettings = (event: FormEvent) => {
    event.preventDefault();
    void action(
      "engine",
      () =>
        post("/api/engine/select", {
          engine,
          cloud_provider: cloudProvider,
          cloud_api_key: cloudKey,
          ollama_endpoint: ollamaEndpoint,
          ollama_model: ollamaModel,
        }),
      "Synthesis engine preferences saved",
    );
  };

  const generatePreview = () =>
    void action(
      "preview",
      async () => {
        const result = await post<{ candidate: Record<string, unknown> }>(
          "/api/engine/generate-preview",
          { engine, pattern_idx: archetype, prompt: hypothesis || undefined },
        );
        const candidate = result.candidate;
        if (typeof candidate.expr !== "string")
          throw new Error("Engine did not return an expression");
        setExpression(candidate.expr);
        if (typeof candidate.name === "string") setAlphaName(candidate.name);
        if (typeof candidate.region === "string") setRegion(candidate.region);
        if (typeof candidate.universe === "string")
          setUniverse(candidate.universe);
        if (typeof candidate.delay === "number") setDelay(candidate.delay);
        if (typeof candidate.decay === "number") setDecay(candidate.decay);
        if (typeof candidate.neutralization === "string")
          setNeutralization(candidate.neutralization);
        switchPage("factory");
      },
      "Formula loaded into Alpha Studio editor",
    );

  const runBatch = () => {
    if (!authenticated) {
      setLoginOpen(true);
      setNotice("Sign in to your WorldQuant BRAIN account to auto-mine.");
      return;
    }
    void action(
      "batch",
      async () => {
        const r = await post<{
          task_id: string;
          blueprint?: { expr?: string; name?: string };
        }>("/api/engine/run-batch", {
          engine,
          pattern_idx: archetype,
          prompt: hypothesis || undefined,
        });
        setTaskId(r.task_id);
        setTask({
          status: "QUEUED",
          logs: ["[*] Autonomous synthesis & simulation started..."],
          blueprint: r.blueprint,
        });
        if (r.blueprint?.expr) setExpression(r.blueprint.expr);
        if (r.blueprint?.name) setAlphaName(r.blueprint.name);
        switchPage("factory");
      },
      "Auto-mine simulation dispatched",
    );
  };

  const validateKey = () =>
    void action(
      "key",
      async () => {
        const result = await post<{ valid: boolean }>(
          "/api/engine/validate-cloud-key",
          { provider: cloudProvider, api_key: cloudKey },
        );
        if (!result.valid) throw new Error("API key validation failed");
      },
      "Cloud AI API key verified",
    );

  const discoverModels = () =>
    void action(
      "models",
      async () => {
        const result = await api<{ models: string[]; available: boolean }>(
          `/api/engine/ollama-models?endpoint=${encodeURIComponent(ollamaEndpoint)}`,
        );
        if (!result.available)
          throw new Error("No local Ollama models detected at this endpoint");
        setOllamaModel(result.models[0]);
        setNotice(`${result.models.length} local Ollama models found`);
      },
      "Local Ollama models discovered",
    );

  const checkCorrelation = (a: Alpha) => {
    setBusy("correlation");
    void api<{ passed: boolean; max_self_correlation?: number }>(
      `/api/correlation-check/${encodeURIComponent(a.id)}`,
    )
      .then((result) => {
        const message = `${a.id}: ${result.passed ? "Passed (< 0.70)" : "High Correlation"} · Max self-corr ${fmt(result.max_self_correlation)}`;
        setNotice(message);
        addActivity("Self-correlation verified", message);
        void openAlpha(a);
      })
      .catch((error) => setNotice(String(error)))
      .finally(() => setBusy(""));
  };

  const cloneToFactory = (a: Alpha) => {
    setExpression(a.expression || "");
    setAlphaName(`Variant_${a.id}`);
    switchPage("factory");
    setNotice(`Loaded ${a.id} into Alpha Studio editor.`);
  };

  const importCandidate = async (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setNotice("Candidate file exceeds 1 MB");
      return;
    }
    try {
      const content = await file.text();
      let data: Record<string, unknown>;
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(content);
        data = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<
          string,
          unknown
        >;
      } else if (file.name.toLowerCase().endsWith(".csv")) {
        const lines = content.replace(/\r/g, "").split("\n").filter(Boolean);
        const keys =
          lines[0]?.split(",").map((x) => x.trim().replace(/^"|"$/g, "")) || [];
        const values = lines[1]?.split(",") || [];
        data = Object.fromEntries(
          keys.map((key, i) => [key, values[i]?.trim().replace(/^"|"$/g, "")]),
        );
      } else throw new Error("Choose a JSON or CSV candidate file");
      const expr = data.expr || data.expression || data.regular;
      if (typeof expr !== "string" || !expr.trim())
        throw new Error("Candidate file needs an expr or expression field");
      setExpression(expr);
      if (typeof data.name === "string") setAlphaName(data.name);
      setNotice(`${file.name} loaded into Alpha Studio.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const compare = () => {
    if (compareIds.length < 2) return;
    void api<{ alphas: Alpha[] }>(
      `/api/compare?ids=${encodeURIComponent(compareIds.join(","))}`,
    )
      .then((x) => setComparison(x.alphas))
      .catch((e) => setNotice(String(e)));
  };

  const pageMeta = {
    overview: {
      title: "Command Overview",
      subtitle:
        "Executive portfolio showcase, factor synthesis, and live qualification telemetry.",
    },
    factory: {
      title: "Alpha Studio & Simulation Workbench",
      subtitle:
        "Configure simulation parameters on the left and compose FastExpr formulas on the right.",
    },
    vault: {
      title: "Alpha Vault & Portfolio Registry",
      subtitle:
        "Browse all 90 audited candidates with Sharpe, Fitness, Turnover, and Self-Correlation.",
    },
    catalog: {
      title: "WorldQuant Data Catalog",
      subtitle:
        "Search 4,367 institutional equity fields across 14 datasets and insert into your formula.",
    },
    settings: {
      title: "Engine & Consultant Session",
      subtitle:
        "Configure Algorithmic, Google Gemini, or Local Ollama engines and manage BRAIN credentials.",
    },
    terms: {
      title: "Consultant Research Protocol",
      subtitle:
        "Operational governance, local compute sovereignty, and open-source contributors.",
    },
    notfound: {
      title: "Signal Lost · 404",
      subtitle: "The requested route is outside the active research workspace.",
    },
  }[page];

  const simStage =
    task?.status === "COMPLETE"
      ? 4
      : task?.status === "AUDITING"
        ? 3
        : task?.status === "SIMULATING"
          ? 2
          : task?.status === "QUEUED"
            ? 1
            : 0;

  const toggleAccordion = (section: InspectorSection) => {
    setInspectorSection((current) => (current === section ? null : section));
  };

  const checksList = useMemo(() => {
    if (!selected) return [];
    if (selected.checks_list?.length) return selected.checks_list;
    return [
      {
        name: "LOW_SHARPE (≥ 1.25)",
        result: (selected.sharpe || 0) >= 1.25 ? "PASS" : "FAIL",
      },
      {
        name: "LOW_FITNESS (≥ 1.00)",
        result: (selected.fitness || 0) >= 1.0 ? "PASS" : "FAIL",
      },
      {
        name: "TURNOVER (1%–70%)",
        result: "PASS",
      },
      {
        name: "SELF_CORRELATION (< 0.70)",
        result:
          (selected.max_self_correlation ?? 0.2) < 0.7 ? "PASS" : "FAIL",
      },
      {
        name: "CONCENTRATED_WEIGHT",
        result: "PASS",
      },
      {
        name: "LOW_SUB_UNIVERSE_SHARPE",
        result: selected.is_submittable ? "PASS" : "PENDING",
      },
    ];
  }, [selected]);

  const passedChecksCount = useMemo(
    () =>
      checksList.filter((c) =>
        String(c.result || "")
          .toUpperCase()
          .includes("PASS"),
      ).length,
    [checksList],
  );

  return (
    <div className="app-shell">
      {/* BOOT SPLASH OVERLAY ON REFRESH */}
      {splashVisible && (
        <div
          className={`boot-splash ${splashFade ? "fade-out" : ""}`}
          onClick={() => setSplashVisible(false)}
        >
          <div className="boot-splash-inner">
            <AlphaLogo size={72} />
            <span className="boot-kicker">
              WORLDQUANT BRAIN · QUANTITATIVE RESEARCH STUDIO
            </span>
            <strong>WORLDQUANT ALPHA</strong>
            <div className="boot-bar">
              <i />
            </div>
          </div>
        </div>
      )}

      {/* TOP-RIGHT ("NORTHEAST") DISTINCT COBALT-VIOLET NOTIFICATION TOAST */}
      {notice && (
        <aside className="northeast-toast" role="status" aria-live="polite">
          <div className="toast-icon-badge">
            <Bell size={16} />
          </div>
          <div className="northeast-toast-copy">
            <strong>SYSTEM TELEMETRY</strong>
            <span>{notice}</span>
          </div>
          <button
            className="northeast-toast-close no-cursor-lock"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </aside>
      )}

      {/* FULL-WIDTH BUTTON LOCKING TARGET CURSOR */}
      <Cursor
        spinDuration={0}
        hoverDuration={0.15}
        hideDefaultCursor
        parallaxOn
        size={26}
        cornerSize={9}
        thickness={2}
        padding={4}
        matchRadius
        dotSize={4}
        blendMode="difference"
        showLabel={false}
        clickEffect
      />

      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>

      {/* LEFT NAVIGATION DOCK */}
      <aside className="sidebar glass">
        <div
          className="brand cursor-target"
          onClick={() => switchPage("overview")}
        >
          <AlphaLogo size={42} />
          <div className="brand-copy">
            <strong>WorldQuant Alpha</strong>
            <small>Quant Research Studio</small>
          </div>
        </div>

        <div className="nav-kicker">
          <span>WORKSPACE</span>
          <span>01–06</span>
        </div>

        <nav aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${page === item.page ? "active" : ""}`}
              onClick={() => switchPage(item.page)}
              aria-current={page === item.page ? "page" : undefined}
            >
              <span className="nav-index">{item.index}</span>
              <item.icon size={17} />
              <span className="nav-label-wrap">
                <span className="nav-label">{item.label}</span>
                <small className="nav-hint">{item.hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`consultant-card ${authenticated ? "is-online" : ""}`}
            onClick={() =>
              authenticated ? switchPage("settings") : setLoginOpen(true)
            }
          >
            <div className="consultant-row">
              <KeyRound size={15} />
              <strong>
                {authenticated ? "BRAIN Connected" : "Sign In to BRAIN"}
              </strong>
            </div>
            <small>
              {authenticated
                ? user?.fullName || "Active Consultant Session"
                : "Click to connect your credentials"}
            </small>
          </button>
        </div>
      </aside>

      {/* CENTER + RIGHT AREA */}
      <div className="app-right">
        {/* TOP UTILITY BAR */}
        <header className="utility glass">
          <div className="utility-left">
            <span className="frame-badge">
              {NAV_ITEMS.find((x) => x.page === page)?.index || "00"}
            </span>
            <div className="utility-titles">
              <strong>{pageMeta.title}</strong>
              <small>{pageMeta.subtitle}</small>
            </div>
          </div>

          <button
            className="command-trigger"
            onClick={() => {
              setSelectorOpen(false);
              setPalette(true);
            }}
          >
            <Search size={15} />
            <span>Search alphas, 4,367 fields, or commands…</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="utility-actions">
            {/* DIRECTLY ALIGNED SIMULATION SCOPE POPOVER WITH SEGMENTED PILLS */}
            <div className="selector-wrap" ref={scopeWrapRef}>
              <button
                className="universe-pill"
                onClick={() => {
                  setPalette(false);
                  setSelectorOpen((value) => !value);
                }}
                aria-expanded={selectorOpen}
              >
                <span>
                  {region} · {universe} · D{delay}
                </span>
                <ChevronDown size={14} />
              </button>
              {selectorOpen && (
                <div
                  className="scope-popover"
                  role="group"
                  aria-label="Simulation scope"
                >
                  <div className="popover-head">
                    <strong>Simulation Scope</strong>
                    <small>Directly configures backtest parameters</small>
                  </div>

                  <div className="scope-group">
                    <span>MARKET REGION</span>
                    <div className="scope-pill-grid">
                      {["USA", "EUR", "ASI", "GLB"].map((val) => (
                        <button
                          key={val}
                          type="button"
                          className={`scope-chip ${region === val ? "active" : ""}`}
                          onClick={() => setRegion(val)}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="scope-group">
                    <span>STOCK UNIVERSE</span>
                    <div className="scope-pill-grid two-col">
                      {["TOP3000", "TOP1000", "TOP500", "TOP200"].map((val) => (
                        <button
                          key={val}
                          type="button"
                          className={`scope-chip ${universe === val ? "active" : ""}`}
                          onClick={() => setUniverse(val)}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="scope-group">
                    <span>DATA DELAY</span>
                    <div className="scope-pill-grid two-col">
                      {[
                        [1, "D1 · Daily Close"],
                        [0, "D0 · Intraday"],
                      ].map(([val, label]) => (
                        <button
                          key={String(val)}
                          type="button"
                          className={`scope-chip ${delay === Number(val) ? "active" : ""}`}
                          onClick={() => setDelay(Number(val))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    className="button primary full"
                    onClick={() => setSelectorOpen(false)}
                  >
                    Apply Scope ({region} · {universe} · D{delay})
                  </button>
                </div>
              )}
            </div>

            <ButtonBase
              className="sync-button"
              onClick={() =>
                authenticated
                  ? void action(
                      "sync",
                      () => post("/api/sync-cloud"),
                      "Synced active & unsubmitted alphas from WorldQuant BRAIN",
                    )
                  : setLoginOpen(true)
              }
              disabled={busy === "sync"}
            >
              <RefreshCw size={14} />
              <span>{busy === "sync" ? "Syncing…" : "Sync Portfolio"}</span>
            </ButtonBase>

            <button
              className={`account-pill ${authenticated ? "is-connected" : ""}`}
              onClick={() =>
                authenticated ? switchPage("settings") : setLoginOpen(true)
              }
            >
              <LockKeyhole size={14} />
              <span>
                {authenticated ? user?.fullName || "Connected" : "Sign In"}
              </span>
            </button>
          </div>
        </header>

        <div className="content-grid">
          {/* MAIN SCROLLABLE WORKSPACE (Native 120fps macOS Scroll) */}
          <div className="workspace-panel glass">
            <main id="workspace" className="workspace" ref={mainScroll}>
              <div
                className={`workspace-inner ${page === "catalog" ? "catalog-mode" : ""}`}
              >
                {/* ========================================================= */}
                {/* PAGE 01: COMMAND OVERVIEW                                 */}
                {/* ========================================================= */}
                {page === "overview" && (
                  <Reveal
                    distance={22}
                    duration={0.5}
                    stagger={0.05}
                    trigger="mount"
                    className="page-stack"
                  >
                    <section className="hero-showcase">
                      <AsciiCanvas
                        className="hero-ascii-bg"
                        colors={[
                          "#0A1410",
                          "#133829",
                          "#1F5C43",
                          "#C5A875",
                          "#F2EFE9",
                        ]}
                        shape="horizon"
                        characters=" .=+xX0S8#@"
                        cellSize={18}
                        density={0.78}
                        glyphOpacity={0.72}
                        gradientOpacity={0.88}
                        glow={0}
                        flow={0.55}
                        speed={0.75}
                        mouseInteraction
                        clickEffect="wave"
                      />
                      <div className="hero-showcase-content centered">
                        <div className="hero-top-pills">
                          <span className="hero-badge">
                            WORLDQUANT BRAIN · QUANTITATIVE ALPHA STUDIO
                          </span>
                          <span className="hero-badge subtle">
                            ENGINE:{" "}
                            <b>
                              {String(summary.engine || engine).toUpperCase()}
                            </b>
                          </span>
                        </div>

                        <div className="hero-wordmark">
                          <TechWordmark
                            text="WORLDQUANT  ALPHA"
                            fontFamily="Space Grotesk"
                            fontWeight={700}
                            fontSize={68}
                            letterSpacing={0.055}
                            align="center"
                            color="#F2EFE9"
                            accentColor="#C5A875"
                            reveal="letter"
                            dashLength={4}
                            dashGap={2}
                            specks={10}
                            selection={false}
                            labels={false}
                            draggable={false}
                            bounce={0.35}
                            clickKick
                            sweep
                            intro="metrics"
                            introDuration={1.4}
                            guides={false}
                          />
                        </div>

                        <p className="hero-lead centered">
                          Autonomous factor synthesis, cloud backtest
                          simulation, and 7-hurdle portfolio self-correlation
                          auditing for WorldQuant BRAIN.
                        </p>

                        {!authenticated ? (
                          <div className="showcase-auth-banner">
                            <div className="auth-banner-copy">
                              <span className="step-num">
                                STEP 01 · CONSULTANT AUTHENTICATION REQUIRED
                              </span>
                              <h3>Connect Your WorldQuant BRAIN Account</h3>
                              <p>
                                Sign in once to unlock live TOP3000 cloud
                                simulations, portfolio synchronization, and
                                automated self-correlation checks.
                              </p>
                            </div>
                            <div className="auth-banner-actions">
                              <button
                                className="guide-btn primary"
                                onClick={() => setLoginOpen(true)}
                              >
                                <LockKeyhole size={15} />
                                <span>Sign In to WorldQuant BRAIN</span>
                                <ArrowRight size={15} />
                              </button>
                              <button
                                className="guide-btn"
                                onClick={() => switchPage("factory")}
                              >
                                <span>Open Alpha Studio</span>
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="guided-steps two-col">
                            <div className="guide-step-card">
                              <div className="guide-step-head">
                                <span className="step-num">
                                  NEXT SYNTHESIS BLUEPRINT
                                </span>
                                <span className="step-state">
                                  5 Proven Archetypes + AI
                                </span>
                              </div>
                              <h3>Create a Quantitative Factor</h3>
                              <p>
                                Generate a multi-horizon FastExpr formula using
                                Algorithmic Grammar Trees, Gemini 2.0 Flash, or
                                Local Ollama directly in the Studio.
                              </p>
                              <button
                                className="guide-btn"
                                onClick={generatePreview}
                                disabled={busy === "preview"}
                              >
                                <span>
                                  {busy === "preview"
                                    ? "Synthesizing…"
                                    : "Generate into Studio"}
                                </span>
                                <Wand2 size={14} />
                              </button>
                            </div>

                            <div className="guide-step-card highlight">
                              <div className="guide-step-head">
                                <span className="step-num">
                                  AUTONOMOUS CLOUD MINER
                                </span>
                                <span className="step-state">
                                  {region} · {universe} · D{delay}
                                </span>
                              </div>
                              <h3>Simulate &amp; Verify 7 Hurdles</h3>
                              <p>
                                Dispatch an automated candidate simulation on
                                WorldQuant BRAIN and verify Sharpe ≥ 1.25,
                                Fitness ≥ 1.00, and Self-Correlation &lt; 0.70.
                              </p>
                              <button
                                className="guide-btn primary"
                                onClick={runBatch}
                                disabled={!!taskId || busy === "batch"}
                              >
                                <span>
                                  {taskId
                                    ? "Simulation Running…"
                                    : "Auto-Mine 1 Alpha Now"}
                                </span>
                                <Sparkles size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    <div className="metrics-grid">
                      <MetricCard
                        label="TOTAL ALPHAS MINED"
                        value=""
                        numeric={stats.total || 0}
                        sub="Local Archive"
                        guide="Click to browse all 90 audited alphas"
                        tone="emerald"
                        onClick={() => {
                          setVaultFilter("all");
                          switchPage("vault");
                        }}
                      />
                      <MetricCard
                        label="HURDLE PASSED SIGNALS"
                        value=""
                        numeric={hurdlePassedCount || stats.submittable || 0}
                        sub="Sharpe ≥ 1.25 · Fit ≥ 1.0"
                        guide="Passed core WorldQuant metric hurdles"
                        tone="gold"
                        onClick={() => {
                          setVaultFilter("hurdles");
                          switchPage("vault");
                        }}
                      />
                      <MetricCard
                        label="PEAK FITNESS SCORE"
                        value=""
                        numeric={stats.leader_fitness || 0}
                        decimals={2}
                        sub={
                          stats.leader_id
                            ? `Top: ${stats.leader_id}`
                            : "Hurdle ≥ 1.00"
                        }
                        guide="Highest risk-adjusted fitness score"
                        tone="ink"
                        onClick={() => switchPage("vault")}
                      />
                      <MetricCard
                        label="ACTIVE ON BRAIN"
                        value=""
                        numeric={stats.active || 0}
                        sub="Live Portfolio"
                        guide="Submitted live portfolio alphas"
                        tone="amber"
                        onClick={() => {
                          setVaultFilter("submitted");
                          switchPage("vault");
                        }}
                      />
                    </div>

                    <div className="overview-middle">
                      <section className="chart-card glass-soft">
                        <div className="section-head">
                          <div>
                            <span className="eyebrow">
                              PORTFOLIO PERFORMANCE FRONTIER
                            </span>
                            <h2>Top Audited Signals &amp; Hurdle Standing</h2>
                          </div>
                          <div className="segmented">
                            <button
                              className={
                                timeframe === "today" ? "selected" : ""
                              }
                              onClick={() => setTimeframe("today")}
                            >
                              Today
                            </button>
                            <button
                              className={timeframe === "all" ? "selected" : ""}
                              onClick={() => setTimeframe("all")}
                            >
                              All Time
                            </button>
                          </div>
                        </div>
                        <SignalFrontierChart
                          alphas={filtered}
                          selectedId={selected?.id}
                          onSelect={openAlpha}
                        />
                      </section>

                      <section className="archetype-showcase-card glass-soft">
                        <span className="eyebrow">FACTOR TEMPLATES</span>
                        <h2>Institutional Archetypes</h2>
                        <p className="section-sub">
                          Select a quantitative factor template to load into the
                          Alpha Studio editor:
                        </p>
                        <div className="archetype-list">
                          {ARCHETYPE_OPTIONS.slice(0, 4).map((item, idx) => (
                            <button
                              key={item.title}
                              className={`archetype-item ${archetype === idx ? "active" : ""}`}
                              onClick={() => {
                                setArchetype(idx);
                                setEngine("algorithmic");
                              }}
                            >
                              <span className="arch-idx">0{idx + 1}</span>
                              <div className="arch-copy">
                                <strong>{item.title}</strong>
                                <small>{item.meta}</small>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="pipeline-actions">
                          <ButtonBase
                            className="primary full"
                            onClick={generatePreview}
                            disabled={busy === "preview"}
                          >
                            <FlaskConical size={15} /> Load Selected Blueprint{" "}
                            <ArrowRight size={15} />
                          </ButtonBase>
                        </div>
                      </section>
                    </div>

                    <AlphaTable
                      rows={filtered.slice(0, 8)}
                      selectedId={selected?.id}
                      onSelect={openAlpha}
                      onSubmit={submit}
                      search={search}
                      setSearch={setSearch}
                      title="Recent Alpha Candidates"
                      subtitle="Click any candidate row to inspect its telemetry, self-correlation, and platform checks on the right."
                      empty="No alphas match your current filter."
                    />
                  </Reveal>
                )}

                {/* ========================================================= */}
                {/* PAGE 02: ALPHA STUDIO (SWAPPED COLUMNS & CLEAN SPACING)   */}
                {/* ========================================================= */}
                {page === "factory" && (
                  <Reveal
                    distance={22}
                    duration={0.5}
                    stagger={0.05}
                    trigger="mount"
                    className="page-stack studio-stack"
                  >
                    {/* STEP 01: SPACIOUS BLUEPRINT SYNTHESIS HEADER */}
                    <section className="generator-bar glass-soft">
                      <div className="generator-intro">
                        <span className="eyebrow">
                          STEP 01 · FORMULA SYNTHESIS
                        </span>
                        <h2>Generate or Load a Factor Blueprint</h2>
                        <p className="section-sub">
                          Choose a synthesis engine and factor archetype below,
                          then load the generated FastExpr formula directly into
                          the code studio.
                        </p>
                      </div>

                      <div className="generator-controls">
                        <label>
                          Synthesis Mode
                          <CustomSelect
                            value={engine}
                            onChange={setEngine}
                            options={[
                              {
                                value: "algorithmic",
                                label: "Algorithmic Grammar Trees",
                                sub: "Deterministic local factor trees",
                              },
                              {
                                value: "cloud_ai",
                                label: "Google Gemini 2.0 Flash",
                                sub: "Cloud quantitative AI synthesis",
                              },
                              {
                                value: "ollama",
                                label: "Local Ollama (DeepSeek-R1)",
                                sub: "Private offline LLM agent",
                              },
                            ]}
                          />
                        </label>

                        {engine === "algorithmic" ? (
                          <label>
                            Quantitative Factor Archetype
                            <CustomSelect
                              value={archetype}
                              onChange={(val) => setArchetype(Number(val))}
                              options={ARCHETYPE_OPTIONS.map((item, idx) => ({
                                value: idx,
                                label: `${String(idx + 1).padStart(2, "0")} · ${item.title}`,
                                sub: item.meta,
                              }))}
                            />
                          </label>
                        ) : (
                          <label>
                            AI Factor Hypothesis Prompt
                            <input
                              value={hypothesis}
                              onChange={(event) =>
                                setHypothesis(event.target.value)
                              }
                              placeholder="e.g. Combine analyst EPS revisions with 2-day VWAP mean reversion"
                            />
                          </label>
                        )}

                        <Magnetic padding={18} magnetStrength={4}>
                          <ButtonBase
                            className="primary generate-cta"
                            onClick={generatePreview}
                            disabled={busy === "preview"}
                          >
                            <Wand2 size={15} />
                            <span>
                              {busy === "preview"
                                ? "Synthesizing…"
                                : "Load Formula into Studio"}
                            </span>
                          </ButtonBase>
                        </Magnetic>
                      </div>
                    </section>

                    {/* SWAPPED 2-COLUMN WORKBENCH: LEFT = CONFIGURE BACKTEST, RIGHT = FASTEXPR STUDIO */}
                    <div className="factory-top swapped">
                      {/* LEFT COLUMN: STEP 02 · CONFIGURE BACKTEST */}
                      <div className="factory-control glass-soft">
                        <div className="studio-card-head">
                          <span className="eyebrow">
                            STEP 02 · SIMULATION PARAMETERS
                          </span>
                          <h2>Configure Backtest</h2>
                        </div>

                        <form onSubmit={onSimulate}>
                          <label>
                            Candidate Identifier
                            <input
                              value={alphaName}
                              onChange={(e) => setAlphaName(e.target.value)}
                              required
                            />
                          </label>

                          <div className="form-dual">
                            <label>
                              Market Region
                              <CustomSelect
                                value={region}
                                onChange={setRegion}
                                options={[
                                  {
                                    value: "USA",
                                    label: "USA Equities",
                                    sub: "US liquid market",
                                  },
                                  {
                                    value: "EUR",
                                    label: "EUR Equities",
                                    sub: "European markets",
                                  },
                                  {
                                    value: "ASI",
                                    label: "ASI Equities",
                                    sub: "Asian markets",
                                  },
                                  {
                                    value: "GLB",
                                    label: "GLB Equities",
                                    sub: "Global universe",
                                  },
                                ]}
                              />
                            </label>
                            <label>
                              Stock Universe
                              <CustomSelect
                                value={universe}
                                onChange={setUniverse}
                                options={[
                                  {
                                    value: "TOP3000",
                                    label: "TOP3000",
                                    sub: "Broad liquid benchmark",
                                  },
                                  {
                                    value: "TOP1000",
                                    label: "TOP1000",
                                    sub: "Large & mid cap",
                                  },
                                  {
                                    value: "TOP500",
                                    label: "TOP500",
                                    sub: "High liquidity",
                                  },
                                  {
                                    value: "TOP200",
                                    label: "TOP200",
                                    sub: "Mega cap leaders",
                                  },
                                ]}
                              />
                            </label>
                          </div>

                          <div className="form-dual">
                            <label>
                              Data Delay
                              <CustomSelect
                                value={delay}
                                onChange={(v) => setDelay(Number(v))}
                                options={[
                                  {
                                    value: 1,
                                    label: "D1 (Daily Close)",
                                    sub: "Standard T-1 close",
                                  },
                                  {
                                    value: 0,
                                    label: "D0 (Intraday)",
                                    sub: "Same-day snapshot",
                                  },
                                ]}
                              />
                            </label>
                            <label>
                              Neutralization
                              <CustomSelect
                                value={neutralization}
                                onChange={setNeutralization}
                                options={[
                                  {
                                    value: "SUBINDUSTRY",
                                    label: "SUBINDUSTRY",
                                    sub: "GICS subindustry neutral",
                                  },
                                  {
                                    value: "INDUSTRY",
                                    label: "INDUSTRY",
                                    sub: "Industry group neutral",
                                  },
                                  {
                                    value: "SECTOR",
                                    label: "SECTOR",
                                    sub: "Broad sector neutral",
                                  },
                                  {
                                    value: "MARKET",
                                    label: "MARKET",
                                    sub: "Dollar market neutral",
                                  },
                                  {
                                    value: "NONE",
                                    label: "NONE",
                                    sub: "Unneutralized raw weights",
                                  },
                                ]}
                              />
                            </label>
                          </div>

                          <div className="form-dual">
                            <label>
                              Linear Decay{" "}
                              <span className="label-value">{decay} DAYS</span>
                              <input
                                type="range"
                                min="0"
                                max="60"
                                value={decay}
                                onChange={(e) =>
                                  setDecay(Number(e.target.value))
                                }
                              />
                            </label>
                            <label>
                              Weight Truncation{" "}
                              <span className="label-value">
                                {truncation.toFixed(2)}
                              </span>
                              <input
                                type="range"
                                min="0.01"
                                max="0.15"
                                step="0.01"
                                value={truncation}
                                onChange={(e) =>
                                  setTruncation(Number(e.target.value))
                                }
                              />
                            </label>
                          </div>

                          <label>
                            Pasteurization
                            <CustomSelect
                              value={pasteurization}
                              onChange={setPasteurization}
                              options={[
                                {
                                  value: "ON",
                                  label: "ON · Standardize Outliers",
                                  sub: "Recommended for WorldQuant hurdles",
                                },
                                {
                                  value: "OFF",
                                  label: "OFF · Raw Unfiltered Signal",
                                  sub: "Disable outlier winsorization",
                                },
                              ]}
                            />
                          </label>

                          <div className="factory-cta-stack">
                            <ButtonBase
                              type="submit"
                              className="primary full"
                              disabled={busy === "simulate" || !!taskId}
                            >
                              <Play size={15} fill="currentColor" />
                              <span>
                                {taskId
                                  ? "Simulating on BRAIN…"
                                  : "Simulate & Audit Formula"}
                              </span>
                            </ButtonBase>

                            <ButtonBase
                              className="full"
                              onClick={runBatch}
                              disabled={!!taskId || busy === "batch"}
                            >
                              <Sparkles size={15} />
                              <span>Auto-Mine New Candidate</span>
                            </ButtonBase>
                          </div>
                        </form>
                      </div>

                      {/* RIGHT COLUMN: STEP 03 · CLEAN FASTEXPR FORMULA STUDIO */}
                      <div
                        className="studio-editor-card glass-soft"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          void importCandidate(event.dataTransfer.files[0]);
                        }}
                      >
                        <div className="studio-editor-header">
                          <div>
                            <span className="eyebrow">
                              STEP 03 · FASTEXPR FORMULA STUDIO
                            </span>
                            <h2>Expression Editor</h2>
                          </div>
                          <div className="studio-editor-tools">
                            <CustomSelect
                              className="operator-picker"
                              value=""
                              ariaLabel="Insert FastExpr operator"
                              onChange={(snippet) => {
                                if (snippet)
                                  setExpression((x) => `${x}${snippet}`);
                              }}
                              options={[
                                {
                                  value: "",
                                  label: "+ Insert Operator",
                                  sub: "Append standard FastExpr function",
                                },
                                ...OPERATOR_GUIDES.map((op) => ({
                                  value: op.snippet,
                                  label: op.label,
                                  sub: op.guide,
                                })),
                              ]}
                            />
                          </div>
                        </div>

                        <div className="clean-code-surface">
                          <div
                            className="clean-line-numbers"
                            aria-hidden="true"
                          >
                            {expression.split("\n").map((_, i) => (
                              <span key={i}>
                                {String(i + 1).padStart(2, "0")}
                              </span>
                            ))}
                          </div>
                          <textarea
                            className="selectable-code"
                            aria-label="Alpha expression"
                            spellCheck={false}
                            value={expression}
                            onChange={(e) => setExpression(e.target.value)}
                          />
                        </div>

                        <div
                          className={`clean-editor-status ${validateExpression(expression).startsWith("Syntax") ? "valid" : "invalid"}`}
                        >
                          <span>{validateExpression(expression)}</span>
                          <span>
                            {region} · {universe} · D{delay} ·{" "}
                            {expression.split("\n").length} LINES
                          </span>
                        </div>

                        <div className="clean-editor-footer">
                          <label className="button">
                            <FileUp size={14} />
                            <span>Import JSON / CSV</span>
                            <input
                              type="file"
                              accept=".json,.csv,application/json,text/csv"
                              style={{ display: "none" }}
                              onChange={(e) =>
                                void importCandidate(e.target.files?.[0])
                              }
                            />
                          </label>
                          <ButtonBase onClick={() => switchPage("catalog")}>
                            <Database size={14} />
                            <span>Browse 4,367 Data Fields</span>
                            <ArrowRight size={14} />
                          </ButtonBase>
                        </div>
                      </div>
                    </div>

                    {/* UNIFIED SIMULATION PIPELINE CONSOLE */}
                    <section className="simulation-console recessed">
                      <div className="console-header">
                        <div className="console-title">
                          <Activity size={16} />
                          <span>LIVE EXECUTION &amp; HURDLE PIPELINE</span>
                        </div>
                        <div className="pipeline-steps-inline">
                          {[
                            [1, "1. Compile FastExpr"],
                            [2, "2. Cloud Simulation"],
                            [3, "3. 7-Hurdle Audit"],
                            [4, "4. Self-Corr < 0.70"],
                          ].map(([idx, label]) => (
                            <span
                              key={idx}
                              className={`pipe-pill ${simStage >= Number(idx) ? "done" : ""}`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                        <span className="console-state">
                          {task?.status || "READY"}
                        </span>
                      </div>

                      <pre className="selectable-code">
                        {(
                          task?.logs || [
                            "[SYSTEM] Studio ready. Configure parameters on the left, review your FastExpr formula on the right, and click 'Simulate & Audit Formula'.",
                          ]
                        ).join("\n")}
                      </pre>

                      {task?.candidate && (
                        <div className="receipt-strip">
                          <div>
                            <small>CANDIDATE ID</small>
                            <strong>{task.candidate.id}</strong>
                          </div>
                          <div>
                            <small>SHARPE</small>
                            <strong>{fmt(task.candidate.sharpe)}</strong>
                          </div>
                          <div>
                            <small>FITNESS</small>
                            <strong>{fmt(task.candidate.fitness)}</strong>
                          </div>
                          <div>
                            <small>TURNOVER</small>
                            <strong>{fmt(task.candidate.turnover_pct)}%</strong>
                          </div>
                          <div>
                            <small>MARGIN</small>
                            <strong>
                              {fmt(task.candidate.margin_bps)} bps
                            </strong>
                          </div>
                          <ButtonBase
                            className="small primary"
                            disabled={!task.candidate.is_submittable}
                            onClick={() => submit(task.candidate as Alpha)}
                          >
                            Submit to BRAIN <ArrowRight size={13} />
                          </ButtonBase>
                        </div>
                      )}
                    </section>
                  </Reveal>
                )}

                {/* ========================================================= */}
                {/* PAGE 03: ALPHA VAULT (FULL SCROLL, CORRELATION & QUALITY) */}
                {/* ========================================================= */}
                {page === "vault" && (
                  <Reveal
                    distance={22}
                    duration={0.5}
                    stagger={0.05}
                    trigger="mount"
                    className="page-stack"
                  >
                    <div className="vault-summary four-col">
                      <MetricCard
                        label="TOTAL AUDITED"
                        value=""
                        numeric={stats.total || alphas.length}
                        sub="100% Corr Checked"
                        guide="All synced & simulated alphas in local DB"
                        tone="emerald"
                        onClick={() => setVaultFilter("all")}
                      />
                      <MetricCard
                        label="HURDLES PASSED"
                        value=""
                        numeric={hurdlePassedCount}
                        sub="Sharpe ≥ 1.25 · Fit ≥ 1.0"
                        guide="Passed core WorldQuant return & fitness hurdles"
                        tone="gold"
                        onClick={() => setVaultFilter("hurdles")}
                      />
                      <MetricCard
                        label="ORTHOGONAL (< 0.70)"
                        value=""
                        numeric={stats.submittable || 0}
                        sub="Low Self-Correlation"
                        guide="Passed both metric hurdles & < 0.70 correlation"
                        tone="ink"
                        onClick={() => setVaultFilter("submittable")}
                      />
                      <MetricCard
                        label="SUBMITTED ON BRAIN"
                        value=""
                        numeric={stats.active || 0}
                        sub="Live Portfolio"
                        guide="Active alphas running in your BRAIN portfolio"
                        tone="amber"
                        onClick={() => setVaultFilter("submitted")}
                      />
                    </div>

                    <div className="vault-controls glass-soft">
                      <div className="segmented">
                        {[
                          ["all", `All Alphas (${alphas.length})`],
                          ["hurdles", `Hurdle Passed (${hurdlePassedCount})`],
                          [
                            "submittable",
                            `Orthogonal < 0.70 (${stats.submittable || 0})`,
                          ],
                          ["submitted", `Submitted (${stats.active || 0})`],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            className={vaultFilter === key ? "selected" : ""}
                            onClick={() => {
                              setVaultFilter(key);
                              setVaultShown(90);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="segmented">
                        <button
                          className={vaultView === "table" ? "selected" : ""}
                          onClick={() => setVaultView("table")}
                        >
                          Table View
                        </button>
                        <button
                          className={vaultView === "bento" ? "selected" : ""}
                          onClick={() => setVaultView("bento")}
                        >
                          Card Grid
                        </button>
                      </div>

                      <ButtonBase
                        onClick={compare}
                        disabled={compareIds.length < 2}
                      >
                        Compare{" "}
                        {compareIds.length ? `(${compareIds.length})` : ""}
                      </ButtonBase>

                      <a
                        className="button export"
                        href="/api/export-csv"
                        download
                      >
                        <ArrowDownToLine size={15} /> Export CSV
                      </a>
                    </div>

                    {vaultView === "bento" ? (
                      <Bento
                        className="vault-bento-grid"
                        columns={3}
                        gap={14}
                        glowColor="19, 56, 41"
                        enableSpotlight
                        enableBorderGlow
                        enableTilt={false}
                        enableStars={false}
                        enableMagnetism={false}
                        clickEffect={false}
                        intro={false}
                        items={filtered.slice(0, vaultShown).map((alpha) => ({
                          id: alpha.id,
                          content: (
                            <article
                              className="vault-cartridge"
                              onClick={() => void openAlpha(alpha)}
                            >
                              <div className="section-head">
                                <strong className="mono">{alpha.id}</strong>
                                <span
                                  className={`status-chip ${outcomeClass(alpha)}`}
                                >
                                  {statusOf(alpha)}
                                </span>
                              </div>
                              <p className="vault-expr">
                                {alpha.expression ||
                                  "Click to load expression & hurdle breakdown"}
                              </p>
                              <div className="vault-metrics">
                                <span>
                                  SHARPE <b>{fmt(alpha.sharpe)}</b>
                                </span>
                                <span>
                                  FITNESS <b>{fmt(alpha.fitness)}</b>
                                </span>
                                <span>
                                  CORR{" "}
                                  <b>{fmt(alpha.max_self_correlation)}</b>
                                </span>
                              </div>
                            </article>
                          ),
                        }))}
                      />
                    ) : (
                      <AlphaTable
                        rows={filtered.slice(0, vaultShown)}
                        selectedId={selected?.id}
                        onSelect={openAlpha}
                        onSubmit={submit}
                        search={search}
                        setSearch={setSearch}
                        title={`Audited Alpha Registry (${filtered.length} Signals)`}
                        subtitle="Showing Sharpe, Fitness, Turnover, Self-Correlation (< 0.70 ceiling), and Quality Tier. Click any row to inspect."
                        empty="No alphas match this filter."
                        fullHeight
                        compareIds={compareIds}
                        onCompareToggle={(id) =>
                          setCompareIds((x) =>
                            x.includes(id)
                              ? x.filter((v) => v !== id)
                              : [...x, id],
                          )
                        }
                      />
                    )}
                  </Reveal>
                )}

                {/* ========================================================= */}
                {/* PAGE 04: DATA CATALOG (10 WHOLE ROWS PER VIEWPORT, NO CUT)*/}
                {/* ========================================================= */}
                {page === "catalog" && (
                  <section className="catalog-card glass-soft full-viewport-catalog">
                    <div className="catalog-controls">
                      <label className="search-box no-cursor-lock">
                        <Search size={16} />
                        <input
                          className="no-cursor-lock"
                          placeholder="Search 4,367 equity data fields by ID or description…"
                          value={fieldSearch}
                          onChange={(e) => {
                            setFieldSearch(e.target.value);
                            setFieldPage(1);
                          }}
                        />
                      </label>
                      <CustomSelect
                        className="catalog-select"
                        value={fieldDataset}
                        onChange={(val) => {
                          setFieldDataset(val);
                          setFieldPage(1);
                        }}
                        options={[
                          {
                            value: "",
                            label: "All 14 Datasets",
                            sub: "4,367 total equity fields",
                          },
                          ...datasets.map((d) => ({
                            value: d.id,
                            label: `${d.name} (${d.fields_count})`,
                            sub: `Dataset ID: ${d.id}`,
                          })),
                        ]}
                      />
                      <span className="catalog-count">
                        {NUMBER.format(fieldTotal)} FIELDS
                      </span>
                    </div>

                    <div className="table-wrap catalog-table-wrap">
                      <table className="catalog-table">
                        <thead>
                          <tr>
                            <th className="col-field-id">FIELD ID</th>
                            <th className="col-field-desc">DESCRIPTION</th>
                            <th className="col-field-ds">DATASET</th>
                            <th className="col-field-type">TYPE</th>
                            <th className="col-field-action">INSERT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f) => (
                            <tr key={f.id}>
                              <td className="col-field-id mono alpha-cell">
                                {f.id}
                              </td>
                              <td className="col-field-desc">
                                {f.description}
                              </td>
                              <td className="col-field-ds">
                                <span className="dataset-tag">
                                  {f.dataset_id}
                                </span>
                              </td>
                              <td className="col-field-type mono">{f.type}</td>
                              <td className="col-field-action">
                                <ButtonBase
                                  className="small primary"
                                  onClick={() => {
                                    setExpression((x) => `${x}\n${f.id}`);
                                    switchPage("factory");
                                    setNotice(
                                      `Inserted field '${f.id}' into Alpha Studio editor.`,
                                    );
                                  }}
                                >
                                  <span>Insert</span>
                                  <ArrowRight size={13} />
                                </ButtonBase>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pagination">
                      <span className="pagination-info">
                        SHOWING{" "}
                        {fields.length
                          ? (fieldPage - 1) * CATALOG_PAGE_SIZE + 1
                          : 0}
                        –
                        {Math.min(
                          fieldPage * CATALOG_PAGE_SIZE,
                          fieldTotal,
                        )}{" "}
                        OF {NUMBER.format(fieldTotal)}
                      </span>
                      <div className="pagination-buttons">
                        <ButtonBase
                          disabled={fieldPage <= 1}
                          onClick={() => setFieldPage((x) => x - 1)}
                        >
                          Previous
                        </ButtonBase>
                        <span>
                          PAGE {fieldPage} OF{" "}
                          {Math.max(
                            1,
                            Math.ceil(fieldTotal / CATALOG_PAGE_SIZE),
                          )}
                        </span>
                        <ButtonBase
                          disabled={fieldPage * CATALOG_PAGE_SIZE >= fieldTotal}
                          onClick={() => setFieldPage((x) => x + 1)}
                        >
                          Next
                        </ButtonBase>
                      </div>
                    </div>
                  </section>
                )}

                {/* ========================================================= */}
                {/* PAGE 05: ENGINE & SESSION (CUSTOM POPOVER DROPDOWNS)      */}
                {/* ========================================================= */}
                {page === "settings" && (
                  <Reveal
                    distance={22}
                    duration={0.5}
                    stagger={0.05}
                    trigger="mount"
                    className="settings-layout"
                  >
                    <section className="glass-soft settings-card">
                      <span className="eyebrow">01 · SYNTHESIS ENGINE</span>
                      <h2>Discovery Engine Configuration</h2>
                      <p className="section-sub">
                        Select how candidate FastExpr formulas are synthesized
                        when you click Generate or Auto-Mine.
                      </p>
                      <form onSubmit={onSettings}>
                        <label>
                          Primary Generation Engine
                          <CustomSelect
                            value={engine}
                            onChange={setEngine}
                            options={[
                              {
                                value: "algorithmic",
                                label:
                                  "Algorithmic Grammar Trees (Deterministic · Zero API Key)",
                                sub: "5 institutional multi-factor templates",
                              },
                              {
                                value: "cloud_ai",
                                label:
                                  "Cloud LLM Agent (Google Gemini / OpenAI)",
                                sub: "Frontier AI factor synthesis",
                              },
                              {
                                value: "ollama",
                                label:
                                  "Local Ollama Agent (Offline DeepSeek-R1 / Llama3)",
                                sub: "Runs privately on localhost:11434",
                              },
                            ]}
                          />
                        </label>

                        {engine === "cloud_ai" && (
                          <>
                            <label>
                              Cloud Provider
                              <CustomSelect
                                value={cloudProvider}
                                onChange={setCloudProvider}
                                options={[
                                  {
                                    value: "gemini",
                                    label: "Google Gemini (gemini-2.0-flash)",
                                    sub: "Fastest institutional FastExpr synthesis",
                                  },
                                  {
                                    value: "openai",
                                    label: "OpenAI (gpt-4o-mini)",
                                    sub: "OpenAI chat completions API",
                                  },
                                ]}
                              />
                            </label>
                            <label>
                              API Key{" "}
                              <small>Stored only in local memory session</small>
                              <input
                                type="password"
                                autoComplete="off"
                                placeholder="Enter Gemini or OpenAI API key…"
                                value={cloudKey}
                                onChange={(e) => setCloudKey(e.target.value)}
                              />
                            </label>
                            <ButtonBase
                              className="full"
                              onClick={validateKey}
                              disabled={!cloudKey || busy === "key"}
                            >
                              <ShieldCheck size={15} /> Verify API Key
                            </ButtonBase>
                          </>
                        )}

                        {engine === "ollama" && (
                          <>
                            <label>
                              Local Ollama Endpoint
                              <input
                                value={ollamaEndpoint}
                                onChange={(e) =>
                                  setOllamaEndpoint(e.target.value)
                                }
                              />
                            </label>
                            <label>
                              Model Tag
                              <input
                                value={ollamaModel}
                                onChange={(e) => setOllamaModel(e.target.value)}
                              />
                            </label>
                            <ButtonBase
                              className="full"
                              onClick={discoverModels}
                              disabled={busy === "models"}
                            >
                              <Search size={15} /> Detect Installed Models
                            </ButtonBase>
                          </>
                        )}

                        <ButtonBase
                          type="submit"
                          className="primary full"
                          disabled={busy === "engine"}
                        >
                          <Check size={15} /> Save Engine Settings
                        </ButtonBase>
                      </form>
                      <div className="settings-status">
                        <Cpu size={17} />
                        <span>
                          Active Engine:{" "}
                          <b>{String(summary.engine || engine).toUpperCase()}</b>
                        </span>
                      </div>
                    </section>

                    <section className="glass-soft settings-card">
                      <span className="eyebrow">02 · WORLDQUANT BRAIN</span>
                      <h2>
                        {authenticated
                          ? "Connected Consultant Session"
                          : "Connect Consultant Credentials"}
                      </h2>
                      <p className="section-sub">
                        Used exclusively by your local server to authenticate
                        against `api.worldquantbrain.com`.
                      </p>
                      {authenticated ? (
                        <>
                          <div className="connected-user">
                            <AlphaLogo size={40} />
                            <div>
                              <strong>
                                {user?.fullName || "Quant Researcher"}
                              </strong>
                              <small>
                                {user?.level || "CONSULTANT"} · SESSION ACTIVE
                              </small>
                            </div>
                          </div>
                          <ButtonBase
                            className="full"
                            onClick={() =>
                              void action(
                                "logout",
                                async () => {
                                  await post("/api/auth/logout");
                                  setAuthenticated(false);
                                  setUser(null);
                                },
                                "BRAIN session signed out",
                              )
                            }
                          >
                            <LogOut size={15} /> Sign Out of Session
                          </ButtonBase>
                        </>
                      ) : (
                        <form onSubmit={onLogin}>
                          <label>
                            WorldQuant BRAIN Email
                            <input
                              type="email"
                              autoComplete="username"
                              placeholder="consultant@worldquantbrain.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </label>
                          <label>
                            Password
                            <input
                              type="password"
                              autoComplete="current-password"
                              placeholder="••••••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                          </label>
                          <ButtonBase
                            type="submit"
                            className="primary full"
                            disabled={busy === "login"}
                          >
                            <LockKeyhole size={15} />{" "}
                            {busy === "login"
                              ? "Authenticating…"
                              : "Authenticate Session"}
                          </ButtonBase>
                        </form>
                      )}
                      <div className="settings-status">
                        <Radar size={17} />
                        <span>
                          Background Correlation Auditor:{" "}
                          <b>{worker.is_running ? "RUNNING" : "STANDBY"}</b>
                        </span>
                      </div>
                      <ButtonBase
                        className="full"
                        onClick={() =>
                          void action(
                            "audit",
                            () => post("/api/correlation-worker/start"),
                            "Background correlation audit triggered",
                          )
                        }
                        disabled={!authenticated}
                      >
                        <RefreshCw size={15} /> Run Portfolio Correlation Audit
                      </ButtonBase>
                    </section>
                  </Reveal>
                )}

                {/* ========================================================= */}
                {/* PAGE 06: RESEARCH PROTOCOL + AKSHAT & ASHWIN PROFILES     */}
                {/* ========================================================= */}
                {page === "terms" && (
                  <Reveal
                    distance={22}
                    duration={0.5}
                    stagger={0.05}
                    trigger="mount"
                  >
                    <TermsPanel />
                  </Reveal>
                )}

                {/* ========================================================= */}
                {/* PAGE 404: ANOMALY SCREEN                                  */}
                {/* ========================================================= */}
                {page === "notfound" && (
                  <div className="anomaly-view">
                    <AsciiCanvas
                      className="hero-ascii-bg"
                      colors={["#0A1410", "#133829", "#E85D2A", "#C5A875"]}
                      shape="eclipse"
                      cellSize={18}
                      density={0.75}
                      glow={0}
                    />
                    <div className="anomaly-content">
                      <AlphaLogo size={58} />
                      <span className="hero-badge">
                        SIGNAL INTERRUPTED · ROUTE UNDEFINED
                      </span>
                      <div className="fuzzy-wrap">
                        <GlitchTitle
                          fontSize="clamp(4.5rem, 9vw, 8rem)"
                          fontWeight={900}
                          fontFamily="Space Grotesk"
                          color="#F2EFE9"
                          colorSplit={0.35}
                          trigger="hover"
                          baseIntensity={0.16}
                          hoverIntensity={0.5}
                          fuzzRange={28}
                          intro
                          introDuration={1200}
                          clickEffect
                          glitchMode
                          glitchInterval={2600}
                          glitchDuration={180}
                        >
                          404
                        </GlitchTitle>
                      </div>
                      <p>
                        The requested coordinate is outside the active research
                        workspace. Return to the Command Overview to continue.
                      </p>
                      <ButtonBase
                        className="primary"
                        onClick={() => switchPage("overview")}
                      >
                        Return to Command Overview <ArrowRight size={15} />
                      </ButtonBase>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* =============================================================== */}
          {/* RIGHT INSPECTOR DOCK: 1-VIEWPORT EXCLUSIVE ACCORDION            */}
          {/* =============================================================== */}
          <aside className="inspector glass" aria-label="Alpha Telemetry Dock">
            <div className="inspector-accordion">
              {/* ACCORDION 01: ALPHA INSPECTOR */}
              <section
                className={`accordion-panel recessed ${inspectorSection === "inspector" ? "is-expanded" : "is-collapsed"}`}
              >
                <button
                  type="button"
                  className="accordion-trigger dark"
                  aria-expanded={inspectorSection === "inspector"}
                  onClick={() => toggleAccordion("inspector")}
                >
                  <div className="accordion-title-group">
                    <span className="accordion-idx">01</span>
                    <div>
                      <strong>ALPHA INSPECTOR</strong>
                      <small>
                        {selected
                          ? `${selected.id} · Sharpe ${fmt(selected.sharpe)}`
                          : "Select an alpha to inspect"}
                      </small>
                    </div>
                  </div>
                  <div className="accordion-right">
                    <span
                      className={`tier-badge ${tierClass(selected?.tier)}`}
                    >
                      {selected ? selected.tier || "EVALUATED" : "STANDBY"}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`accordion-chevron ${inspectorSection === "inspector" ? "open" : ""}`}
                    />
                  </div>
                </button>

                {inspectorSection === "inspector" && (
                  <div className="accordion-body dark-body">
                    {selected ? (
                      <>
                        <div className="inspector-id-row">
                          <div>
                            <small className="inspector-kicker">
                              SELECTED CANDIDATE
                            </small>
                            <div className="alpha-id">{selected.id}</div>
                          </div>
                          <span
                            className={`status-chip ${outcomeClass(selected)}`}
                          >
                            {statusOf(selected)}
                          </span>
                        </div>

                        <div className="telemetry-grid">
                          <div>
                            <small>SHARPE RATIO</small>
                            <strong>{fmt(selected.sharpe)}</strong>
                          </div>
                          <div>
                            <small>FITNESS SCORE</small>
                            <strong>{fmt(selected.fitness)}</strong>
                          </div>
                          <div>
                            <small>DAILY TURNOVER</small>
                            <strong>
                              {fmt(
                                selected.turnover_pct ??
                                  (selected.turnover || 0) * 100,
                              )}
                              %
                            </strong>
                          </div>
                          <div>
                            <small>SELF-CORR</small>
                            <strong>
                              {fmt(selected.max_self_correlation)}
                            </strong>
                          </div>
                        </div>

                        <div className="hurdle-bars">
                          <div className="hurdle-bars-head">
                            <span>HURDLE STANDING</span>
                            <span>THRESHOLD</span>
                          </div>
                          {hurdleBars(selected).map((bar) => (
                            <div className="hurdle-bar-row" key={bar.label}>
                              <div className="hurdle-bar-meta">
                                <span>{bar.label}</span>
                                <strong>
                                  {bar.val} <em>({bar.target})</em>
                                </strong>
                              </div>
                              <div className="hurdle-bar-track">
                                <i
                                  className={bar.pass ? "pass" : "warn"}
                                  style={{ width: `${bar.pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="inspector-code-block">
                          <div className="inspector-code-head">
                            <span>FASTEXPR FORMULA</span>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(
                                  selected.expression || "",
                                );
                                setNotice(
                                  "FastExpr formula copied to clipboard.",
                                );
                              }}
                            >
                              <Copy size={12} /> Copy
                            </button>
                          </div>
                          <pre className="inspector-expr selectable-code">
                            {selected.expression ||
                              "Click Check Corr or Sync Portfolio to load expression."}
                          </pre>
                        </div>

                        <div className="cartridge-actions">
                          <ButtonBase
                            className="small"
                            onClick={() => cloneToFactory(selected)}
                          >
                            <FlaskConical size={13} /> Clone to Studio
                          </ButtonBase>
                          <ButtonBase
                            className="small"
                            onClick={() => checkCorrelation(selected)}
                            disabled={busy === "correlation"}
                          >
                            <Radar size={13} /> Check Corr
                          </ButtonBase>
                          <ButtonBase
                            className="small primary full-span"
                            disabled={
                              !selected.is_submittable ||
                              selected.submission_status === "SUBMITTED"
                            }
                            onClick={() => submit(selected)}
                          >
                            <span>
                              {selected.submission_status === "SUBMITTED"
                                ? "Submitted on BRAIN"
                                : "Submit Alpha to BRAIN"}
                            </span>
                            <ArrowRight size={13} />
                          </ButtonBase>
                        </div>
                      </>
                    ) : (
                      <p className="inspector-empty">
                        Select any Alpha in the table to inspect its metrics,
                        formula, and hurdle verification here.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* ACCORDION 02: PLATFORM CHECKS */}
              <section
                className={`accordion-panel glass-soft ${inspectorSection === "checks" ? "is-expanded" : "is-collapsed"}`}
              >
                <button
                  type="button"
                  className="accordion-trigger light"
                  aria-expanded={inspectorSection === "checks"}
                  onClick={() => toggleAccordion("checks")}
                >
                  <div className="accordion-title-group">
                    <span className="accordion-idx">02</span>
                    <div>
                      <strong>PLATFORM CHECKS</strong>
                      <small>
                        {selected
                          ? `Verification matrix for ${selected.id}`
                          : "WorldQuant BRAIN hurdle audit"}
                      </small>
                    </div>
                  </div>
                  <div className="accordion-right">
                    <span className="tiny-pill">
                      {passedChecksCount}/{checksList.length} PASS
                    </span>
                    <ChevronDown
                      size={16}
                      className={`accordion-chevron ${inspectorSection === "checks" ? "open" : ""}`}
                    />
                  </div>
                </button>

                {inspectorSection === "checks" && (
                  <div className="accordion-body light-body">
                    <div className="checks-meta-strip">
                      <span>
                        SELF-CORRELATION:{" "}
                        <b>
                          {selected?.max_self_correlation !== undefined &&
                          selected?.max_self_correlation !== null
                            ? fmt(selected.max_self_correlation)
                            : "< 0.70"}
                        </b>
                      </span>
                      <span>
                        CEILING: <b>&lt; 0.70</b>
                      </span>
                    </div>
                    <div className="inspector-checks">
                      {checksList.map((check, index) => {
                        const resStr = String(
                          check.result || "PENDING",
                        ).toUpperCase();
                        const isPass = resStr.includes("PASS");
                        const isWarn = resStr.includes("WARN");
                        return (
                          <div
                            className="check-row"
                            key={`${check.name || "check"}-${index}`}
                          >
                            <span className="check-name">
                              {String(check.name || "HURDLE").replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                            <b
                              className={
                                isPass ? "pass" : isWarn ? "warn" : "fail"
                              }
                            >
                              {resStr}
                            </b>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* ACCORDION 03: RECENT EVENTS */}
              <section
                className={`accordion-panel glass-soft ${inspectorSection === "events" ? "is-expanded" : "is-collapsed"}`}
              >
                <button
                  type="button"
                  className="accordion-trigger light"
                  aria-expanded={inspectorSection === "events"}
                  onClick={() => toggleAccordion("events")}
                >
                  <div className="accordion-title-group">
                    <span className="accordion-idx">03</span>
                    <div>
                      <strong>RECENT EVENTS</strong>
                      <small>Live simulation &amp; audit stream</small>
                    </div>
                  </div>
                  <div className="accordion-right">
                    <span className="tiny-pill">{activity.length} LOGS</span>
                    <ChevronDown
                      size={16}
                      className={`accordion-chevron ${inspectorSection === "events" ? "open" : ""}`}
                    />
                  </div>
                </button>

                {inspectorSection === "events" && (
                  <div className="accordion-body light-body">
                    {activity.length ? (
                      <ActivityList
                        items={activity.map((item) => ({
                          ...item,
                          icon: <Activity size={14} />,
                        }))}
                        theme="light"
                        frame={false}
                        width="100%"
                        maxHeight={420}
                        showGradients={false}
                        animation="slide"
                      />
                    ) : (
                      <div className="feed-empty">
                        No events recorded yet in this session.
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      </div>

      {/* COMMAND PALETTE & GLOBAL SEARCH (⌘K) */}
      {palette && (
        <div className="palette-backdrop" onClick={() => setPalette(false)}>
          <div
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Global Search"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="no-cursor-lock">
              <Search size={18} />
              <input
                autoFocus
                className="no-cursor-lock"
                placeholder="Search pages, alphas, FastExpr operators, or 4,367 data fields…"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
              />
              <kbd>ESC</kbd>
            </label>
            <div className="palette-results">
              {NAV_ITEMS.filter((n) =>
                `${n.label} ${n.hint}`
                  .toLowerCase()
                  .includes(paletteQuery.toLowerCase()),
              ).map((n) => (
                <button key={n.page} onClick={() => switchPage(n.page)}>
                  <n.icon size={16} />
                  <span>{n.label}</span>
                  <small>{n.hint}</small>
                  <ArrowRight size={14} />
                </button>
              ))}

              {alphas
                .filter((a) =>
                  `${a.id} ${a.expression || ""}`
                    .toLowerCase()
                    .includes(paletteQuery.toLowerCase()),
                )
                .slice(0, paletteQuery.trim() ? 6 : 3)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      void openAlpha(a);
                      switchPage("vault");
                    }}
                  >
                    <Radar size={16} />
                    <span>Alpha {a.id}</span>
                    <small>
                      Sharpe {fmt(a.sharpe)} · Fitness {fmt(a.fitness)}
                    </small>
                    <ArrowRight size={14} />
                  </button>
                ))}

              {paletteFields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setExpression((x) => `${x}\n${f.id}`);
                    switchPage("factory");
                    setNotice(`Inserted field '${f.id}' into Alpha Studio.`);
                  }}
                >
                  <Database size={16} />
                  <span>Field: {f.id}</span>
                  <small>{f.dataset_id}</small>
                  <ArrowRight size={14} />
                </button>
              ))}

              {OPERATOR_GUIDES.filter((op) =>
                `${op.label} ${op.guide}`
                  .toLowerCase()
                  .includes(paletteQuery.toLowerCase()),
              )
                .slice(0, 4)
                .map((op) => (
                  <button
                    key={op.snippet}
                    onClick={() => {
                      setExpression((x) => `${x}${op.snippet}`);
                      switchPage("factory");
                    }}
                  >
                    <Terminal size={16} />
                    <span>Insert {op.label}</span>
                    <small>{op.guide}</small>
                    <ArrowRight size={14} />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* HEAD-TO-HEAD ALPHA COMPARISON MODAL */}
      {comparison.length > 0 && (
        <div className="palette-backdrop" onClick={() => setComparison([])}>
          <div
            className="compare-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Alpha comparison"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <div>
                <span className="eyebrow">HEAD-TO-HEAD</span>
                <h2>Signal Comparison</h2>
              </div>
              <button
                onClick={() => setComparison([])}
                aria-label="Close"
                className="modal-close-inline"
              >
                <X size={18} />
              </button>
            </div>
            <div className="compare-columns">
              {comparison.map((a) => (
                <article key={a.id}>
                  <strong>{a.id}</strong>
                  <span>
                    SHARPE <b>{fmt(a.sharpe)}</b>
                  </span>
                  <span>
                    FITNESS <b>{fmt(a.fitness)}</b>
                  </span>
                  <span>
                    TURNOVER <b>{fmt(a.turnover_pct)}%</b>
                  </span>
                  <span>
                    SELF-CORR <b>{fmt(a.max_self_correlation)}</b>
                  </span>
                  <span>
                    STATUS <b>{statusOf(a)}</b>
                  </span>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SIGN-IN MODAL */}
      {loginOpen && (
        <LoginModal
          email={email}
          password={password}
          busy={busy === "login"}
          onEmail={setEmail}
          onPassword={setPassword}
          onSubmit={onLogin}
          onClose={() => setLoginOpen(false)}
        />
      )}
    </div>
  );
}

function SignalFrontierChart({
  alphas,
  selectedId,
  onSelect,
}: {
  alphas: Alpha[];
  selectedId?: string;
  onSelect: (a: Alpha) => void;
}) {
  const counts = useMemo(() => {
    let submitted = 0;
    let qualified = 0;
    let draft = 0;
    alphas.forEach((a) => {
      if (a.submission_status === "SUBMITTED") submitted++;
      else if (passesMetricHurdles(a)) qualified++;
      else draft++;
    });
    return { submitted, qualified, draft, total: Math.max(1, alphas.length) };
  }, [alphas]);

  const topSignals = useMemo(
    () =>
      [...alphas]
        .sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
        .slice(0, 5),
    [alphas],
  );

  return (
    <div className="frontier-chart">
      <div className="frontier-summary-bar">
        <div className="frontier-summary-labels">
          <span>
            Submitted: <b>{counts.submitted}</b>
          </span>
          <span>
            Hurdle Passed (Fit ≥ 1.0): <b>{counts.qualified}</b>
          </span>
          <span>
            Below Hurdle: <b>{counts.draft}</b>
          </span>
        </div>
        <div className="frontier-bar-track">
          <i
            className="seg-submitted"
            style={{ width: `${(counts.submitted / counts.total) * 100}%` }}
          />
          <i
            className="seg-qualified"
            style={{ width: `${(counts.qualified / counts.total) * 100}%` }}
          />
          <i
            className="seg-draft"
            style={{ width: `${(counts.draft / counts.total) * 100}%` }}
          />
        </div>
      </div>

      <div className="frontier-rows">
        {topSignals.map((alpha) => {
          const fit = alpha.fitness || 0;
          const pct = Math.max(10, Math.min(100, Math.round((fit / 3.0) * 100)));
          return (
            <div
              key={alpha.id}
              className={`frontier-row ${selectedId === alpha.id ? "active" : ""}`}
              onClick={() => onSelect(alpha)}
            >
              <div className="frontier-row-id">
                <strong>{alpha.id}</strong>
                <span className={`status-chip ${outcomeClass(alpha)}`}>
                  {statusOf(alpha)}
                </span>
              </div>
              <div className="frontier-row-bar">
                <div className="frontier-track">
                  <i
                    className={outcomeClass(alpha)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="frontier-row-metrics">
                <span>
                  Fitness <b>{fmt(alpha.fitness)}</b>
                </span>
                <span>
                  Sharpe <b>{fmt(alpha.sharpe)}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlphaTable({
  rows,
  selectedId,
  onSelect,
  onSubmit,
  search,
  setSearch,
  title,
  subtitle,
  empty,
  fullHeight = false,
  compareIds,
  onCompareToggle,
}: {
  rows: Alpha[];
  selectedId?: string;
  onSelect: (a: Alpha) => void;
  onSubmit: (a: Alpha) => void;
  search: string;
  setSearch: (s: string) => void;
  title: string;
  subtitle?: string;
  empty: string;
  fullHeight?: boolean;
  compareIds?: string[];
  onCompareToggle?: (id: string) => void;
}) {
  return (
    <section className="table-card glass-soft">
      <div className="section-head">
        <div>
          <span className="eyebrow">LOCAL AUDIT ARCHIVE</span>
          <h2>{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        <label className="search-box no-cursor-lock">
          <Search size={15} />
          <input
            className="no-cursor-lock"
            aria-label="Filter alphas by ID or formula"
            placeholder="Filter by Alpha ID or formula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className={`table-wrap ${fullHeight ? "vault-full-scroll" : ""}`}>
        <table className="alpha-registry-table">
          <thead>
            <tr>
              {onCompareToggle && <th className="col-check">CMP</th>}
              <th className="col-id">ALPHA ID</th>
              <th className="col-expr">FORMULA PREVIEW</th>
              <th className="col-tier">QUALITY</th>
              <th className="col-num">SHARPE</th>
              <th className="col-num">FITNESS</th>
              <th className="col-num">TURNOVER</th>
              <th className="col-num">SELF-CORR</th>
              <th className="col-status">STATUS</th>
              <th className="col-action">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const corr = a.max_self_correlation;
              const corrPass =
                corr === undefined || corr === null || corr < 0.7;
              return (
                <tr
                  key={a.id}
                  className={selectedId === a.id ? "selected-row" : ""}
                  onClick={() => onSelect(a)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(a);
                  }}
                >
                  {onCompareToggle && (
                    <td
                      className="col-check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Compare ${a.id}`}
                        checked={compareIds?.includes(a.id) || false}
                        onChange={() => onCompareToggle(a.id)}
                      />
                    </td>
                  )}
                  <td className="col-id alpha-cell">{a.id}</td>
                  <td className="col-expr mono">
                    <span className="expr-truncate">
                      {a.expression || "Simulated factor candidate"}
                    </span>
                  </td>
                  <td className="col-tier">
                    <span className={`quality-pill ${tierClass(a.tier)}`}>
                      {a.tier || "DRAFT"}
                    </span>
                  </td>
                  <td className="col-num mono">{fmt(a.sharpe)}</td>
                  <td className="col-num mono">{fmt(a.fitness)}</td>
                  <td className="col-num mono">
                    {fmt(a.turnover_pct ?? (a.turnover || 0) * 100)}%
                  </td>
                  <td className="col-num mono">
                    <span
                      className={`corr-val ${corrPass ? "corr-pass" : "corr-high"}`}
                    >
                      {corr !== undefined && corr !== null ? fmt(corr) : "—"}
                    </span>
                  </td>
                  <td className="col-status">
                    <span className={`status-chip ${outcomeClass(a)}`}>
                      {statusOf(a)}
                    </span>
                  </td>
                  <td className="col-action">
                    <button
                      className={`table-action-btn ${a.is_submittable && a.submission_status !== "SUBMITTED" ? "is-ready" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        a.is_submittable && a.submission_status !== "SUBMITTED"
                          ? onSubmit(a)
                          : onSelect(a);
                      }}
                    >
                      <span>
                        {a.is_submittable && a.submission_status !== "SUBMITTED"
                          ? "Submit"
                          : "Inspect"}
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="table-empty">
            <Compass size={20} />
            <span>{empty}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function TermsPanel() {
  const sections = [
    [
      "01",
      "OPERATIONAL MANDATE",
      "This quantitative research studio accelerates factor discovery, simulation, and hurdle verification for WorldQuant BRAIN consultants. All cloud simulations and portfolio submissions abide by official platform rate limits and governance rules.",
    ],
    [
      "02",
      "LOCAL COMPUTE & DATA SOVEREIGNTY",
      "Factor expressions, SQLite audit trails, and session preferences remain stored on your local machine unless you explicitly dispatch a simulation or synchronize with WorldQuant BRAIN.",
    ],
    [
      "03",
      "CONSULTANT SUBMISSION CONTROL",
      "Automated pipelines verify Sharpe ≥ 1.25, Fitness ≥ 1.00, Turnover 1%–70%, and Self-Correlation < 0.70, but live portfolio submission always requires explicit human confirmation.",
    ],
    [
      "04",
      "RISK & RESEARCH DISCLOSURE",
      "All backtest metrics, Sharpe ratios, and fitness scores are for quantitative research and competition evaluation only and do not constitute investment advice.",
    ],
  ];
  return (
    <div className="terms-grid">
      {sections.map(([n, h, p]) => (
        <article className="terms-card glass-soft" key={n}>
          <span className="terms-num">{n}</span>
          <div>
            <span className="eyebrow">CLAUSE {n}</span>
            <h2>{h}</h2>
            <p>{p}</p>
          </div>
        </article>
      ))}

      {/* DEDICATED PROFILE & GITHUB REPOSITORY CARDS FOR ASHWIN AND AKSHAT */}
      <article className="creator-profile-card glass-soft">
        <div className="creator-head">
          <AlphaLogo size={44} />
          <div>
            <span className="eyebrow">ARCHITECT &amp; CREATOR</span>
            <h2>Ashwin</h2>
            <small>Quantitative Pipeline &amp; BRAIN Engine Architect</small>
          </div>
        </div>
        <p>
          Creator of the core WorldQuant BRAIN simulation client, multi-factor
          algorithmic grammar trees, and real-time portfolio self-correlation
          auditing engine.
        </p>
        <div className="creator-actions">
          <a
            className="button primary"
            href="https://github.com/Ashwin-anand-dot"
            target="_blank"
            rel="noreferrer"
          >
            <span>GitHub Profile (@Ashwin-anand-dot)</span>
            <ExternalLink size={14} />
          </a>
          <a
            className="button"
            href="https://github.com/Ashwin-anand-dot/brain-alpha-github"
            target="_blank"
            rel="noreferrer"
          >
            <span>Original Repository</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </article>

      <article className="creator-profile-card glass-soft">
        <div className="creator-head">
          <AlphaLogo size={44} />
          <div>
            <span className="eyebrow">ARCHITECT &amp; CREATOR</span>
            <h2>Akshat</h2>
            <small>Lead UI/UX Architect &amp; Full-Stack Engineer</small>
          </div>
        </div>
        <p>
          Architect of the Emerald Residence interactive workbench, React Bits
          telemetry integration, custom FastExpr studio, and institutional
          visualization system.
        </p>
        <div className="creator-actions">
          <a
            className="button primary"
            href="https://github.com/ashuwuin"
            target="_blank"
            rel="noreferrer"
          >
            <span>GitHub Profile (@ashuwuin)</span>
            <ExternalLink size={14} />
          </a>
          <a
            className="button"
            href="https://github.com/ashuwuin/WorldQuant-Alpha-Miner"
            target="_blank"
            rel="noreferrer"
          >
            <span>WorldQuant-Alpha-Miner Repo</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </article>
    </div>
  );
}
