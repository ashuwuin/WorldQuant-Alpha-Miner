import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ComponentType } from "react";
import Lenis from "lenis";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Award,
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
  UserCheck,
  Wand2,
  X,
} from "lucide-react";
import AnimatedList from "./components/AnimatedList";
import { AlphaLogo } from "./components/AlphaLogo";
import TechText from "./components/TechText";
import TargetCursor from "./components/TargetCursor";
import GradientASCII from "./components/GradientASCII";
import FuzzyText from "./components/FuzzyText";
import { LoginModal } from "./components/LoginModal";
import { CustomSelect } from "./components/CustomSelect";
import { CommandPalette, type PaletteItem } from "./components/CommandPalette";

const ActivityList = AnimatedList as ComponentType<any>;
const TechWordmark = TechText as ComponentType<any>;
const Cursor = TargetCursor as ComponentType<any>;
const AsciiCanvas = GradientASCII as ComponentType<any>;
const GlitchTitle = FuzzyText as ComponentType<any>;

type Page =
  | "overview"
  | "factory"
  | "vault"
  | "catalog"
  | "settings"
  | "terms"
  | "personal"
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
  region?: string;
  universe?: string;
  delay?: number;
  neutralization?: string;
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

type ProfileShowcase = {
  authenticated: boolean;
  user: {
    id?: string;
    fullName?: string;
    email?: string;
    level?: string;
  };
  platform_url: string;
  metrics: {
    total_created: number;
    submitted_count: number;
    hurdle_passed_count: number;
    orthogonal_count: number;
    corr_checked_count: number;
    peak_sharpe: number;
    peak_fitness: number;
    avg_sharpe: number;
    avg_fitness: number;
    pass_rate_pct: number;
  };
  tier_distribution: Record<string, number>;
  submitted_alphas: Alpha[];
  orthogonal_alphas: Alpha[];
  milestones: {
    id: string;
    title: string;
    description: string;
    metric: string;
    unlocked: boolean;
  }[];
};

type ToastState = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
} | null;

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
  {
    page: "personal",
    label: "Personal Dashboard",
    hint: "Rank & BRAIN portfolio",
    icon: Award,
    index: "07",
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

/**
 * Self-Correlation Color Rule:
 * - Below 0.58: Green (`corr-pass`)
 * - Near 0.70 (0.58 to 0.69) or >= 0.70: Red (`corr-high`)
 */
const corrColorClass = (corr?: number | null) => {
  if (corr === undefined || corr === null) return "corr-pass";
  return corr < 0.58 ? "corr-pass" : "corr-high";
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
      pass: corr === undefined || corr === null || corr < 0.58,
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
  const displayValue =
    numeric !== undefined ? numeric.toFixed(decimals) : value;

  return (
    <article
      className={`metric-card tone-${tone} ${onClick ? "is-clickable" : ""}`}
      onClick={onClick}
    >
      <div className="metric-top">
        <span className="metric-label" title={label}>
          {label}
        </span>
        <span className="metric-tag" title={sub}>
          {sub}
        </span>
      </div>
      <div className="metric-middle">
        <strong>{displayValue}</strong>
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
  busy = false,
  busyLabel,
  done = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  done?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`button ${busy ? "is-busy" : ""} ${done ? "is-done" : ""} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled || busy}
    >
      {busy ? (
        <span>{busyLabel || "Working…"}</span>
      ) : done ? (
        <span className="button-done-state">
          <Check size={14} />
          <span>Completed</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function AuthGateCard({
  title,
  description,
  buttonLabel = "Sign In to Continue",
  onSignIn,
}: {
  title: string;
  description: string;
  buttonLabel?: string;
  onSignIn: () => void;
}) {
  return (
    <section className="auth-gate-card glass-soft page-enter">
      <div className="auth-gate-inner">
        <div className="auth-gate-icon">
          <LockKeyhole size={24} />
        </div>
        <span className="eyebrow">AUTHENTICATION REQUIRED</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <button
          type="button"
          className="button primary auth-gate-btn"
          onClick={onSignIn}
        >
          <LockKeyhole size={15} />
          <span>{buttonLabel}</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  const initialPage: Page =
    pathname === "/studio"
      ? "factory"
      : pathname === "/terms"
        ? "terms"
        : pathname === "/personal"
          ? "personal"
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
    id?: string;
    fullName?: string;
    email?: string;
    level?: string;
  } | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [showcase, setShowcase] = useState<ProfileShowcase | null>(null);
  const [worker, setWorker] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState("");
  const [doneAction, setDoneAction] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [loginError, setLoginError] = useState("");
  const [activity, setActivity] = useState<
    { id: string; title: string; description: string; meta: string }[]
  >([]);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteFields, setPaletteFields] = useState<Field[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [vaultFilter, setVaultFilter] = useState("all");
  const [vaultTransitioning, setVaultTransitioning] = useState(false);
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
  const mainContent = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const scopeWrapRef = useRef<HTMLDivElement>(null);
  const seededActivity = useRef(false);

  const CATALOG_PAGE_SIZE = 10;

  const notify = useCallback(
    (
      title: string,
      message: string,
      actionLabel?: string,
      onAction?: () => void,
    ) => {
      setToast({ title, message, actionLabel, onAction });
    },
    [],
  );

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

  // Smooth Momentum Scrolling across #workspace via Lenis
  useEffect(() => {
    const wrapper = mainScroll.current;
    const content = mainContent.current;
    if (!wrapper || !content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.13,
      smoothWheel: true,
      wheelMultiplier: 1.0,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Resize Lenis when page or filter changes
  useEffect(() => {
    lenisRef.current?.resize();
  }, [page, vaultFilter, vaultView, alphas.length, authenticated]);

  // Deterministic non-blocking boot splash timer with AsciiCanvas + TechWordmark
  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setSplashFade(true), 850);
    const hideTimer = window.setTimeout(() => setSplashVisible(false), 1200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Auto-dismiss Bottom-Right Theme Toast after 4s
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

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

  /**
   * Privacy-First Refresh:
   * Checks `/api/auth/me` FIRST. If not authenticated, clears all personal data
   * (`alphas`, `stats`, `selected`, `showcase`, `activity`) so ZERO personal data
   * is ever exposed before signing in!
   */
  const refresh = useCallback(async () => {
    try {
      const me = await api<{
        authenticated: boolean;
        user?: {
          id?: string;
          fullName?: string;
          email?: string;
          level?: string;
        };
      }>("/api/auth/me").catch(() => ({ authenticated: false }));

      setAuthenticated(me.authenticated);
      setUser(me.authenticated && "user" in me ? me.user || null : null);

      if (!me.authenticated) {
        setStats({});
        setAlphas([]);
        setSelected(null);
        setShowcase(null);
        setActivity([]);
        seededActivity.current = false;
        return;
      }

      const [s, a, w, p, sum] = await Promise.all([
        api<Stats>("/api/stats"),
        api<{ alphas: Alpha[] }>(
          "/api/alphas?limit=1000&sort_by=fitness&order=desc",
        ),
        api<Record<string, unknown>>("/api/correlation-worker/status").catch(
          () => ({}),
        ),
        api<ProfileShowcase>("/api/profile/showcase").catch(() => null),
        api<Record<string, unknown>>("/api/user/dashboard-summary").catch(
          () => ({}),
        ),
      ]);
      setStats(s);
      setAlphas(a.alphas || []);
      setWorker(w);
      setSummary(sum);
      if (p) setShowcase(p);
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
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
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
              : path === "/personal"
                ? "personal"
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
        if (!palette) {
          event.preventDefault();
          setSelectorOpen(false);
          setPalette(true);
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [palette]);

  useEffect(() => {
    if (!palette || !authenticated) {
      setPaletteFields([]);
      setPaletteLoading(false);
      return;
    }
    if (paletteQuery.trim().length < 2) {
      setPaletteFields(fields.slice(0, 5));
      setPaletteLoading(false);
      return;
    }
    setPaletteLoading(true);
    const timer = window.setTimeout(() => {
      void api<{ fields: Field[] }>(
        `/api/data-fields?search=${encodeURIComponent(paletteQuery.trim())}&limit=8`,
      )
        .then((res) => setPaletteFields(res.fields || []))
        .catch(() => setPaletteFields([]))
        .finally(() => setPaletteLoading(false));
    }, 120);
    return () => clearTimeout(timer);
  }, [palette, paletteQuery, fields, authenticated]);

  useEffect(() => {
    if (!authenticated) return;
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
          .catch((e) => notify("CATALOG ERROR", String(e))),
      120,
    );
    return () => clearTimeout(t);
  }, [fieldSearch, fieldDataset, fieldPage, authenticated, notify]);

  useEffect(() => {
    if (!authenticated) return;
    void api<{ datasets: Dataset[] }>("/api/datasets")
      .then((x) => setDatasets(x.datasets))
      .catch(() => {});
  }, [authenticated]);

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
          if (t.candidate?.id) {
            const cId = t.candidate.id;
            void api<Alpha>(`/api/alpha/${encodeURIComponent(cId)}`)
              .then((detail) => {
                setSelected(detail);
                setInspectorSection("inspector");
                notify(
                  "SIMULATION COMPLETE",
                  `Alpha ${cId} audited · Sharpe ${fmt(detail.sharpe)} · Fitness ${fmt(detail.fitness)}`,
                  "Inspect in Vault →",
                  () => switchPage("vault"),
                );
              })
              .catch(() => {});
          }
        }
      } catch (e) {
        if (alive) {
          setTaskId("");
          notify("SIMULATION ERROR", String(e));
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2400);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [taskId, addActivity, refresh, notify]);

  const switchPage = useCallback((next: Page) => {
    setPage(next);
    window.history.pushState(
      {},
      "",
      next === "factory"
        ? "/studio"
        : next === "terms"
          ? "/terms"
          : next === "personal"
            ? "/personal"
            : "/",
    );
    lenisRef.current?.scrollTo(0, { immediate: true });
    mainScroll.current?.scrollTo({ top: 0 });
    setPalette(false);
    setSelectorOpen(false);
  }, []);

  const triggerVaultTransition = useCallback((callback: () => void) => {
    setVaultTransitioning(true);
    callback();
    window.setTimeout(() => {
      setVaultTransitioning(false);
    }, 220);
  }, []);

  const action = async (
    name: string,
    fn: () => Promise<unknown>,
    toastTitle: string,
    toastMessage: string,
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    if (busy) return;
    setBusy(name);
    setDoneAction("");
    try {
      await fn();
      setDoneAction(name);
      window.setTimeout(() => setDoneAction(""), 950);
      notify(toastTitle, toastMessage, actionLabel, onAction);
      addActivity(toastTitle, toastMessage);
      void refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("ACTION FAILED", msg);
    } finally {
      setBusy("");
    }
  };

  const openAlpha = useCallback(async (a: Alpha) => {
    setSelected(a);
    setInspectorSection("inspector");
    try {
      setSelected(await api<Alpha>(`/api/alpha/${encodeURIComponent(a.id)}`));
    } catch {}
  }, []);

  const submit = (a: Alpha) => {
    if (!a.is_submittable || a.submission_status === "SUBMITTED") return;
    if (
      !window.confirm(
        `Submit alpha ${a.id} to WorldQuant BRAIN? This dispatches the live portfolio submission.`,
      )
    )
      return;
    void action(
      "submit",
      () => post("/api/engine/confirm-submit", { alpha_id: a.id }),
      "SUBMITTED TO BRAIN",
      `Alpha ${a.id} (Sharpe ${fmt(a.sharpe)}, Fit ${fmt(a.fitness)}) is now active in your portfolio.`,
      "Open Personal Dashboard →",
      () => switchPage("personal"),
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
        return `${a.id} ${a.tier || ""} ${a.region || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [alphas, vaultFilter, search],
  );

  const onSimulate = (event: FormEvent) => {
    event.preventDefault();
    if (!validateExpression(expression).startsWith("Syntax")) {
      notify(
        "SYNTAX CHECK",
        "Please balance parentheses in the FastExpr editor before simulating.",
      );
      return;
    }
    if (!authenticated) {
      setLoginOpen(true);
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
      "SIMULATION DISPATCHED",
      `Running '${alphaName}' on ${region} · ${universe} · D${delay} (Decay ${decay}d).`,
      "View Live Console →",
      () => switchPage("factory"),
    );
  };

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError("");
    setBusy("login");
    try {
      await post("/api/auth/login", { email, password });
      setPassword("");
      const me = await api<{
        authenticated: boolean;
        user: { id?: string; fullName?: string; email?: string; level?: string };
      }>("/api/auth/me");
      setAuthenticated(me.authenticated);
      setUser(me.user);
      setLoginOpen(false);
      await refresh();
      notify(
        "BRAIN SESSION CONNECTED",
        `Signed in as ${me.user?.fullName || email} (${me.user?.level || "BRONZE"} LEVEL).`,
        "Open Personal Dashboard →",
        () => switchPage("personal"),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoginError(msg);
    } finally {
      setBusy("");
    }
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
      "ENGINE CONFIGURED",
      `Active synthesis engine set to ${engine.toUpperCase()}.`,
      "Open Alpha Studio →",
      () => switchPage("factory"),
    );
  };

  const generatePreview = () => {
    if (!authenticated) {
      setLoginOpen(true);
      return;
    }
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
      "BLUEPRINT SYNTHESIZED",
      `Loaded '${ARCHETYPE_OPTIONS[archetype]?.title || "Factor Blueprint"}' into Alpha Studio.`,
      "Simulate Now →",
      () => switchPage("factory"),
    );
  };

  const runBatch = () => {
    if (!authenticated) {
      setLoginOpen(true);
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
      "AUTO-MINER DISPATCHED",
      `Synthesizing and simulating '${ARCHETYPE_OPTIONS[archetype]?.title}' on WorldQuant BRAIN.`,
      "Watch Live Logs →",
      () => switchPage("factory"),
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
      "API KEY VERIFIED",
      `${cloudProvider.toUpperCase()} cloud synthesis key verified and active.`,
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
      },
      "OLLAMA CONNECTED",
      `Discovered local model '${ollamaModel}' at ${ollamaEndpoint}.`,
    );

  const checkCorrelation = (a: Alpha) => {
    setBusy("correlation");
    void api<{ passed: boolean; max_self_correlation?: number }>(
      `/api/correlation-check/${encodeURIComponent(a.id)}`,
    )
      .then((result) => {
        const message = `${a.id}: ${result.passed ? "Orthogonal (< 0.70)" : "High Correlation"} · Self-corr ${fmt(result.max_self_correlation)}`;
        notify("CORRELATION VERIFIED", message, "Clone to Studio →", () =>
          cloneToFactory(a),
        );
        addActivity("Self-correlation verified", message);
        void openAlpha(a);
      })
      .catch((error) => notify("CORRELATION ERROR", String(error)))
      .finally(() => setBusy(""));
  };

  const cloneToFactory = useCallback(
    async (a: Alpha) => {
      let expr = a.expression || "";
      if (!expr) {
        try {
          const detail = await api<Alpha>(
            `/api/alpha/${encodeURIComponent(a.id)}`,
          );
          expr = detail.expression || "";
        } catch {}
      }
      setExpression(expr || starterExpression);
      setAlphaName(`Variant_${a.id}`);
      switchPage("factory");
      notify(
        "CLONED TO STUDIO",
        `Loaded ${a.id} (${a.tier || "EVALUATED"} · Sharpe ${fmt(a.sharpe)}) into FastExpr editor.`,
      );
    },
    [notify, switchPage],
  );

  const importCandidate = async (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      notify("FILE LIMIT", "Candidate file exceeds 1 MB.");
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
      notify(
        "CANDIDATE IMPORTED",
        `Loaded formula from '${file.name}' into Alpha Studio.`,
      );
    } catch (error) {
      notify(
        "IMPORT FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const compare = () => {
    if (compareIds.length < 2) return;
    void api<{ alphas: Alpha[] }>(
      `/api/compare?ids=${encodeURIComponent(compareIds.join(","))}`,
    )
      .then((x) => setComparison(x.alphas))
      .catch((e) => notify("COMPARE ERROR", String(e)));
  };

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const q = paletteQuery.trim().toLowerCase();
    const list: PaletteItem[] = [];

    for (const nav of NAV_ITEMS) {
      const text = `${nav.index} ${nav.label} ${nav.hint}`.toLowerCase();
      if (!q || text.includes(q)) {
        list.push({
          id: `page-${nav.page}`,
          category: "WORKSPACE PAGES",
          title: `${nav.index} · ${nav.label}`,
          subtitle: nav.hint,
          badge: page === nav.page ? "ACTIVE" : "PAGE",
          primaryLabel: "Open Page",
          copyText: nav.label,
          onPrimary: () => switchPage(nav.page),
        });
      }
    }

    if (!authenticated) {
      list.push({
        id: "cmd-signin",
        category: "QUICK COMMANDS",
        title: "Sign In to WorldQuant BRAIN",
        subtitle: "Authenticate your session to unlock studio, vault, and dashboard",
        badge: "AUTH",
        primaryLabel: "Sign In",
        copyText: "https://platform.worldquantbrain.com",
        onPrimary: () => setLoginOpen(true),
      });
      return list;
    }

    const commands: PaletteItem[] = [
      {
        id: "cmd-automine",
        category: "QUICK COMMANDS",
        title: "Auto-Mine 1 Alpha Candidate Now",
        subtitle: `Dispatch autonomous simulation on ${region} · ${universe} · D${delay}`,
        badge: "CLOUD MINER",
        primaryLabel: "Run Auto-Miner",
        copyText: expression,
        onPrimary: runBatch,
      },
      {
        id: "cmd-sync",
        category: "QUICK COMMANDS",
        title: "Sync Portfolio with WorldQuant BRAIN",
        subtitle: "Pull active & unsubmitted alphas from api.worldquantbrain.com",
        badge: "SYNC",
        primaryLabel: "Sync Now",
        copyText: "https://platform.worldquantbrain.com",
        onPrimary: () =>
          void action(
            "sync",
            () => post("/api/sync-cloud"),
            "PORTFOLIO SYNCED",
            "Pulled latest active and unsubmitted alphas from WorldQuant BRAIN.",
            "View Alpha Vault →",
            () => switchPage("vault"),
          ),
      },
      {
        id: "cmd-platform",
        category: "QUICK COMMANDS",
        title: "Open Official WorldQuant BRAIN Platform",
        subtitle: "Launch platform.worldquantbrain.com in a new browser tab",
        badge: "EXTERNAL",
        primaryLabel: "Open BRAIN Website",
        copyText: "https://platform.worldquantbrain.com",
        onPrimary: () =>
          window.open(
            "https://platform.worldquantbrain.com",
            "_blank",
            "noopener,noreferrer",
          ),
      },
    ];
    for (const cmd of commands) {
      if (!q || `${cmd.title} ${cmd.subtitle}`.toLowerCase().includes(q)) {
        list.push(cmd);
      }
    }

    ARCHETYPE_OPTIONS.forEach((arch, idx) => {
      if (!q || `${arch.title} ${arch.meta}`.toLowerCase().includes(q)) {
        list.push({
          id: `arch-${idx}`,
          category: "FACTOR BLUEPRINTS",
          title: arch.title,
          subtitle: arch.meta,
          badge: `BLUEPRINT 0${idx + 1}`,
          primaryLabel: "Open in Studio",
          copyText: arch.title,
          onPrimary: () => {
            setArchetype(idx);
            switchPage("factory");
          },
        });
      }
    });

    const matchingAlphas = alphas
      .filter(
        (a) =>
          !q ||
          `${a.id} ${a.tier || ""} ${statusOf(a)}`.toLowerCase().includes(q),
      )
      .slice(0, q ? 12 : 6);

    for (const a of matchingAlphas) {
      list.push({
        id: `alpha-${a.id}`,
        category: "AUDITED ALPHAS",
        title: `Alpha ${a.id}`,
        subtitle: `${a.tier || "EVALUATED"} · ${a.region || "USA"} · ${a.universe || "TOP3000"}`,
        badge: statusOf(a),
        rightMeta: `SR ${fmt(a.sharpe)} · Fit ${fmt(a.fitness)}`,
        primaryLabel: "Inspect Alpha",
        copyText: a.id,
        studioExpr: a.expression,
        studioName: `Variant_${a.id}`,
        onPrimary: () => {
          void openAlpha(a);
          switchPage("vault");
        },
      });
    }

    for (const f of paletteFields) {
      if (
        !q ||
        `${f.id} ${f.description || ""} ${f.dataset_id || ""}`
          .toLowerCase()
          .includes(q)
      ) {
        list.push({
          id: `field-${f.id}`,
          category: "BRAIN DATA FIELDS",
          title: f.id,
          subtitle: f.description || `Dataset: ${f.dataset_id || "EQUITY"}`,
          badge: f.dataset_id || "FIELD",
          rightMeta: f.type || "MATRIX",
          primaryLabel: "Insert into Studio",
          copyText: f.id,
          studioExpr: `${expression}\n${f.id}`,
          onPrimary: () => {
            setExpression((prev) => `${prev}\n${f.id}`);
            switchPage("factory");
            notify(
              "DATA FIELD INSERTED",
              `Appended '${f.id}' (${f.dataset_id || "EQUITY"}) into FastExpr editor.`,
            );
          },
        });
      }
    }

    for (const op of OPERATOR_GUIDES) {
      if (!q || `${op.label} ${op.guide}`.toLowerCase().includes(q)) {
        list.push({
          id: `op-${op.snippet}`,
          category: "FASTEXPR OPERATORS",
          title: op.label,
          subtitle: op.guide,
          badge: "OPERATOR",
          primaryLabel: "Insert Operator",
          copyText: op.snippet,
          studioExpr: `${expression}${op.snippet}`,
          onPrimary: () => {
            setExpression((prev) => `${prev}${op.snippet}`);
            switchPage("factory");
            notify(
              "OPERATOR INSERTED",
              `Appended '${op.label}' to FastExpr editor.`,
            );
          },
        });
      }
    }

    return list;
  }, [
    paletteQuery,
    page,
    region,
    universe,
    delay,
    expression,
    authenticated,
    alphas,
    paletteFields,
    switchPage,
    openAlpha,
    notify,
  ]);

  const pageMeta = {
    overview: {
      title: "Command Overview",
      subtitle:
        "Executive portfolio showcase, factor synthesis, and live qualification telemetry.",
    },
    factory: {
      title: "Alpha Studio & Simulation Workbench",
      subtitle:
        "Configure backtest parameters on the left and compose FastExpr formulas on the right.",
    },
    vault: {
      title: "Alpha Vault & Portfolio Registry",
      subtitle:
        "Browse audited candidates with Sharpe, Fitness, Turnover, and Self-Correlation.",
    },
    catalog: {
      title: "WorldQuant Data Catalog",
      subtitle:
        "Search 4,367 institutional equity fields across 14 datasets and insert into your formula.",
    },
    settings: {
      title: "Engine & Session Settings",
      subtitle:
        "Configure Algorithmic, Google Gemini, or Local Ollama engines and manage BRAIN credentials.",
    },
    terms: {
      title: "Research Protocol",
      subtitle:
        "Operational governance, local compute sovereignty, and open-source contributors.",
    },
    personal: {
      title: "Personal Dashboard",
      subtitle:
        "WorldQuant BRAIN level, verified achievements, quality pyramid, and active portfolio.",
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
        name: "HIGH_TURNOVER (≤ 70%)",
        result: (selected.turnover_pct || 0) <= 70 ? "PASS" : "FAIL",
      },
      {
        name: "LOW_TURNOVER (≥ 1%)",
        result: (selected.turnover_pct || 0) >= 1 ? "PASS" : "FAIL",
      },
      {
        name: "SELF_CORRELATION (< 0.70)",
        result:
          selected.max_self_correlation === undefined ||
          selected.max_self_correlation === null ||
          selected.max_self_correlation < 0.7
            ? "PASS"
            : "FAIL",
      },
      {
        name: "CONCENTRATED_WEIGHT",
        result: "PASS",
      },
      {
        name: "SUB_UNIVERSE_SHARPE",
        result: (selected.sharpe || 0) >= 1.25 ? "PASS" : "WARN",
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

  const decayPct = Math.round((decay / 60) * 100);
  const truncPct = Math.round(((truncation - 0.01) / 0.14) * 100);

  return (
    <div className="app-shell">
      {/* PREMIUM SPLASH SCREEN WITH HERO SKY/HORIZON ANIMATION (Fixes Screenshot 8) */}
      {splashVisible && (
        <div
          className={`boot-splash ${splashFade ? "fade-out" : ""}`}
          onClick={() => setSplashVisible(false)}
        >
          <AsciiCanvas
            className="boot-ascii-bg"
            colors={["#0A1410", "#133829", "#1F5C43", "#C5A875", "#F2EFE9"]}
            shape="horizon"
            characters=" .=+xX0S8#@"
            cellSize={18}
            density={0.78}
            glyphOpacity={0.72}
            gradientOpacity={0.88}
            glow={0}
            flow={0.65}
            speed={0.95}
          />
          <div className="boot-splash-inner">
            <AlphaLogo size={64} />
            <span className="boot-kicker">
              WORLDQUANT BRAIN · QUANTITATIVE RESEARCH STUDIO
            </span>
            <div className="boot-wordmark">
              <TechWordmark
                text="WORLDQUANT  ALPHA"
                fontFamily="Space Grotesk"
                fontWeight={700}
                fontSize={56}
                letterSpacing={0.055}
                align="center"
                color="#F2EFE9"
                accentColor="#C5A875"
                reveal="letter"
                dashLength={4}
                dashGap={2}
                specks={8}
                selection={false}
                labels={false}
                draggable={false}
                bounce={0.25}
                sweep
                intro="metrics"
                introDuration={0.75}
                guides={false}
              />
            </div>
            <div className="boot-bar">
              <i />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-RIGHT THEME-MATCHED BOTANICAL & CHAMPAGNE GOLD TOAST */}
      {toast && (
        <aside className="bottom-right-toast" role="status" aria-live="polite">
          <div className="toast-copy">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="toast-next-action"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                <span>{toast.actionLabel}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </aside>
      )}

      {/* ZERO-LAG TARGET CURSOR */}
      <Cursor
        hoverDuration={0.11}
        hideDefaultCursor
        parallaxOn
        size={22}
        cornerSize={8}
        thickness={2}
        padding={4}
        matchRadius
        dotSize={4}
        clickEffect
      />

      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>

      {/* LEFT NAVIGATION DOCK (01-07) */}
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
          <span>01–07</span>
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
              authenticated ? switchPage("personal") : setLoginOpen(true)
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
                ? `${user?.fullName || "Authenticated"} · ${user?.level || "BRONZE"}`
                : "Sign in to continue"}
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
            <span>Search pages, commands, or fields…</span>
            <kbd>⌘K</kbd>
          </button>

          <div className="utility-actions">
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
                    onClick={() => {
                      setSelectorOpen(false);
                      notify(
                        "SCOPE UPDATED",
                        `Backtest scope locked to ${region} · ${universe} · D${delay}.`,
                      );
                    }}
                  >
                    Apply Scope ({region} · {universe} · D{delay})
                  </button>
                </div>
              )}
            </div>

            <ButtonBase
              className="sync-button"
              busy={busy === "sync"}
              busyLabel="Syncing…"
              done={doneAction === "sync"}
              onClick={() =>
                authenticated
                  ? void action(
                      "sync",
                      () => post("/api/sync-cloud"),
                      "PORTFOLIO SYNCED",
                      "Synced active & unsubmitted alphas from WorldQuant BRAIN.",
                      "Open Alpha Vault →",
                      () => switchPage("vault"),
                    )
                  : setLoginOpen(true)
              }
            >
              <RefreshCw size={14} />
              <span>Sync Portfolio</span>
            </ButtonBase>

            <button
              className={`account-pill ${authenticated ? "is-connected" : ""}`}
              onClick={() =>
                authenticated ? switchPage("personal") : setLoginOpen(true)
              }
            >
              {authenticated ? (
                <UserCheck size={14} />
              ) : (
                <LockKeyhole size={14} />
              )}
              <span>
                {authenticated ? user?.fullName || "Signed In" : "Sign In"}
              </span>
            </button>
          </div>
        </header>

        <div className="content-grid">
          {/* SMOOTH LENIS SCROLLABLE WORKSPACE */}
          <div className="workspace-panel glass">
            <main id="workspace" className="workspace" ref={mainScroll}>
              <div
                ref={mainContent}
                className={`workspace-inner ${page === "catalog" ? "catalog-mode" : ""}`}
              >
                {/* ========================================================= */}
                {/* PAGE 01: COMMAND OVERVIEW                                 */}
                {/* ========================================================= */}
                {page === "overview" && (
                  <div className="page-stack page-enter">
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

                        <div className="hero-wordmark no-cursor-lock">
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
                            sweep
                            intro="metrics"
                            introDuration={1.1}
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
                                STEP 01 · AUTHENTICATION REQUIRED
                              </span>
                              <h3>Connect Your WorldQuant BRAIN Account</h3>
                              <p>
                                Sign in with your WorldQuant BRAIN credentials
                                to unlock your portfolio dashboard, alpha vault,
                                and cloud simulations.
                              </p>
                            </div>
                            <div className="auth-banner-actions">
                              <button
                                type="button"
                                className="guide-btn primary"
                                onClick={() => setLoginOpen(true)}
                              >
                                <LockKeyhole size={15} />
                                <span>Sign In to WorldQuant BRAIN</span>
                                <ArrowRight size={15} />
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
                                type="button"
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
                                type="button"
                                className="guide-btn primary"
                                onClick={runBatch}
                                disabled={!!taskId || busy === "batch"}
                              >
                                <span>
                                  {taskId || busy === "batch"
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

                    {!authenticated ? (
                      <AuthGateCard
                        title="Sign in to Continue"
                        description="Your personal portfolio metrics, audited alpha registry, and simulation telemetry are private and locked until you sign in."
                        buttonLabel="Sign In to View Dashboard"
                        onSignIn={() => setLoginOpen(true)}
                      />
                    ) : (
                      <>
                        {/* SINGLE-LINE CONCENTRIC KPI METRIC CARDS */}
                        <div className="metrics-grid">
                          <MetricCard
                            label="TOTAL ALPHAS"
                            value=""
                            numeric={stats.total || alphas.length}
                            sub="Local Archive"
                            guide="Click to browse audited alphas in Vault"
                            tone="emerald"
                            onClick={() => {
                              setVaultFilter("all");
                              switchPage("vault");
                            }}
                          />
                          <MetricCard
                            label="HURDLE PASSED"
                            value=""
                            numeric={hurdlePassedCount}
                            sub="Sharpe ≥ 1.25"
                            guide="Passed Sharpe ≥ 1.25 & Fitness ≥ 1.00"
                            tone="gold"
                            onClick={() => {
                              setVaultFilter("hurdles");
                              switchPage("vault");
                            }}
                          />
                          <MetricCard
                            label="PEAK FITNESS"
                            value=""
                            numeric={stats.leader_fitness || 0}
                            decimals={2}
                            sub={
                              stats.leader_id
                                ? `Top · ${stats.leader_id}`
                                : "Top Signal"
                            }
                            guide="Highest audited fitness score in vault"
                            tone="ink"
                            onClick={() => {
                              const leader = alphas.find(
                                (x) => x.id === stats.leader_id,
                              );
                              if (leader) void openAlpha(leader);
                            }}
                          />
                          <MetricCard
                            label="ACTIVE ON BRAIN"
                            value=""
                            numeric={stats.active || 0}
                            sub="Live Portfolio"
                            guide="Submitted alphas in WorldQuant portfolio"
                            tone="amber"
                            onClick={() => switchPage("personal")}
                          />
                        </div>

                        <div className="overview-middle">
                          <section className="chart-card glass-soft">
                            <div className="section-head">
                              <div>
                                <span className="eyebrow">
                                  PORTFOLIO SIGNAL FRONTIER
                                </span>
                                <h2>Top Audited Alpha Candidates</h2>
                                <p className="section-sub">
                                  Direct fitness &amp; Sharpe comparison of your
                                  top evaluated factors. Click any signal to
                                  inspect its check matrix.
                                </p>
                              </div>
                              <ButtonBase
                                className="small"
                                onClick={() => switchPage("vault")}
                              >
                                <span>View All ({alphas.length})</span>
                                <ArrowRight size={13} />
                              </ButtonBase>
                            </div>

                            <SignalFrontierChart
                              alphas={alphas}
                              selectedId={selected?.id}
                              onSelect={openAlpha}
                            />
                          </section>

                          <section className="archetype-showcase-card glass-soft">
                            <span className="eyebrow">FACTOR BLUEPRINTS</span>
                            <h2>5 Proven Alpha Archetypes</h2>
                            <p className="section-sub">
                              Select an institutional factor blueprint to
                              synthesize and customize in Alpha Studio.
                            </p>

                            <div className="archetype-list">
                              {ARCHETYPE_OPTIONS.slice(0, 4).map(
                                (item, idx) => (
                                  <button
                                    key={item.title}
                                    type="button"
                                    className={`archetype-item ${archetype === idx ? "active" : ""}`}
                                    onClick={() => setArchetype(idx)}
                                  >
                                    <span className="arch-idx">
                                      0{idx + 1}
                                    </span>
                                    <div className="arch-copy">
                                      <strong>{item.title}</strong>
                                      <small>{item.meta}</small>
                                    </div>
                                  </button>
                                ),
                              )}
                            </div>

                            <div className="pipeline-actions">
                              <ButtonBase
                                className="primary full"
                                busy={busy === "preview"}
                                busyLabel="Synthesizing Blueprint…"
                                done={doneAction === "preview"}
                                onClick={generatePreview}
                              >
                                <FlaskConical size={15} />
                                <span>Load Selected Blueprint</span>
                                <ArrowRight size={14} />
                              </ButtonBase>
                            </div>
                          </section>
                        </div>

                        <AlphaTable
                          rows={alphas.slice(0, 7)}
                          selectedId={selected?.id}
                          onSelect={openAlpha}
                          onClone={cloneToFactory}
                          onSubmit={submit}
                          search={search}
                          setSearch={setSearch}
                          title="Recent Alpha Candidates"
                          subtitle="Click any candidate row to inspect its telemetry, self-correlation, and platform checks on the right."
                          empty="No evaluated alphas yet. Click 'Load Selected Blueprint' to begin."
                        />
                      </>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* PAGE 02: ALPHA STUDIO                                     */}
                {/* ========================================================= */}
                {page === "factory" &&
                  (!authenticated ? (
                    <AuthGateCard
                      title="Sign in to Continue"
                      description="Connect your WorldQuant BRAIN account to synthesize formulas, configure backtests, and dispatch simulations."
                      buttonLabel="Sign In to Open Alpha Studio"
                      onSignIn={() => setLoginOpen(true)}
                    />
                  ) : (
                    <div className="page-stack studio-stack page-enter">
                      <section className="generator-bar glass-soft">
                        <div className="generator-bar-head">
                          <div>
                            <span className="eyebrow">
                              STEP 01 · FORMULA SYNTHESIS
                            </span>
                            <h2>Generate or Load a Factor Blueprint</h2>
                          </div>
                        </div>

                        <div className="generator-controls">
                          <label>
                            Synthesis Engine
                            <CustomSelect
                              value={engine}
                              onChange={setEngine}
                              options={[
                                {
                                  value: "algorithmic",
                                  label: "Algorithmic Grammar Tree",
                                  sub: "Deterministic multi-factor AST",
                                },
                                {
                                  value: "cloud_ai",
                                  label: "Cloud AI (Gemini 2.0 Flash)",
                                  sub: "LLM-guided alpha synthesis",
                                },
                                {
                                  value: "ollama",
                                  label: "Local Ollama (DeepSeek R1)",
                                  sub: "100% private local inference",
                                },
                              ]}
                            />
                          </label>

                          {engine === "algorithmic" ? (
                            <label>
                              Quantitative Factor Blueprint
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

                          <ButtonBase
                            className="primary generate-cta"
                            busy={busy === "preview"}
                            busyLabel="Synthesizing…"
                            done={doneAction === "preview"}
                            onClick={generatePreview}
                          >
                            <Wand2 size={15} />
                            <span>Load Formula into Studio</span>
                          </ButtonBase>
                        </div>
                      </section>

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

                            {/* CLEAN PRECISION RANGE SLIDERS WITH STEADY READOUT (Fixes Screenshot 1) */}
                            <div className="form-dual">
                              <label className="range-field-label">
                                <span className="range-label-row">
                                  <span>Linear Decay</span>
                                  <b className="range-readout mono">
                                    {decay} DAYS
                                  </b>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range no-cursor-lock"
                                  min="0"
                                  max="60"
                                  step="1"
                                  value={decay}
                                  style={
                                    {
                                      "--range-pct": `${decayPct}%`,
                                    } as React.CSSProperties
                                  }
                                  onChange={(e) =>
                                    setDecay(Number(e.target.value))
                                  }
                                />
                              </label>

                              <label className="range-field-label">
                                <span className="range-label-row">
                                  <span>Weight Truncation</span>
                                  <b className="range-readout mono">
                                    {truncation.toFixed(2)}
                                  </b>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range no-cursor-lock"
                                  min="0.01"
                                  max="0.15"
                                  step="0.01"
                                  value={truncation}
                                  style={
                                    {
                                      "--range-pct": `${truncPct}%`,
                                    } as React.CSSProperties
                                  }
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
                                    sub: "Recommended for WorldQuant BRAIN",
                                  },
                                  {
                                    value: "OFF",
                                    label: "OFF · Raw Unfiltered Signal",
                                    sub: "Disable outlier clipping",
                                  },
                                ]}
                              />
                            </label>

                            <div className="factory-cta-stack">
                              <ButtonBase
                                type="submit"
                                className="primary full"
                                busy={busy === "simulate" || !!taskId}
                                busyLabel="Simulating on BRAIN…"
                                done={doneAction === "simulate"}
                              >
                                <Play size={15} />
                                <span>Simulate &amp; Audit Formula</span>
                              </ButtonBase>

                              <ButtonBase
                                type="button"
                                className="full"
                                busy={busy === "batch"}
                                busyLabel="Auto-Mining…"
                                done={doneAction === "batch"}
                                onClick={runBatch}
                                disabled={!!taskId}
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
                              className="selectable-code no-cursor-lock"
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
                              <strong>
                                {fmt(task.candidate.turnover_pct)}%
                              </strong>
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
                    </div>
                  ))}

                {/* ========================================================= */}
                {/* PAGE 03: ALPHA VAULT (NO CODE LEAK ON CARDS, COMPACT ROWS)*/}
                {/* ========================================================= */}
                {page === "vault" &&
                  (!authenticated ? (
                    <AuthGateCard
                      title="Sign in to Continue"
                      description="Your audited alpha vault and portfolio submissions are private. Sign in with your WorldQuant BRAIN account to view your registry."
                      buttonLabel="Sign In to View Alpha Vault"
                      onSignIn={() => setLoginOpen(true)}
                    />
                  ) : (
                    <div className="page-stack page-enter">
                      <div className="vault-summary four-col">
                        <MetricCard
                          label="TOTAL AUDITED"
                          value=""
                          numeric={stats.total || alphas.length}
                          sub="100% Checked"
                          guide="All synced & simulated alphas in local DB"
                          tone="emerald"
                          onClick={() =>
                            triggerVaultTransition(() => setVaultFilter("all"))
                          }
                        />
                        <MetricCard
                          label="HURDLES PASSED"
                          value=""
                          numeric={hurdlePassedCount}
                          sub="Fit ≥ 1.00"
                          guide="Passed core WorldQuant return & fitness hurdles"
                          tone="gold"
                          onClick={() =>
                            triggerVaultTransition(() =>
                              setVaultFilter("hurdles"),
                            )
                          }
                        />
                        <MetricCard
                          label="ORTHOGONAL"
                          value=""
                          numeric={stats.submittable || 0}
                          sub="Corr < 0.70"
                          guide="Passed both metric hurdles & < 0.70 correlation"
                          tone="ink"
                          onClick={() =>
                            triggerVaultTransition(() =>
                              setVaultFilter("submittable"),
                            )
                          }
                        />
                        <MetricCard
                          label="SUBMITTED"
                          value=""
                          numeric={stats.active || 0}
                          sub="Live Portfolio"
                          guide="Active alphas running in your BRAIN portfolio"
                          tone="amber"
                          onClick={() =>
                            triggerVaultTransition(() =>
                              setVaultFilter("submitted"),
                            )
                          }
                        />
                      </div>

                      <div className="vault-controls-card glass-soft">
                        <div className="vault-controls">
                          <div className="concentric-segmented">
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
                                type="button"
                                className={vaultFilter === key ? "selected" : ""}
                                onClick={() =>
                                  triggerVaultTransition(() =>
                                    setVaultFilter(key),
                                  )
                                }
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          <div className="vault-controls-right">
                            <div className="concentric-segmented">
                              <button
                                type="button"
                                className={
                                  vaultView === "table" ? "selected" : ""
                                }
                                onClick={() =>
                                  triggerVaultTransition(() =>
                                    setVaultView("table"),
                                  )
                                }
                              >
                                Table View
                              </button>
                              <button
                                type="button"
                                className={
                                  vaultView === "bento" ? "selected" : ""
                                }
                                onClick={() =>
                                  triggerVaultTransition(() =>
                                    setVaultView("bento"),
                                  )
                                }
                              >
                                Card Grid
                              </button>
                            </div>

                            <ButtonBase
                              onClick={compare}
                              disabled={compareIds.length < 2}
                            >
                              Compare{" "}
                              {compareIds.length
                                ? `(${compareIds.length})`
                                : ""}
                            </ButtonBase>

                            <a
                              className="button export"
                              href="/api/export-csv"
                              download
                            >
                              <ArrowDownToLine size={15} /> Export CSV
                            </a>
                          </div>
                        </div>

                        <div
                          className={`vault-transition-bar ${vaultTransitioning ? "is-active" : ""}`}
                        />
                      </div>

                      {vaultView === "bento" ? (
                        /* CLEAN METRIC-ONLY CARDS (Zero Code Leaked, Zero Circle Dots!) */
                        <div
                          className={`vault-card-grid ${vaultTransitioning ? "is-transitioning" : ""}`}
                        >
                          {filtered.map((alpha, idx) => {
                            const corr = alpha.max_self_correlation;
                            const turnover =
                              alpha.turnover_pct ?? (alpha.turnover || 0) * 100;
                            return (
                              <article
                                key={alpha.id}
                                className={`vault-concentric-card ${selected?.id === alpha.id ? "is-selected" : ""}`}
                                style={
                                  {
                                    "--stagger-idx": Math.min(idx, 18),
                                  } as React.CSSProperties
                                }
                                onClick={() => void openAlpha(alpha)}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void openAlpha(alpha);
                                }}
                              >
                                <div className="vault-card-top">
                                  <div className="vault-card-id-group">
                                    <strong className="mono">{alpha.id}</strong>
                                    <span
                                      className={`quality-pill ${tierClass(alpha.tier)}`}
                                    >
                                      {alpha.tier || "EVALUATED"}
                                    </span>
                                  </div>
                                  <span
                                    className={`status-chip ${outcomeClass(alpha)}`}
                                  >
                                    {statusOf(alpha)}
                                  </span>
                                </div>

                                <div className="vault-card-divider" />

                                <div className="vault-card-receipt">
                                  <div className="receipt-cell">
                                    <small>SHARPE</small>
                                    <strong className="mono">
                                      {fmt(alpha.sharpe)}
                                    </strong>
                                  </div>
                                  <div className="receipt-cell">
                                    <small>FITNESS</small>
                                    <strong className="mono">
                                      {fmt(alpha.fitness)}
                                    </strong>
                                  </div>
                                  <div className="receipt-cell">
                                    <small>TURNOVER</small>
                                    <strong className="mono">
                                      {fmt(turnover, 1)}%
                                    </strong>
                                  </div>
                                  <div className="receipt-cell">
                                    <small>SELF-CORR</small>
                                    <strong
                                      className={`mono corr-val ${corrColorClass(corr)}`}
                                    >
                                      {corr !== undefined && corr !== null
                                        ? fmt(corr)
                                        : "—"}
                                    </strong>
                                  </div>
                                </div>

                                <div className="personal-card-actions">
                                  <button
                                    type="button"
                                    className="table-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void cloneToFactory(alpha);
                                    }}
                                  >
                                    <FlaskConical size={12} />
                                    <span>Clone into Studio</span>
                                  </button>
                                  <span className="personal-scope-note mono">
                                    {alpha.region || "USA"} ·{" "}
                                    {alpha.universe || "TOP3000"} · D
                                    {alpha.delay ?? 1}
                                  </span>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          className={
                            vaultTransitioning ? "vault-fade-transition" : ""
                          }
                        >
                          <AlphaTable
                            rows={filtered}
                            selectedId={selected?.id}
                            onSelect={openAlpha}
                            onClone={cloneToFactory}
                            onSubmit={submit}
                            search={search}
                            setSearch={setSearch}
                            title={`Audited Alpha Registry (${filtered.length} Signals)`}
                            subtitle="Compact 40px rows, right-aligned tabular figures, and zero formula leaks. Click Clone to open code in Studio."
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
                        </div>
                      )}
                    </div>
                  ))}

                {/* ========================================================= */}
                {/* PAGE 04: DATA CATALOG                                     */}
                {/* ========================================================= */}
                {page === "catalog" &&
                  (!authenticated ? (
                    <AuthGateCard
                      title="Sign in to Continue"
                      description="Sign in with your WorldQuant BRAIN credentials to browse and insert from the 4,367 equity data fields catalog."
                      buttonLabel="Sign In to View Data Catalog"
                      onSignIn={() => setLoginOpen(true)}
                    />
                  ) : (
                    <section className="catalog-card glass-soft full-viewport-catalog page-enter">
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

                      <div className="table-wrap catalog-table-wrap density-compact">
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
                                <td className="col-field-id alpha-cell">
                                  {f.id}
                                </td>
                                <td
                                  className="col-field-desc"
                                  title={f.description}
                                >
                                  {f.description ||
                                    "Institutional equity metric"}
                                </td>
                                <td className="col-field-ds">
                                  <span className="dataset-tag">
                                    {f.dataset_id}
                                  </span>
                                </td>
                                <td className="col-field-type mono">
                                  {f.type}
                                </td>
                                <td className="col-field-action">
                                  <button
                                    className="table-action-btn"
                                    onClick={() => {
                                      setExpression((x) => `${x}\n${f.id}`);
                                      switchPage("factory");
                                      notify(
                                        "DATA FIELD INSERTED",
                                        `Inserted '${f.id}' (${f.dataset_id}) into Alpha Studio.`,
                                      );
                                    }}
                                  >
                                    <span>Insert</span>
                                    <ArrowRight size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!fields.length && (
                          <div className="table-empty">
                            <Database size={20} />
                            <span>No data fields match your query.</span>
                          </div>
                        )}
                      </div>

                      <div className="pagination">
                        <span className="pagination-info">
                          SHOWING {(fieldPage - 1) * CATALOG_PAGE_SIZE + 1}–
                          {Math.min(fieldPage * CATALOG_PAGE_SIZE, fieldTotal)}{" "}
                          OF {NUMBER.format(fieldTotal)}
                        </span>
                        <div className="pagination-buttons">
                          <ButtonBase
                            className="small"
                            disabled={fieldPage <= 1}
                            onClick={() =>
                              setFieldPage((p) => Math.max(1, p - 1))
                            }
                          >
                            Previous
                          </ButtonBase>
                          <span>
                            PAGE {fieldPage} /{" "}
                            {Math.max(
                              1,
                              Math.ceil(fieldTotal / CATALOG_PAGE_SIZE),
                            )}
                          </span>
                          <ButtonBase
                            className="small"
                            disabled={
                              fieldPage * CATALOG_PAGE_SIZE >= fieldTotal
                            }
                            onClick={() => setFieldPage((p) => p + 1)}
                          >
                            Next
                          </ButtonBase>
                        </div>
                      </div>
                    </section>
                  ))}

                {/* ========================================================= */}
                {/* PAGE 05: ENGINE & SESSION SETTINGS                        */}
                {/* ========================================================= */}
                {page === "settings" &&
                  (!authenticated ? (
                    <AuthGateCard
                      title="Sign in to Continue"
                      description="Sign in with your WorldQuant BRAIN account to configure synthesis engines and manage your active session."
                      buttonLabel="Sign In to Configure Engine & Session"
                      onSignIn={() => setLoginOpen(true)}
                    />
                  ) : (
                    <div className="settings-grid page-enter">
                      <section className="glass-soft settings-card">
                        <span className="eyebrow">01 · SYNTHESIS ENGINE</span>
                        <h2>AI &amp; Algorithmic Configuration</h2>
                        <p className="section-sub">
                          Choose how candidate FastExpr expressions are
                          generated. Keys remain in your local session.
                        </p>
                        <form onSubmit={onSettings}>
                          <label>
                            Discovery Engine Mode
                            <CustomSelect
                              value={engine}
                              onChange={setEngine}
                              options={[
                                {
                                  value: "algorithmic",
                                  label: "Algorithmic Grammar Tree",
                                  sub: "Deterministic multi-factor AST",
                                },
                                {
                                  value: "cloud_ai",
                                  label: "Cloud AI (Gemini / OpenAI)",
                                  sub: "LLM-driven factor generation",
                                },
                                {
                                  value: "ollama",
                                  label: "Local Ollama (DeepSeek R1)",
                                  sub: "Local private model inference",
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
                                      label: "Google Gemini 2.0 Flash",
                                      sub: "Fast quantitative reasoning",
                                    },
                                    {
                                      value: "openai",
                                      label: "OpenAI GPT-4o",
                                      sub: "Structured factor synthesis",
                                    },
                                  ]}
                                />
                              </label>
                              <label>
                                Provider API Key
                                <input
                                  type="password"
                                  placeholder="AIza… or sk-…"
                                  value={cloudKey}
                                  onChange={(e) => setCloudKey(e.target.value)}
                                />
                              </label>
                              <ButtonBase
                                onClick={validateKey}
                                busy={busy === "key"}
                                busyLabel="Validating Key…"
                                done={doneAction === "key"}
                              >
                                <ShieldCheck size={15} /> Validate Cloud Key
                              </ButtonBase>
                            </>
                          )}
                          {engine === "ollama" && (
                            <>
                              <label>
                                Ollama Endpoint
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
                                  onChange={(e) =>
                                    setOllamaModel(e.target.value)
                                  }
                                />
                              </label>
                              <ButtonBase
                                onClick={discoverModels}
                                busy={busy === "models"}
                                busyLabel="Scanning Ollama…"
                                done={doneAction === "models"}
                              >
                                <Cpu size={15} /> Discover Local Models
                              </ButtonBase>
                            </>
                          )}
                          <ButtonBase
                            type="submit"
                            className="primary full"
                            busy={busy === "engine"}
                            busyLabel="Saving Engine…"
                            done={doneAction === "engine"}
                          >
                            <Check size={15} /> Save Engine Settings
                          </ButtonBase>
                        </form>
                        <div className="settings-status">
                          <Cpu size={17} />
                          <span>
                            Active Engine:{" "}
                            <b>
                              {String(summary.engine || engine).toUpperCase()}
                            </b>
                          </span>
                        </div>
                      </section>

                      <section className="glass-soft settings-card">
                        <span className="eyebrow">02 · WORLDQUANT BRAIN</span>
                        <h2>Connected Session</h2>
                        <p className="section-sub">
                          Authenticated against `api.worldquantbrain.com`.
                        </p>
                        <div className="connected-user">
                          <AlphaLogo size={40} />
                          <div>
                            <strong>
                              {user?.fullName || "Authenticated User"}
                            </strong>
                            <small>
                              {user?.level || "BRONZE"} LEVEL · SESSION ACTIVE
                            </small>
                          </div>
                        </div>
                        <ButtonBase
                          className="full"
                          busy={busy === "logout"}
                          busyLabel="Signing Out…"
                          onClick={() =>
                            void action(
                              "logout",
                              async () => {
                                await post("/api/auth/logout");
                                setAuthenticated(false);
                                setUser(null);
                                setAlphas([]);
                                setStats({});
                                setSelected(null);
                                setShowcase(null);
                              },
                              "SESSION SIGNED OUT",
                              "Disconnected from WorldQuant BRAIN.",
                            )
                          }
                        >
                          <LogOut size={15} /> Sign Out of Session
                        </ButtonBase>
                        <div className="settings-status">
                          <Radar size={17} />
                          <span>
                            Background Correlation Auditor:{" "}
                            <b>{worker.is_running ? "RUNNING" : "STANDBY"}</b>
                          </span>
                        </div>
                        <ButtonBase
                          className="full"
                          busy={busy === "audit"}
                          busyLabel="Starting Auditor…"
                          done={doneAction === "audit"}
                          onClick={() =>
                            void action(
                              "audit",
                              () => post("/api/correlation-worker/start"),
                              "CORRELATION AUDITOR ACTIVE",
                              "Background self-correlation worker is auditing unsubmitted candidates.",
                            )
                          }
                        >
                          <RefreshCw size={15} /> Run Portfolio Correlation
                          Audit
                        </ButtonBase>
                      </section>
                    </div>
                  ))}

                {/* ========================================================= */}
                {/* PAGE 06: RESEARCH PROTOCOL + ASHWIN & AKSHAT PROFILES     */}
                {/* ========================================================= */}
                {page === "terms" && (
                  <div className="page-enter">
                    <TermsPanel />
                  </div>
                )}

                {/* ========================================================= */}
                {/* PAGE 07: PERSONAL DASHBOARD (LOCKED WHEN SIGNED OUT!)     */}
                {/* ========================================================= */}
                {page === "personal" &&
                  (!authenticated ? (
                    <AuthGateCard
                      title="Sign in to View the Dashboard"
                      description="Your personal WorldQuant BRAIN level, audited alpha count, and submitted portfolio are private. Sign in to view your dashboard."
                      buttonLabel="Sign In to View the Dashboard"
                      onSignIn={() => setLoginOpen(true)}
                    />
                  ) : (
                    <div className="page-stack page-enter">
                      <PersonalDashboard
                        showcase={showcase}
                        user={user}
                        alphas={alphas}
                        busy={busy === "sync"}
                        onSync={() =>
                          void action(
                            "sync",
                            () => post("/api/sync-cloud"),
                            "PORTFOLIO SYNCED",
                            "Pulled latest submissions and telemetry from WorldQuant BRAIN.",
                          )
                        }
                        onInspect={(a) => void openAlpha(a)}
                        onClone={(a) => void cloneToFactory(a)}
                        onOpenStudio={() => switchPage("factory")}
                      />
                    </div>
                  ))}

                {/* ========================================================= */}
                {/* PAGE 404: ANOMALY SCREEN                                  */}
                {/* ========================================================= */}
                {page === "notfound" && (
                  <div className="anomaly-view page-enter">
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
                        {!authenticated
                          ? "Sign in to continue"
                          : selected
                            ? `${selected.id} · Sharpe ${fmt(selected.sharpe)}`
                            : "Select an alpha to inspect"}
                      </small>
                    </div>
                  </div>
                  <div className="accordion-right">
                    <span
                      className={`tier-badge ${tierClass(selected?.tier)}`}
                    >
                      {!authenticated
                        ? "LOCKED"
                        : selected
                          ? selected.tier || "EVALUATED"
                          : "STANDBY"}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`accordion-chevron ${inspectorSection === "inspector" ? "open" : ""}`}
                    />
                  </div>
                </button>

                {inspectorSection === "inspector" && (
                  <div className="accordion-body dark-body accordion-slide-in">
                    {!authenticated ? (
                      <div className="inspector-empty">
                        <LockKeyhole size={24} />
                        <p>Sign in to continue and inspect alpha telemetry.</p>
                        <ButtonBase
                          className="primary small"
                          onClick={() => setLoginOpen(true)}
                        >
                          Sign In to Continue
                        </ButtonBase>
                      </div>
                    ) : selected ? (
                      <>
                        <div className="selected-head stagger-item">
                          <div>
                            <small>SELECTED CANDIDATE</small>
                            <strong>{selected.id}</strong>
                          </div>
                          <span
                            className={`status-chip ${outcomeClass(selected)}`}
                          >
                            {statusOf(selected)}
                          </span>
                        </div>

                        <div className="telemetry-grid stagger-item">
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
                            <strong
                              className={corrColorClass(
                                selected.max_self_correlation,
                              )}
                            >
                              {fmt(selected.max_self_correlation)}
                            </strong>
                          </div>
                        </div>

                        <div className="hurdle-bars stagger-item">
                          <div className="hurdle-bars-head">
                            <span>HURDLE STANDING</span>
                            <span>THRESHOLD</span>
                          </div>
                          {hurdleBars(selected).map((bar) => (
                            <div className="hurdle-bar-row" key={bar.label}>
                              <div className="hurdle-bar-labels">
                                <span>{bar.label}</span>
                                <b>
                                  {bar.val} <small>({bar.target})</small>
                                </b>
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

                        <div className="inspector-actions stagger-item">
                          <ButtonBase
                            onClick={() => void cloneToFactory(selected)}
                          >
                            <FlaskConical size={14} /> Clone to Studio
                          </ButtonBase>
                          <ButtonBase
                            onClick={() => checkCorrelation(selected)}
                            busy={busy === "correlation"}
                            busyLabel="Checking…"
                          >
                            <Radar size={14} /> Check Corr
                          </ButtonBase>
                          <ButtonBase
                            className="primary full"
                            disabled={
                              !selected.is_submittable ||
                              selected.submission_status === "SUBMITTED"
                            }
                            onClick={() => submit(selected)}
                          >
                            {selected.submission_status === "SUBMITTED"
                              ? "Submitted on BRAIN"
                              : "Submit Alpha to BRAIN"}
                            <ArrowRight size={14} />
                          </ButtonBase>
                        </div>
                      </>
                    ) : (
                      <div className="inspector-empty">
                        <Compass size={26} />
                        <p>Click any alpha row to inspect its metrics.</p>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ACCORDION 02: PLATFORM CHECKS (Smooth AnimatedList Slide-In + No Overlap!) */}
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
                        {!authenticated
                          ? "Sign in to continue"
                          : selected
                            ? `Matrix · ${selected.id}`
                            : "7-Hurdle verification"}
                      </small>
                    </div>
                  </div>
                  <div className="accordion-right">
                    <span className="tiny-pill">
                      {!authenticated
                        ? "LOCKED"
                        : `${passedChecksCount}/${checksList.length} PASS`}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`accordion-chevron ${inspectorSection === "checks" ? "open" : ""}`}
                    />
                  </div>
                </button>

                {inspectorSection === "checks" && (
                  <div className="accordion-body light-body accordion-slide-in">
                    {!authenticated ? (
                      <div className="feed-empty">
                        Sign in to continue and view platform hurdle checks.
                      </div>
                    ) : (
                      <>
                        <div className="corr-summary-box stagger-item">
                          <span>
                            SELF-CORR:{" "}
                            <b
                              className={corrColorClass(
                                selected?.max_self_correlation,
                              )}
                            >
                              {selected?.max_self_correlation !== undefined &&
                              selected?.max_self_correlation !== null
                                ? fmt(selected.max_self_correlation)
                                : "< 0.70 (PASS)"}
                            </b>
                          </span>
                          <span>
                            CEILING: <b>&lt; 0.70</b>
                          </span>
                        </div>
                        <ActivityList
                          items={checksList.map((check, index) => {
                            const resStr = String(
                              check.result || "PENDING",
                            ).toUpperCase();
                            return {
                              id: `${selected?.id || "chk"}-${index}`,
                              title: String(check.name || "HURDLE").replace(
                                /_/g,
                                " ",
                              ),
                              description: `Standing: ${resStr}`,
                              meta: resStr,
                              icon: <ShieldCheck size={14} />,
                            };
                          })}
                          theme="light"
                          frame={false}
                          width="100%"
                          maxHeight={420}
                          showGradients={false}
                          animation="slide"
                        />
                      </>
                    )}
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
                      <small>
                        {!authenticated
                          ? "Sign in to continue"
                          : "Live simulation & audit stream"}
                      </small>
                    </div>
                  </div>
                  <div className="accordion-right">
                    <span className="tiny-pill">
                      {!authenticated ? "LOCKED" : `${activity.length} LOGS`}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`accordion-chevron ${inspectorSection === "events" ? "open" : ""}`}
                    />
                  </div>
                </button>

                {inspectorSection === "events" && (
                  <div className="accordion-body light-body accordion-slide-in">
                    {!authenticated ? (
                      <div className="feed-empty">
                        Sign in to continue and view recent session events.
                      </div>
                    ) : activity.length ? (
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

      {/* RAYCAST-STYLE INSTANT COMMAND PALETTE (⌘K) */}
      <CommandPalette
        open={palette}
        query={paletteQuery}
        loadingFields={paletteLoading}
        onQueryChange={setPaletteQuery}
        onClose={() => setPalette(false)}
        items={paletteItems}
        onCopy={(text, label) => {
          void navigator.clipboard?.writeText(text);
          notify("COPIED TO CLIPBOARD", `Copied ${label} to clipboard.`);
        }}
        onLoadInStudio={(expr, name) => {
          setExpression(expr);
          if (name) setAlphaName(name);
          switchPage("factory");
          notify(
            "LOADED IN ALPHA STUDIO",
            `Loaded ${name || "expression"} into FastExpr editor.`,
          );
        }}
      />

      {/* HEAD-TO-HEAD ALPHA COMPARISON MODAL */}
      {comparison.length > 0 && (
        <div className="raycast-backdrop" onClick={() => setComparison([])}>
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
                type="button"
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
                    SELF-CORR{" "}
                    <b className={corrColorClass(a.max_self_correlation)}>
                      {fmt(a.max_self_correlation)}
                    </b>
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
          error={loginError}
          onEmail={setEmail}
          onPassword={setPassword}
          onSubmit={onLogin}
          onClose={() => {
            setLoginOpen(false);
            setLoginError("");
          }}
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
          const pct = Math.max(
            10,
            Math.min(100, Math.round((fit / 3.0) * 100)),
          );
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

/**
 * AlphaTable — Fixed Compact 40px Rows, Zero Formula Code Leaked, Right-Aligned Tabular Figures
 */
function AlphaTable({
  rows,
  selectedId,
  onSelect,
  onClone,
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
  onClone: (a: Alpha) => void;
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
        <div className="table-head-controls">
          <label className="search-box no-cursor-lock">
            <Search size={15} />
            <input
              className="no-cursor-lock"
              aria-label="Filter alphas by ID or quality"
              placeholder="Filter by Alpha ID or quality…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div
        className={`table-wrap density-compact ${fullHeight ? "vault-full-scroll" : ""}`}
      >
        <table className="alpha-registry-table">
          <thead>
            <tr>
              {onCompareToggle && <th className="col-check">CMP</th>}
              <th className="col-id pinned-col">ALPHA ID</th>
              <th className="col-tier">QUALITY</th>
              <th className="col-scope">SCOPE</th>
              <th className="col-num num-right">SHARPE</th>
              <th className="col-num num-right">FITNESS</th>
              <th className="col-num num-right">TURNOVER</th>
              <th className="col-num num-right">SELF-CORR</th>
              <th className="col-status">STATUS</th>
              <th className="col-action num-right">STUDIO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const corr = a.max_self_correlation;
              const turnover = a.turnover_pct ?? (a.turnover || 0) * 100;
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
                  <td className="col-id alpha-cell pinned-col">{a.id}</td>
                  <td className="col-tier">
                    <span className={`quality-pill ${tierClass(a.tier)}`}>
                      {a.tier || "EVALUATED"}
                    </span>
                  </td>
                  <td className="col-scope mono">
                    {a.region || "USA"} · {a.universe || "TOP3000"} · D
                    {a.delay ?? 1}
                  </td>
                  <td className="col-num num-right mono">{fmt(a.sharpe)}</td>
                  <td className="col-num num-right mono">{fmt(a.fitness)}</td>
                  <td className="col-num num-right mono">{fmt(turnover)}%</td>
                  <td className="col-num num-right mono">
                    <span className={`corr-val ${corrColorClass(corr)}`}>
                      {corr !== undefined && corr !== null ? fmt(corr) : "—"}
                    </span>
                  </td>
                  <td className="col-status">
                    <span className={`status-chip ${outcomeClass(a)}`}>
                      {statusOf(a)}
                    </span>
                  </td>
                  <td className="col-action num-right">
                    <button
                      type="button"
                      className={`table-action-btn row-hover-action ${a.is_submittable && a.submission_status !== "SUBMITTED" ? "is-ready" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        a.is_submittable && a.submission_status !== "SUBMITTED"
                          ? onSubmit(a)
                          : onClone(a);
                      }}
                    >
                      <span>
                        {a.is_submittable && a.submission_status !== "SUBMITTED"
                          ? "Submit"
                          : "Clone"}
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

/**
 * Page 07: Personal Dashboard (Only visible when signed in, BRONZE level badge,
 * zero formula code leaked on cards, no GitHub link here, direct WorldQuant BRAIN link)
 */
function PersonalDashboard({
  showcase,
  user,
  alphas,
  busy,
  onSync,
  onInspect,
  onClone,
  onOpenStudio,
}: {
  showcase: ProfileShowcase | null;
  user: { id?: string; fullName?: string; email?: string; level?: string } | null;
  alphas: Alpha[];
  busy: boolean;
  onSync: () => void;
  onInspect: (a: Alpha) => void;
  onClone: (a: Alpha) => void;
  onOpenStudio: () => void;
}) {
  const submitted = useMemo(
    () =>
      showcase?.submitted_alphas?.length
        ? showcase.submitted_alphas
        : alphas.filter((a) => a.submission_status === "SUBMITTED"),
    [showcase, alphas],
  );

  const totalCreated = showcase?.metrics.total_created ?? alphas.length;
  const hurdlePassed =
    showcase?.metrics.hurdle_passed_count ??
    alphas.filter(passesMetricHurdles).length;
  const passRate =
    showcase?.metrics.pass_rate_pct ??
    Number(((hurdlePassed / Math.max(1, totalCreated)) * 100).toFixed(1));
  const peakFitness = showcase?.metrics.peak_fitness ?? 0;
  const peakSharpe = showcase?.metrics.peak_sharpe ?? 0;

  const tiers = showcase?.tier_distribution ?? {
    SPECTACULAR: 0,
    EXCELLENT: 0,
    GOOD: 0,
    AVERAGE: 0,
    BELOW_HURDLE: 0,
  };

  const milestones = showcase?.milestones ?? [];

  const researcherName =
    showcase?.user?.fullName || user?.fullName || "Authenticated Researcher";
  const researcherLevel = showcase?.user?.level || user?.level || "BRONZE";
  const researcherId = showcase?.user?.id || user?.id || "WQ-USER";

  return (
    <div className="personal-dashboard-stack">
      <section className="personal-hero recessed">
        <div className="personal-hero-main">
          <div className="personal-avatar-badge">
            <AlphaLogo size={56} />
          </div>
          <div className="personal-hero-copy">
            <div className="personal-badges-row">
              <span className="personal-level-pill">
                <Award size={13} />
                <span>{researcherLevel} LEVEL</span>
              </span>
              <span className="personal-id-pill mono">ID · {researcherId}</span>
              <span className="personal-conn-pill online">
                AUTHENTICATED SESSION
              </span>
            </div>
            <h1>{researcherName}</h1>
            <p>
              WorldQuant BRAIN Researcher · {researcherLevel} Level Standing ·
              Synchronized with `platform.worldquantbrain.com`.
            </p>
          </div>
        </div>

        <div className="personal-hero-actions">
          <a
            className="button primary"
            href="https://platform.worldquantbrain.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Open WorldQuant BRAIN</span>
            <ExternalLink size={14} />
          </a>
          <ButtonBase
            className="personal-secondary-btn"
            busy={busy}
            busyLabel="Syncing…"
            onClick={onSync}
          >
            <RefreshCw size={14} />
            <span>Sync Vault</span>
          </ButtonBase>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="ALPHAS CREATED"
          value=""
          numeric={totalCreated}
          sub="100% Audited"
          guide="Total factors synthesized & evaluated in vault"
          tone="emerald"
        />
        <MetricCard
          label="SUBMITTED ON BRAIN"
          value=""
          numeric={submitted.length}
          sub="Live Portfolio"
          guide="Active signals running in production on BRAIN"
          tone="amber"
        />
        <MetricCard
          label="HURDLE QUALIFIED"
          value=""
          numeric={hurdlePassed}
          sub={`${passRate}% Rate`}
          guide="Cleared Sharpe ≥ 1.25, Fit ≥ 1.0, Turnover ≤ 70%"
          tone="gold"
        />
        <MetricCard
          label="PEAK FITNESS"
          value=""
          numeric={peakFitness}
          decimals={2}
          sub={`SR ${peakSharpe.toFixed(2)}`}
          guide="Highest audited factor fitness in your vault"
          tone="ink"
        />
      </div>

      <div className="personal-two-col">
        <section className="glass-soft personal-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">PORTFOLIO QUALITY DISTRIBUTION</span>
              <h2>WorldQuant Tier Pyramid</h2>
              <p className="section-sub">
                Distribution of your {totalCreated} audited signals across
                official WorldQuant BRAIN fitness &amp; Sharpe tiers.
              </p>
            </div>
          </div>

          <div className="pyramid-list">
            {[
              [
                "SPECTACULAR",
                "Fitness ≥ 2.50 · Elite Production",
                tiers.SPECTACULAR || 0,
                "tier-spectacular",
              ],
              [
                "EXCELLENT",
                "Fitness 2.00 – 2.49 · High Conviction",
                tiers.EXCELLENT || 0,
                "tier-excellent",
              ],
              [
                "GOOD",
                "Fitness 1.50 – 1.99 · Solid Alpha",
                tiers.GOOD || 0,
                "tier-good",
              ],
              [
                "AVERAGE",
                "Sharpe ≥ 1.25 · Hurdle Qualified",
                tiers.AVERAGE || 0,
                "tier-default",
              ],
              [
                "BELOW HURDLE",
                "Research & Experimental Drafts",
                tiers.BELOW_HURDLE || 0,
                "tier-muted",
              ],
            ].map(([name, desc, count, cls]) => {
              const num = Number(count);
              const pct = Math.max(
                4,
                Math.min(
                  100,
                  Math.round((num / Math.max(1, totalCreated)) * 100),
                ),
              );
              return (
                <div className="pyramid-row" key={String(name)}>
                  <div className="pyramid-row-head">
                    <div className="pyramid-row-title">
                      <span className={`quality-pill ${cls}`}>{name}</span>
                      <small>{desc}</small>
                    </div>
                    <strong className="mono">{num} Alphas</strong>
                  </div>
                  <div className="pyramid-track">
                    <i className={String(cls)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass-soft personal-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">VERIFIED RESEARCHER MILESTONES</span>
              <h2>Account Standing &amp; Milestones</h2>
              <p className="section-sub">
                Milestones verified from your WorldQuant BRAIN account and
                audited vault.
              </p>
            </div>
            <span className="tiny-pill">
              {milestones.filter((m) => m.unlocked).length}/{milestones.length}{" "}
              UNLOCKED
            </span>
          </div>

          <div className="milestones-grid">
            {milestones.map((m) => (
              <article
                key={m.id}
                className={`milestone-card ${m.unlocked ? "is-unlocked" : "is-locked"}`}
              >
                <div className="milestone-top">
                  <span className="milestone-check">
                    <Check size={13} />
                  </span>
                  <span className="milestone-metric mono">{m.metric}</span>
                </div>
                <strong>{m.title}</strong>
                <p>{m.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* SUBMITTED PORTFOLIO CARDS (Zero Formula Code Displayed — Only Shown When Cloned to Studio!) */}
      <section className="table-card glass-soft">
        <div className="section-head">
          <div>
            <span className="eyebrow">ACTIVE PRODUCTION SIGNALS</span>
            <h2>Submitted WorldQuant BRAIN Portfolio ({submitted.length})</h2>
            <p className="section-sub">
              Live alphas accepted into your WorldQuant BRAIN portfolio. Click
              Clone into Studio to load an expression into the editor.
            </p>
          </div>
          <ButtonBase className="primary small" onClick={onOpenStudio}>
            <FlaskConical size={14} />
            <span>Synthesize Next Alpha</span>
          </ButtonBase>
        </div>

        <div className="vault-card-grid personal-submitted-grid">
          {submitted.map((alpha) => {
            const corr = alpha.max_self_correlation;
            return (
              <article
                key={alpha.id}
                className="vault-concentric-card"
                onClick={() => onInspect(alpha)}
              >
                <div className="vault-card-top">
                  <div className="vault-card-id-group">
                    <strong className="mono">{alpha.id}</strong>
                    <span className={`quality-pill ${tierClass(alpha.tier)}`}>
                      {alpha.tier || "EVALUATED"}
                    </span>
                  </div>
                  <span className="status-chip submitted">Submitted</span>
                </div>

                <div className="vault-card-divider" />

                <div className="vault-card-receipt">
                  <div className="receipt-cell">
                    <small>SHARPE</small>
                    <strong className="mono">{fmt(alpha.sharpe)}</strong>
                  </div>
                  <div className="receipt-cell">
                    <small>FITNESS</small>
                    <strong className="mono">{fmt(alpha.fitness)}</strong>
                  </div>
                  <div className="receipt-cell">
                    <small>TURNOVER</small>
                    <strong className="mono">
                      {fmt(
                        alpha.turnover_pct ?? (alpha.turnover || 0) * 100,
                        1,
                      )}
                      %
                    </strong>
                  </div>
                  <div className="receipt-cell">
                    <small>SELF-CORR</small>
                    <strong className={`mono corr-val ${corrColorClass(corr)}`}>
                      {fmt(corr)}
                    </strong>
                  </div>
                </div>

                <div className="personal-card-actions">
                  <button
                    type="button"
                    className="table-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClone(alpha);
                    }}
                  >
                    <FlaskConical size={12} />
                    <span>Clone into Studio</span>
                  </button>
                  <span className="personal-scope-note mono">
                    {alpha.region || "USA"} · {alpha.universe || "TOP3000"} · D
                    {alpha.delay ?? 1}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TermsPanel() {
  const sections = [
    [
      "01",
      "OPERATIONAL MANDATE",
      "This quantitative research studio accelerates factor discovery, simulation, and hurdle verification for WorldQuant BRAIN researchers. All cloud simulations and portfolio submissions abide by official platform rate limits and governance rules.",
    ],
    [
      "02",
      "LOCAL COMPUTE & DATA SOVEREIGNTY",
      "Factor expressions, SQLite audit trails, and session preferences remain stored on your local machine and are strictly gated behind authentication.",
    ],
    [
      "03",
      "SUBMISSION CONTROL",
      "Automated pipelines verify Sharpe ≥ 1.25, Fitness ≥ 1.00, Turnover 1%–70%, and Self-Correlation < 0.70, while live portfolio submission always requires explicit human confirmation.",
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

      <article className="creator-profile-card glass-soft">
        <div className="creator-head">
          <AlphaLogo size={44} />
          <div>
            <span className="eyebrow">ARCHITECT &amp; CO-CREATOR</span>
            <h2>Ashwin Anand</h2>
            <small className="mono">@Ashwin-anand-dot</small>
          </div>
        </div>
        <p>
          Quantitative pipeline engineering, WorldQuant BRAIN simulation
          orchestration, and multi-factor FastExpr synthesis architecture.
        </p>
        <div className="creator-links">
          <a
            className="button primary"
            href="https://github.com/Ashwin-anand-dot"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>GitHub Profile</span>
            <ExternalLink size={14} />
          </a>
          <a
            className="button"
            href="https://github.com/Ashwin-anand-dot/brain-alpha-github"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>brain-alpha-github</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </article>

      <article className="creator-profile-card glass-soft">
        <div className="creator-head">
          <AlphaLogo size={44} />
          <div>
            <span className="eyebrow">ARCHITECT &amp; CO-CREATOR</span>
            <h2>Akshat</h2>
            <small className="mono">@Akshat-xe · @ashuwuin</small>
          </div>
        </div>
        <p>
          Autonomous Alpha Miner systems, correlation audit worker, SQLite
          telemetry registry, and quantitative research workbench.
        </p>
        <div className="creator-links">
          <a
            className="button primary"
            href="https://github.com/Akshat-xe/WorldQuant-Alpha-Miner"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Akshat-xe Repo</span>
            <ExternalLink size={14} />
          </a>
          <a
            className="button"
            href="https://github.com/ashuwuin/WorldQuant-Alpha-Miner"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>ashuwuin Repo</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </article>
    </div>
  );
}
