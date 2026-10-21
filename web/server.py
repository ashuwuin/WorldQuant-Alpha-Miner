import os
import sys
import json
import sqlite3
import time
import uuid
from datetime import datetime, timezone, timedelta
import threading
from typing import Dict, Any, List, Optional

# Add parent directory to path
PARENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

import io
import csv
import pandas as pd
import requests
from fastapi import FastAPI, Request, BackgroundTasks, Query
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, RedirectResponse, Response, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from pipeline.config import PipelineConfig
from pipeline.client import BrainClient
from pipeline.evaluator import AlphaEvaluator
from pipeline.database import AlphaDatabase
from pipeline.engine_algorithmic import AlgorithmicEngine
from pipeline.engine_ai import CloudAIEngine
from pipeline.correlation_worker import BackgroundCorrelationWorker
from pipeline.closed_loop_optimizer import ClosedLoopStudioOptimizer

app = FastAPI(title="Quantum Alpha Studio - WorldQuant BRAIN", version="2.5.0", docs_url=None, redoc_url=None)

# ==============================================================================
# Security & Rate Limiting Infrastructure
# ==============================================================================
REQUEST_HISTORY: Dict[str, List[float]] = {}
RATE_LIMIT_LOCK = threading.Lock()

def check_rate_limit(client_id: str, limit: int = 20, window: int = 60) -> bool:
    """Sliding-window rate limiter preventing brute-force & endpoint abuse."""
    now = time.time()
    with RATE_LIMIT_LOCK:
        history = REQUEST_HISTORY.setdefault(client_id, [])
        cutoff = now - window
        REQUEST_HISTORY[client_id] = [t for t in history if t > cutoff]
        if len(REQUEST_HISTORY[client_id]) >= limit:
            return False
        REQUEST_HISTORY[client_id].append(now)
        return True

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "127.0.0.1"
    path = request.url.path

    # Rate limit sensitive authentication and simulation dispatch endpoints
    if path in ("/api/auth/login", "/api/simulate"):
        if not check_rate_limit(f"{client_ip}:{path}", limit=12, window=60):
            return JSONResponse(status_code=429, content={"error": "Too many requests. Rate limit active (12 requests/min)."})

    response = await call_next(request)

    # Institutional Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.worldquantbrain.com; "
        "font-src 'self' data:; "
        "frame-ancestors 'none';"
    )
    return response

# Setup directories
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
DB_PATH = os.path.join(PARENT_DIR, "alphas_audit.db")
DATA_FIELDS_CSV = os.path.join(PARENT_DIR, "data", "data_fields_catalog.csv")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=404, content={"error": "Quant endpoint not found"})
        return templates.TemplateResponse(request=request, name="404.html", status_code=404)
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

# In-memory data fields cache
DATA_FIELDS_DF: Optional[pd.DataFrame] = None

def get_data_fields_df() -> Optional[pd.DataFrame]:
    global DATA_FIELDS_DF
    if DATA_FIELDS_DF is None and os.path.exists(DATA_FIELDS_CSV):
        try:
            DATA_FIELDS_DF = pd.read_csv(DATA_FIELDS_CSV)
            DATA_FIELDS_DF = DATA_FIELDS_DF.fillna("")
        except Exception as e:
            print(f"[!] Error loading data fields catalog: {e}")
            DATA_FIELDS_DF = None
    return DATA_FIELDS_DF

# In-memory simulation task tracker
SIMULATION_TASKS: Dict[str, Dict[str, Any]] = {}

# Background Correlation Worker
def is_system_idle() -> bool:
    """Returns True if no high-priority simulations or batch jobs are active."""
    for task in SIMULATION_TASKS.values():
        if task.get("status") in ("QUEUED", "SIMULATING", "AUDITING"):
            return False
    return True

DB_INSTANCE = AlphaDatabase(DB_PATH)
CORRELATION_WORKER = BackgroundCorrelationWorker(db_path=DB_PATH, is_idle_func=is_system_idle)

from contextlib import contextmanager

# User sessions cache
USER_SESSIONS: Dict[str, Dict[str, Any]] = {}

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 30000;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        with conn:
            yield conn
    finally:
        conn.close()

def compute_tier(fitness: Optional[float], sharpe: Optional[float]) -> str:
    if fitness is not None and fitness >= 2.50:
        return "SPECTACULAR"
    elif fitness is not None and fitness >= 2.00:
        return "EXCELLENT"
    elif fitness is not None and fitness >= 1.50:
        return "GOOD"
    elif sharpe is not None and sharpe >= 1.25:
        return "AVERAGE"
    return "BELOW_HURDLE"

def get_current_session(request: Request) -> Optional[Dict[str, Any]]:
    """Retrieves active authenticated session exclusively from a valid session cookie."""
    cookies = getattr(request, "cookies", {}) or {}
    token = cookies.get("session_id")
    if token and token in USER_SESSIONS:
        return USER_SESSIONS[token]
    return None

# ==============================================================================
# Web Page Navigation Routes
# ==============================================================================

@app.get("/", response_class=HTMLResponse)
async def root_route(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"initial_tab": "dashboard"})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"initial_tab": "dashboard", "open_settings": True})

@app.get("/engine-select", response_class=HTMLResponse)
async def engine_select_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"initial_tab": "dashboard", "open_settings": True})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"initial_tab": "dashboard"})

@app.get("/personal", response_class=HTMLResponse)
async def personal_dashboard_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"initial_tab": "personal"})

@app.get("/studio", response_class=HTMLResponse)
async def studio_page(request: Request, background_tasks: BackgroundTasks):
    sess = get_current_session(request)
    db = AlphaDatabase(DB_PATH)
    if sess:
        client = sess.get("client")
        if client and (db.count_alphas() == 0 or not sess.get("synced_on_studio", False)):
            sess["synced_on_studio"] = True
            background_tasks.add_task(client.sync_user_alphas, db, 150)

        # Start non-blocking correlation worker in background
        if client and not CORRELATION_WORKER.is_running:
            CORRELATION_WORKER.start(client)

    return templates.TemplateResponse(request=request, name="index.html", context={"initial_tab": "studio"})

@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request):
    return templates.TemplateResponse(request=request, name="privacy.html")

@app.get("/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/terms/document", response_class=HTMLResponse)
async def terms_document(request: Request):
    return templates.TemplateResponse(request=request, name="terms.html")

@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt():
    return """User-agent: *
Allow: /
Allow: /login
Allow: /privacy
Allow: /terms
Disallow: /api/
Disallow: /dashboard
Disallow: /studio

Sitemap: https://alpha.quantum/sitemap.xml
"""

@app.get("/sitemap.xml", response_class=Response)
async def sitemap_xml():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://alpha.quantum/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://alpha.quantum/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://alpha.quantum/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://alpha.quantum/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>"""
    return Response(content=xml, media_type="application/xml")

@app.get("/llms.txt", response_class=PlainTextResponse)
async def llms_txt():
    return """# Quantum Alpha Studio
> Autonomous WorldQuant BRAIN portfolio synchronization and institutional alpha discovery portal.

## Overview
Quantum Alpha Studio accelerates quantitative investment factor research for WorldQuant BRAIN consultants. It interfaces with the BRAIN API to simulate FastExpr formulas, evaluate econometric hurdles (Sharpe, Fitness, Turnover, Correlation), and manage portfolio candidate pipelines.

## Architectural Capabilities
- Algorithmic & AI-Driven Alpha Synthesis: Generates cross-sectional, mean-reversion, and momentum alphas.
- Background Correlation Auditing: Pre-screens candidate alphas against active portfolio submissions to verify cross-correlation < 0.70.
- Institutional Hurdle Verification: Verifies Sharpe >= 1.25, Fitness >= 1.0, Margin >= 10 bps, Turnover < 70%.
- Local Database Vault: Encrypts and archives historical simulation logs and factor expressions in SQLite.
"""

# ==============================================================================
# Authentication & User Summary Endpoints
# ==============================================================================

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
async def auth_login(req: LoginRequest, background_tasks: BackgroundTasks):
    try:
        cfg = PipelineConfig()
        email_clean = req.email.strip()
        pass_clean = req.password.strip()

        client = None
        profile = {}
        try:
            client = await run_in_threadpool(BrainClient, cfg, email_clean, pass_clean)
            p_resp = await run_in_threadpool(client._request_with_retry, "GET", f"{cfg.api_base}/users/self")
            if p_resp.status_code == 200:
                profile = p_resp.json()
        except Exception:
            # If live BRAIN API is temporarily rate-limited or offline, allow login if credentials match local .env
            env_email = (os.getenv("BRAIN_EMAIL") or "").strip()
            env_pass = (os.getenv("BRAIN_PASSWORD") or "").strip()
            if env_email and env_pass and email_clean.lower() == env_email.lower() and pass_clean == env_pass:
                client = BrainClient.__new__(BrainClient)
                client.config = cfg
                client.email = email_clean
                client.password = pass_clean
                client._lock = threading.Lock()
                client.session = requests.Session()
            else:
                return JSONResponse(
                    status_code=401,
                    content={"success": False, "error": "Unable to authenticate with WorldQuant BRAIN. Check your credentials and connection."}
                )

        session_token = str(uuid.uuid4())
        full_name = (
            profile.get("fullName")
            or f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip()
            or email_clean.split("@")[0].replace(".", " ").title()
        )
        raw_level = str(profile.get("level") or "").upper()
        user_level = raw_level if raw_level in ("BRONZE", "SILVER", "GOLD") else "BRONZE"

        USER_SESSIONS[session_token] = {
            "client": client,
            "user": {
                "id": profile.get("id") or "WQ-USER",
                "fullName": full_name,
                "email": email_clean,
                "level": user_level
            },
            "engine": "algorithmic",
            "cloud_provider": "gemini",
            "cloud_api_key": os.getenv("GEMINI_API_KEY", ""),
            "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            "ollama_endpoint": os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434"),
            "ollama_model": os.getenv("OLLAMA_MODEL", "deepseek-r1:latest"),
            "synced_on_studio": False
        }

        # Run initial sync in background so login responds immediately
        try:
            if client:
                db = AlphaDatabase(DB_PATH)
                USER_SESSIONS[session_token]["synced_on_studio"] = True
                background_tasks.add_task(client.sync_user_alphas, db, 150)
                CORRELATION_WORKER.start(client)
        except Exception as sync_err:
            print(f"[!] Initial sync warning: {sync_err}")

        res = JSONResponse(content={
            "success": True,
            "user": USER_SESSIONS[session_token]["user"],
            "redirect": "/studio"
        })
        res.set_cookie(key="session_id", value=session_token, httponly=True, samesite="lax")
        return res
    except Exception:
        return JSONResponse(status_code=500, content={"success": False, "error": "Sign in failed. Please try again."})

@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    cookies = getattr(request, "cookies", {}) or {}
    token = cookies.get("session_id")
    if token and token in USER_SESSIONS:
        del USER_SESSIONS[token]
    res = JSONResponse(content={"success": True})
    res.delete_cookie("session_id")
    return res

@app.get("/api/auth/me")
async def auth_me(request: Request):
    sess = get_current_session(request)
    if not sess:
        return JSONResponse(status_code=401, content={"authenticated": False})
    return {"authenticated": True, "user": sess.get("user")}

@app.get("/api/user/dashboard-summary")
async def get_dashboard_summary(request: Request):
    sess = get_current_session(request)
    if not sess:
        return {
            "user": None,
            "active_count": 0,
            "streak_days": 0,
            "competition": None,
            "engine": "algorithmic",
            "cloud_provider": "gemini",
            "gemini_model": "gemini-2.0-flash",
            "ollama_model": "deepseek-r1:latest"
        }

    try:
        client = sess.get("client")
        user_info = sess.get("user")
        if client is None:
            return JSONResponse(status_code=401, content={"error": "BRAIN session has no active client"})
        # 1. Active submissions count
        r_alphas = client._request_with_retry(
            "GET",
            f"{client.config.api_base}/users/self/alphas",
            params={"status": "ACTIVE", "limit": 100, "order": "-dateSubmitted"}
        )
        active_alphas = r_alphas.json().get("results", []) if r_alphas.status_code == 200 else []
        active_count = len(active_alphas)

        # 2. Submission Streak calculation
        dates = set()
        for a in active_alphas:
            d_str = a.get("dateSubmitted") or a.get("dateCreated")
            if d_str:
                dates.add(d_str[:10])
        sorted_dates = sorted(list(dates), reverse=True)

        today = datetime.now(timezone.utc).date()
        streak = 0
        check_date = today
        if sorted_dates and sorted_dates[0] < str(today):
            yesterday = today - timedelta(days=1)
            if sorted_dates[0] == str(yesterday):
                check_date = yesterday
        for d in sorted_dates:
            if d == str(check_date):
                streak += 1
                check_date = check_date - timedelta(days=1)
            else:
                break
        streak_days = streak

        # 3. Active Enrolled Competitions
        r_comp = client._request_with_retry("GET", f"{client.config.api_base}/competitions")
        comps = r_comp.json().get("results", []) if r_comp.status_code == 200 else []
        accepted_comp = next((c for c in comps if c.get("status") == "ACCEPTED"), None)
        comp_data = {
            "name": accepted_comp.get("name"),
            "id": accepted_comp.get("id"),
            "status": accepted_comp.get("status"),
        } if accepted_comp else None

        return {
            "user": user_info,
            "active_count": active_count,
            "streak_days": streak_days,
            "competition": comp_data,
            "engine": sess.get("engine", "algorithmic"),
            "ollama_model": sess.get("ollama_model", "deepseek-r1:latest"),
            "cloud_provider": sess.get("cloud_provider", "gemini")
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/profile/showcase")
async def get_profile_showcase(request: Request):
    """
    Protected endpoint returning the signed-in researcher's profile,
    BRONZE/SILVER/GOLD level, and audited vault summary for Page 07.
    Never exposes data when unauthenticated.
    """
    sess = get_current_session(request)
    if not sess:
        return JSONResponse(
            status_code=401,
            content={"authenticated": False, "error": "Sign in required to view Personal Dashboard."}
        )

    user_info = sess.get("user") or {
        "id": "WQ-USER",
        "fullName": "Quant Researcher",
        "email": "",
        "level": "BRONZE"
    }

    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM alphas ORDER BY fitness DESC")
        rows = [dict(r) for r in c.fetchall()]

    total_created = len(rows)
    submitted_alphas = []
    orthogonal_alphas = []
    hurdle_passed_count = 0
    corr_checked_count = 0
    tier_counts = {
        "SPECTACULAR": 0,
        "EXCELLENT": 0,
        "GOOD": 0,
        "AVERAGE": 0,
        "BELOW_HURDLE": 0
    }

    sharpes = []
    fitnesses = []
    for d in rows:
        tier = compute_tier(d.get("fitness"), d.get("sharpe"))
        d["tier"] = tier
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        d["returns_pct"] = round((d.get("returns") or 0.0) * 100, 2)
        d["turnover_pct"] = round((d.get("turnover") or 0.0) * 100, 2)
        d["margin_bps"] = round((d.get("margin") or 0.0) * 10000, 2)
        d["drawdown_pct"] = round((d.get("drawdown") or 0.0) * 100, 2)

        s = d.get("sharpe") or 0.0
        f = d.get("fitness") or 0.0
        t = d["turnover_pct"]
        if s > 0:
            sharpes.append(s)
        if f > 0:
            fitnesses.append(f)
        if s >= 1.25 and f >= 1.0 and 1.0 <= t <= 70.0:
            hurdle_passed_count += 1
        if d.get("correlation_checked"):
            corr_checked_count += 1
        if d.get("submission_status") == "SUBMITTED":
            submitted_alphas.append(d)
        elif d.get("is_submittable"):
            orthogonal_alphas.append(d)

    peak_sharpe = round(max(sharpes), 2) if sharpes else 0.0
    peak_fitness = round(max(fitnesses), 2) if fitnesses else 0.0
    avg_sharpe = round(sum(sharpes) / len(sharpes), 2) if sharpes else 0.0
    avg_fitness = round(sum(fitnesses) / len(fitnesses), 2) if fitnesses else 0.0

    level_str = user_info.get("level") or "BRONZE"
    milestones = [
        {
            "id": "BRONZE_TRACK",
            "title": f"WorldQuant {level_str} Level",
            "description": "Verified account standing on WorldQuant BRAIN",
            "metric": f"{level_str} LEVEL",
            "unlocked": True
        },
        {
            "id": "PORTFOLIO_LIVE",
            "title": "Live Portfolio Submissions",
            "description": "Orthogonal alphas accepted into live WorldQuant BRAIN production",
            "metric": f"{len(submitted_alphas)} Submitted",
            "unlocked": len(submitted_alphas) > 0
        },
        {
            "id": "SPECTACULAR_TIER",
            "title": "Spectacular Fitness (≥ 2.50)",
            "description": "Engineered top-decile factor exceeding 2.50 Fitness & 2.35 Sharpe",
            "metric": f"Peak Fit {peak_fitness:.2f}",
            "unlocked": peak_fitness >= 2.50
        },
        {
            "id": "HURDLE_MASTERY",
            "title": "40+ Hurdle-Passed Signals",
            "description": "Factors clearing Sharpe ≥ 1.25, Fitness ≥ 1.00, and Turnover 1%–70%",
            "metric": f"{hurdle_passed_count} Passed",
            "unlocked": hurdle_passed_count >= 40
        },
        {
            "id": "CORR_AUDITED",
            "title": "100% Self-Correlation Audited",
            "description": "Every candidate screened against active portfolio (< 0.70 ceiling)",
            "metric": f"{corr_checked_count}/{total_created} Checked",
            "unlocked": corr_checked_count >= total_created and total_created > 0
        },
        {
            "id": "ORTHOGONAL_RESERVE",
            "title": "Orthogonal Reserve Pipeline",
            "description": "Unsubmitted alphas passing all 7 hurdles & self-correlation < 0.70",
            "metric": f"{len(orthogonal_alphas)} Ready",
            "unlocked": len(orthogonal_alphas) > 0
        }
    ]

    return {
        "authenticated": True,
        "user": user_info,
        "platform_url": "https://platform.worldquantbrain.com",
        "metrics": {
            "total_created": total_created,
            "submitted_count": len(submitted_alphas),
            "hurdle_passed_count": hurdle_passed_count,
            "orthogonal_count": len(orthogonal_alphas),
            "corr_checked_count": corr_checked_count,
            "peak_sharpe": peak_sharpe,
            "peak_fitness": peak_fitness,
            "avg_sharpe": avg_sharpe,
            "avg_fitness": avg_fitness,
            "pass_rate_pct": round((hurdle_passed_count / max(1, total_created)) * 100, 1)
        },
        "tier_distribution": tier_counts,
        "submitted_alphas": submitted_alphas,
        "orthogonal_alphas": orthogonal_alphas[:6],
        "milestones": milestones
    }

# ==============================================================================
# Discovery Engine Configuration Endpoints
# ==============================================================================

class EngineSelectRequest(BaseModel):
    engine: str
    cloud_provider: Optional[str] = "gemini"
    cloud_api_key: Optional[str] = ""
    ollama_endpoint: Optional[str] = "http://localhost:11434"
    ollama_model: Optional[str] = "deepseek-r1:latest"

@app.post("/api/engine/select")
async def set_engine_selection(req: EngineSelectRequest, request: Request):
    sess = get_current_session(request)
    if sess:
        sess["engine"] = req.engine
        sess["cloud_provider"] = req.cloud_provider
        sess["cloud_api_key"] = req.cloud_api_key
        sess["ollama_endpoint"] = req.ollama_endpoint
        sess["ollama_model"] = req.ollama_model
    return {"success": True, "engine": req.engine}

class KeyValidateRequest(BaseModel):
    provider: str
    api_key: str

@app.post("/api/engine/validate-cloud-key")
async def validate_cloud_key(req: KeyValidateRequest):
    valid = CloudAIEngine.validate_key(req.provider, req.api_key)
    return {"valid": valid, "provider": req.provider}

@app.get("/api/engine/ollama-models")
async def get_ollama_models(endpoint: str = "http://localhost:11434"):
    models = CloudAIEngine.fetch_ollama_models(endpoint)
    return {"endpoint": endpoint, "models": models, "available": len(models) > 0}

class GeneratePreviewRequest(BaseModel):
    engine: Optional[str] = None
    pattern_idx: Optional[int] = Field(default=None, ge=0, le=4)
    prompt: Optional[str] = Field(default=None, max_length=500)

def generate_candidate(req: GeneratePreviewRequest, sess: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    engine = req.engine or (sess.get("engine", "algorithmic") if sess else "algorithmic")
    if engine == "algorithmic":
        return AlgorithmicEngine.generate_candidate(pattern_idx=req.pattern_idx)
    if engine == "ollama":
        return CloudAIEngine.generate_alpha(
            provider="ollama",
            endpoint=sess.get("ollama_endpoint", "http://localhost:11434") if sess else "http://localhost:11434",
            model=sess.get("ollama_model", "deepseek-r1:latest") if sess else "deepseek-r1:latest",
            prompt=req.prompt,
        )
    if engine in ("cloud_ai", "gemini", "openai", "ai"):
        provider = sess.get("cloud_provider", "gemini") if sess else "gemini"
        if engine == "openai":
            provider = "openai"
        key = (sess.get("cloud_api_key") if sess else None) or os.getenv("OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY")
        model = (sess.get("gemini_model") if sess else None) or os.getenv("GEMINI_MODEL") or "gemini-2.0-flash"
        return CloudAIEngine.generate_alpha(provider=provider, api_key=key, model=model if provider == "gemini" else None, prompt=req.prompt)
    raise ValueError("Unsupported generation engine")

@app.post("/api/engine/generate-preview")
async def generate_preview(req: GeneratePreviewRequest, request: Request):
    try:
        candidate = await run_in_threadpool(generate_candidate, req, get_current_session(request))
        return {"success": True, "candidate": candidate}
    except (ValueError, RuntimeError) as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})

# ==============================================================================
# Batch Generation & Safe Auto-Pilot Execution
# ==============================================================================

def run_batch_simulation_task(task_id: str, candidate: Dict[str, Any], sess: Optional[Dict[str, Any]]):
    task = SIMULATION_TASKS[task_id]
    task["status"] = "SIMULATING"
    task["logs"].append(f"[*] Compiling FastExpr with WorldQuant BRAIN API for candidate '{candidate['name']}'...")

    try:
        client = sess.get("client") if sess else BrainClient(PipelineConfig())
        db = AlphaDatabase(DB_PATH)

        # 1. Simulation
        res = client.simulate_candidate(candidate)
        if not res or "id" not in res:
            task["status"] = "FAILED"
            task["logs"].append("[!] Simulation queue timed out or rejected candidate expression.")
            task["candidate"] = None
            return

        alpha_id = res["id"]
        task["logs"].append(f"[✓] Simulation succeeded! Alpha ID: {alpha_id}")
        task["status"] = "AUDITING"
        task["logs"].append("[*] Running 100% platform hurdles & self-correlation checks...")

        evaluator = AlphaEvaluator(client=client, config=client.config, db=db)
        eval_res = evaluator.evaluate_alpha(res, name=candidate.get("name"))

        task["status"] = "COMPLETE"
        task["candidate"] = {
            "id": eval_res.id,
            "sharpe": round(eval_res.sharpe, 2) if eval_res.sharpe is not None else 0.0,
            "fitness": round(eval_res.fitness, 2) if eval_res.fitness is not None else 0.0,
            "returns_pct": round((eval_res.returns or 0.0) * 100, 2),
            "turnover_pct": round((eval_res.turnover or 0.0) * 100, 2),
            "margin_bps": round((eval_res.margin or 0.0) * 10000, 2),
            "drawdown_pct": round((eval_res.drawdown or 0.0) * 100, 2),
            "is_submittable": 1 if eval_res.is_submittable else 0,
            "max_self_correlation": eval_res.max_self_correlation,
            "fail_reasons": eval_res.fail_reasons,
        }
        if eval_res.is_submittable:
            task["logs"].append(f"[✓] Hurdle passed! Sharpe: {eval_res.sharpe:.2f}, Fitness: {eval_res.fitness:.2f}. Alpha ready for submission.")
        else:
            task["logs"].append(f"[!] Platform hurdle warning: {', '.join(eval_res.fail_reasons) if eval_res.fail_reasons else 'Checks did not pass threshold'}")
    except Exception as e:
        task["status"] = "FAILED"
        task["logs"].append(f"[!] Error during simulation/audit: {str(e)}")
        task["candidate"] = None

@app.post("/api/engine/run-batch")
async def run_batch(request: Request, background_tasks: BackgroundTasks, req: GeneratePreviewRequest = GeneratePreviewRequest()):
    sess = get_current_session(request)
    task_id = str(uuid.uuid4())
    engine_type = req.engine or (sess.get("engine", "algorithmic") if sess else "algorithmic")
    try:
        candidate = await run_in_threadpool(generate_candidate, req, sess)
    except (ValueError, RuntimeError) as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})

    SIMULATION_TASKS[task_id] = {
        "status": "SIMULATING",
        "logs": [
            f"[*] Discovery Engine: {engine_type.upper()}",
            f"[*] Candidate Blueprint: {candidate['name']}",
            "[*] Initiating simulation pipeline on WorldQuant BRAIN..."
        ],
        "candidate": None,
        "blueprint": {key: candidate.get(key) for key in ("name", "expr", "region", "universe", "delay", "decay", "neutralization")}
    }

    background_tasks.add_task(run_batch_simulation_task, task_id, candidate, sess)
    return {"task_id": task_id, "status": "QUEUED", "blueprint": SIMULATION_TASKS[task_id]["blueprint"]}

class SubmitConfirmRequest(BaseModel):
    alpha_id: str

@app.post("/api/engine/confirm-submit")
async def confirm_submit_alpha(req: SubmitConfirmRequest, request: Request):
    sess = get_current_session(request)
    client = sess.get("client") if sess else BrainClient(PipelineConfig())

    url = f"{client.config.api_base}/alphas/{req.alpha_id}/submit"
    resp = client._request_with_retry("POST", url)
    if resp.status_code in (200, 201):
        try:
            with get_db_connection() as conn:
                c = conn.cursor()
                c.execute("UPDATE alphas SET submission_status = 'SUBMITTED' WHERE id = ?", (req.alpha_id,))
                conn.commit()
        except Exception:
            pass
        return {"success": True, "alpha_id": req.alpha_id, "message": "Alpha submitted to live portfolio!"}
    else:
        return JSONResponse(status_code=resp.status_code, content={"success": False, "message": resp.text})

# ==============================================================================
# Existing Alpha Registry, Compare & CSV Endpoints (Preserved for /studio)
# ==============================================================================

@app.post("/api/sync-cloud")
async def sync_cloud(request: Request):
    """Pulls all active submissions and unsubmitted draft alphas from WorldQuant BRAIN."""
    sess = get_current_session(request)
    if not sess or not sess.get("client"):
        return JSONResponse(status_code=401, content={"success": False, "error": "Not authenticated with WorldQuant BRAIN."})

    client: BrainClient = sess["client"]
    db = AlphaDatabase(DB_PATH)
    try:
        res = client.sync_user_alphas(db, max_unsubmitted=150)
        # Start or resume background correlation audit for unsubmitted alphas
        CORRELATION_WORKER.start(client)
        return JSONResponse(content={
            "success": True,
            "synced": res.get("total_synced", 0),
            "active_synced": res.get("active_synced", 0),
            "unsubmitted_synced": res.get("unsubmitted_synced", 0),
            "message": f"Successfully pulled {res.get('total_synced', 0)} alphas from WorldQuant BRAIN."
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.get("/api/correlation-worker/status")
async def get_correlation_worker_status(request: Request):
    """Returns the live audit status and completion progress of the correlation worker."""
    sess = get_current_session(request)
    if sess and sess.get("client") and not CORRELATION_WORKER.is_running:
        db = AlphaDatabase(DB_PATH)
        if db.get_unchecked_unsubmitted_alphas(limit=1):
            CORRELATION_WORKER.start(sess["client"])
    return CORRELATION_WORKER.get_status()

@app.post("/api/correlation-worker/start")
async def start_correlation_worker_endpoint(request: Request):
    """Manually triggers or wakes up the background correlation worker."""
    sess = get_current_session(request)
    if not sess or not sess.get("client"):
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})
    CORRELATION_WORKER.start(sess["client"])
    return {"success": True, "status": CORRELATION_WORKER.get_status()}

@app.get("/api/active-portfolio")
async def get_active_portfolio(request: Request):
    """Returns all active, submitted alphas currently running in the user's live portfolio."""
    sess = get_current_session(request)
    db = AlphaDatabase(DB_PATH)

    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM alphas WHERE submission_status = 'SUBMITTED' ORDER BY fitness DESC")
        rows = c.fetchall()

    # If DB doesn't have active submissions yet and user has active session, sync on demand
    if not rows and sess and sess.get("client"):
        try:
            sess["client"].sync_user_alphas(db, max_unsubmitted=50)
            with get_db_connection() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM alphas WHERE submission_status = 'SUBMITTED' ORDER BY fitness DESC")
                rows = c.fetchall()
        except Exception:
            pass

    results = []
    for r in rows:
        d = dict(r)
        d["tier"] = compute_tier(d.get("fitness"), d.get("sharpe"))
        d["returns_pct"] = round((d.get("returns") or 0.0) * 100, 2)
        d["turnover_pct"] = round((d.get("turnover") or 0.0) * 100, 2)
        d["margin_bps"] = round((d.get("margin") or 0.0) * 10000, 2)
        d["drawdown_pct"] = round((d.get("drawdown") or 0.0) * 100, 2)
        results.append(d)

    return {"active_alphas": results, "count": len(results)}

@app.get("/api/stats")
async def get_stats(request: Request, today_only: bool = False, date: Optional[str] = None):
    db = AlphaDatabase(DB_PATH)
    sess = get_current_session(request)

    # If database is completely empty and user is logged in, auto-sync
    if db.count_alphas() == 0 and sess and sess.get("client"):
        try:
            sess["client"].sync_user_alphas(db, max_unsubmitted=100)
        except Exception:
            pass

    stats = db.get_stats(today_only=today_only, target_date=date)
    return stats

@app.get("/api/alphas")
async def get_alphas(
    request: Request,
    tier: Optional[str] = None,
    submittable_only: bool = False,
    active_only: bool = False,
    unsubmitted_only: bool = False,
    today_only: bool = False,
    date: Optional[str] = None,
    sort_by: str = "fitness",
    order: str = "desc",
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None
):
    db = AlphaDatabase(DB_PATH)
    sess = get_current_session(request)

    # Auto-sync on query if database has 0 alphas and user has an active session
    if db.count_alphas() == 0 and sess and sess.get("client"):
        try:
            sess["client"].sync_user_alphas(db, max_unsubmitted=100)
        except Exception:
            pass

    with get_db_connection() as conn:
        c = conn.cursor()
        query = "SELECT * FROM alphas WHERE 1=1"
        params = []

        if today_only:
            target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            query += " AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))"
            params.append(target_date)

        if submittable_only:
            query += " AND is_submittable = 1"
        if active_only:
            query += " AND submission_status = 'SUBMITTED'"
        if unsubmitted_only:
            query += " AND submission_status = 'UNSUBMITTED'"
        if tier == "spectacular":
            query += " AND fitness >= 2.50"
        elif tier == "excellent":
            query += " AND fitness >= 2.00 AND fitness < 2.50"
        elif tier == "good":
            query += " AND fitness >= 1.50 AND fitness < 2.00"

        if search:
            query += " AND (id LIKE ? OR expression LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param])

        valid_sort_cols = {
            "fitness": "fitness",
            "sharpe": "sharpe",
            "returns": "returns",
            "turnover": "turnover",
            "margin": "margin",
            "drawdown": "drawdown",
            "evaluated_at": "evaluated_at"
        }
        sort_col = valid_sort_cols.get(sort_by, "fitness")
        sort_order = "DESC" if order.lower() == "desc" else "ASC"
        query += f" ORDER BY {sort_col} {sort_order} LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        c.execute(query, params)
        rows = c.fetchall()

    result = []
    for r in rows:
        d = dict(r)
        d["tier"] = compute_tier(d.get("fitness"), d.get("sharpe"))
        d["returns_pct"] = round((d.get("returns") or 0.0) * 100, 2)
        d["turnover_pct"] = round((d.get("turnover") or 0.0) * 100, 2)
        d["margin_bps"] = round((d.get("margin") or 0.0) * 10000, 2)
        d["drawdown_pct"] = round((d.get("drawdown") or 0.0) * 100, 2)
        result.append(d)

    return {"alphas": result, "count": len(result)}

@app.get("/api/alpha/{alpha_id}")
async def get_alpha_details(alpha_id: str):
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM alphas WHERE id = ?", (alpha_id,))
        row = c.fetchone()
        if not row:
            return JSONResponse(status_code=404, content={"error": "Alpha not found"})

        d = dict(row)
        d["tier"] = compute_tier(d.get("fitness"), d.get("sharpe"))
        d["returns_pct"] = round((d.get("returns") or 0.0) * 100, 2)
        d["turnover_pct"] = round((d.get("turnover") or 0.0) * 100, 2)
        d["margin_bps"] = round((d.get("margin") or 0.0) * 10000, 2)
        d["drawdown_pct"] = round((d.get("drawdown") or 0.0) * 100, 2)

        if d.get("checks_summary"):
            try:
                d["checks_list"] = json.loads(d["checks_summary"])
            except Exception:
                d["checks_list"] = []
        else:
            d["checks_list"] = []

        return d

@app.get("/api/data-fields")
async def get_data_fields(
    search: Optional[str] = None,
    dataset: Optional[str] = None,
    field_type: Optional[str] = None,
    page: int = 1,
    limit: int = 50
):
    df = get_data_fields_df()
    if df is None:
        return JSONResponse(status_code=500, content={"error": "Data catalog unavailable"})

    filtered = df
    if dataset:
        filtered = filtered[filtered["dataset_id"].str.lower() == dataset.lower()]
    if field_type:
        filtered = filtered[filtered["type"].str.lower() == field_type.lower()]
    if search:
        s = search.lower()
        mask = filtered["id"].str.lower().str.contains(s) | filtered["description"].str.lower().str.contains(s)
        filtered = filtered[mask]

    total = len(filtered)
    start = (page - 1) * limit
    end = start + limit
    records = filtered.iloc[start:end].to_dict(orient="records")

    return {"fields": records, "total": total, "page": page, "limit": limit}

@app.get("/api/datasets")
async def get_datasets():
    df = get_data_fields_df()
    if df is None:
        return {"datasets": []}
    counts = df.groupby(["dataset_id", "dataset_name"]).size().reset_index(name="fields_count")
    counts = counts.sort_values(by="fields_count", ascending=False)
    results = [{"id": r["dataset_id"], "name": r["dataset_name"], "fields_count": int(r["fields_count"])} for _, r in counts.iterrows()]
    return {"datasets": results, "total": len(results)}

@app.get("/api/compare")
async def compare_alphas(ids: str):
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return {"alphas": []}

    placeholders = ",".join(["?"] * len(id_list))
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute(f"SELECT * FROM alphas WHERE id IN ({placeholders})", id_list)
        rows = c.fetchall()

    res = []
    for r in rows:
        d = dict(r)
        d["tier"] = compute_tier(d.get("fitness"), d.get("sharpe"))
        d["returns_pct"] = round((d.get("returns") or 0.0) * 100, 2)
        d["turnover_pct"] = round((d.get("turnover") or 0.0) * 100, 2)
        d["margin_bps"] = round((d.get("margin") or 0.0) * 10000, 2)
        d["drawdown_pct"] = round((d.get("drawdown") or 0.0) * 100, 2)
        res.append(d)
    return {"alphas": res}

@app.get("/api/correlation-check/{alpha_id}")
async def check_alpha_correlation(alpha_id: str, request: Request):
    sess = get_current_session(request)
    client = sess.get("client") if sess else BrainClient(PipelineConfig())

    chk = client.run_platform_checks(alpha_id)
    if not chk or "is" not in chk:
        return JSONResponse(status_code=404, content={"error": "Check data not available"})

    self_corr = chk.get("is", {}).get("selfCorrelated", {})
    records = self_corr.get("records", [])
    max_val = self_corr.get("max")

    corr_list = []
    for rec in records:
        corr_list.append({
            "target_id": rec[0],
            "correlation": rec[5] if len(rec) > 5 else None,
            "sharpe": rec[6] if len(rec) > 6 else None,
            "returns_pct": round(rec[7] * 100, 2) if len(rec) > 7 and rec[7] is not None else None,
            "turnover_pct": round(rec[8] * 100, 2) if len(rec) > 8 and rec[8] is not None else None,
            "fitness": rec[9] if len(rec) > 9 else None
        })
    passed = (max_val is None or max_val < 0.70)
    return {
        "alpha_id": alpha_id,
        "passed": passed,
        "max_self_correlation": max_val,
        "max_correlation": max_val,
        "correlations": [
            {
                "active_id": c["target_id"],
                "correlation": c["correlation"],
                "sharpe": c["sharpe"],
                "fitness": c["fitness"]
            }
            for c in corr_list
        ],
        "correlated_records": corr_list
    }

class SimulationRequest(BaseModel):
    name: str
    expr: str
    region: str = "USA"
    universe: str = "TOP3000"
    delay: int = 1
    decay: int = 22
    neutralization: str = "SUBINDUSTRY"
    truncation: float = Field(default=0.08, ge=0.01, le=0.15)
    pasteurization: str = "ON"
    nanHandling: str = "OFF"

def run_simulation_task(task_id: str, req: SimulationRequest, sess: Optional[Dict[str, Any]]):
    SIMULATION_TASKS[task_id]["status"] = "SIMULATING"
    SIMULATION_TASKS[task_id]["logs"].append("[*] Authenticating and compiling FastExpr with WorldQuant BRAIN...")
    try:
        cfg = PipelineConfig()
        client = sess.get("client") if sess and sess.get("client") else BrainClient(cfg)
        db = AlphaDatabase(DB_PATH)
        cand = req.model_dump()
        res = client.simulate_candidate(cand)
        if not res or "id" not in res:
            SIMULATION_TASKS[task_id]["status"] = "FAILED"
            SIMULATION_TASKS[task_id]["logs"].append("[!] Simulation rejected or timed out by BRAIN API.")
            return

        alpha_id = res["id"]
        SIMULATION_TASKS[task_id]["alpha_id"] = alpha_id
        SIMULATION_TASKS[task_id]["logs"].append(f"[✓] Simulation succeeded! Alpha ID: {alpha_id}")
        SIMULATION_TASKS[task_id]["status"] = "AUDITING"
        SIMULATION_TASKS[task_id]["logs"].append("[*] Running full platform checks and self-correlation matrix...")

        evaluator = AlphaEvaluator(client=client, config=client.config, db=db)
        eval_res = evaluator.evaluate_alpha(res, name=req.name)

        SIMULATION_TASKS[task_id]["candidate"] = {
            "id": eval_res.id,
            "sharpe": eval_res.sharpe,
            "fitness": eval_res.fitness,
            "returns_pct": round((eval_res.returns or 0.0) * 100, 2),
            "turnover_pct": round((eval_res.turnover or 0.0) * 100, 2),
            "margin_bps": round((eval_res.margin or 0.0) * 10000, 2),
            "drawdown_pct": round((eval_res.drawdown or 0.0) * 100, 2),
            "max_self_correlation": eval_res.max_self_correlation,
            "is_submittable": bool(eval_res.is_submittable),
            "fail_reasons": eval_res.fail_reasons,
        }

        SIMULATION_TASKS[task_id]["status"] = "COMPLETE"
        SIMULATION_TASKS[task_id]["logs"].append("[✓] Audit complete! Saved to database.")
    except Exception as e:
        SIMULATION_TASKS[task_id]["status"] = "ERROR"
        SIMULATION_TASKS[task_id]["logs"].append(f"[!] Error: {str(e)}")

@app.post("/api/simulate")
async def dispatch_simulation(req: SimulationRequest, background_tasks: BackgroundTasks, request: Request):
    task_id = str(uuid.uuid4())
    SIMULATION_TASKS[task_id] = {
        "status": "QUEUED",
        "logs": [f"[*] Task queued for candidate: {req.name}"],
        "alpha_id": None,
        "candidate": None,
    }
    background_tasks.add_task(run_simulation_task, task_id, req, get_current_session(request))
    return {"task_id": task_id, "status": "QUEUED"}

@app.get("/api/simulate/status/{task_id}")
async def get_simulation_status(task_id: str):
    task = SIMULATION_TASKS.get(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return task

# ==============================================================================
# Closed-Loop Studio Evolution Endpoints (Sim 1 -> Sim X)
# ==============================================================================

class StudioEvolveRequest(BaseModel):
    name: str = "Studio_Evolution_Alpha"
    expr: str
    region: str = "USA"
    universe: str = "TOP3000"
    delay: int = 1
    decay: int = 12
    neutralization: str = "SUBINDUSTRY"
    max_iterations: int = 5
    target_sharpe: float = 1.25

@app.post("/api/studio/evolve")
async def start_studio_evolve(req: StudioEvolveRequest, request: Request):
    sess = get_current_session(request)
    client = sess.get("client")
    if not client:
        return JSONResponse(status_code=401, content={"error": "Not authenticated. Please login."})
    
    db = DB_INSTANCE or AlphaDatabase(DB_PATH)
    candidate = {
        "name": req.name,
        "expr": req.expr,
        "region": req.region,
        "universe": req.universe,
        "delay": req.delay,
        "decay": req.decay,
        "neutralization": req.neutralization
    }
    session_id = ClosedLoopStudioOptimizer.start_session(
        initial_candidate=candidate,
        client=client,
        db=db,
        max_iterations=req.max_iterations,
        target_sharpe=req.target_sharpe
    )
    return {"session_id": session_id, "status": "RUNNING"}

@app.get("/api/studio/evolve/status/{session_id}")
async def get_studio_evolve_status(session_id: str):
    session = ClosedLoopStudioOptimizer.get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Evolution session not found"})
    return session

@app.post("/api/studio/evolve/stop/{session_id}")
async def stop_studio_evolve(session_id: str):
    success = ClosedLoopStudioOptimizer.stop_session(session_id)
    return {"session_id": session_id, "stopped": success}

@app.post("/api/studio/evolve/submit/{session_id}")
async def submit_studio_evolved_alpha(session_id: str, request: Request):
    sess = get_current_session(request)
    client = sess.get("client")
    if not client:
        return JSONResponse(status_code=401, content={"error": "Not authenticated. Please login."})
    
    session = ClosedLoopStudioOptimizer.get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Evolution session not found"})
    
    alpha_id = session.get("submittable_alpha_id")
    if not alpha_id:
        return JSONResponse(status_code=400, content={"error": "Session has not produced a submittable alpha yet."})
    
    try:
        res = client.submit_alpha(alpha_id)
        return {"success": True, "alpha_id": alpha_id, "result": res}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/export-csv")
async def export_csv(tier: Optional[str] = None, submittable_only: bool = False, today_only: bool = False, date: Optional[str] = None):
    with get_db_connection() as conn:
        c = conn.cursor()
        query = "SELECT id, sharpe, fitness, returns, turnover, margin, drawdown, universe, delay, decay, neutralization, is_submittable, submission_status, max_self_correlation, expression, evaluated_at FROM alphas WHERE 1=1"
        params = []
        if today_only:
            target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            query += " AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))"
            params.append(target_date)
        if submittable_only:
            query += " AND is_submittable = 1"
        if tier == "spectacular":
            query += " AND fitness >= 2.50"
        elif tier == "excellent":
            query += " AND fitness >= 2.00 AND fitness < 2.50"
        query += " ORDER BY fitness DESC"
        c.execute(query, params)
        rows = c.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "sharpe", "fitness", "returns_pct", "turnover_pct", "margin_bps", "drawdown_pct", "universe", "delay", "decay", "neutralization", "is_submittable", "submission_status", "max_self_correlation", "expression", "evaluated_at"])

    for r in rows:
        writer.writerow([
            r["id"],
            r["sharpe"],
            r["fitness"],
            round((r["returns"] or 0) * 100, 2),
            round((r["turnover"] or 0) * 100, 2),
            round((r["margin"] or 0) * 10000, 2),
            round((r["drawdown"] or 0) * 100, 2),
            r["universe"],
            r["delay"],
            r["decay"],
            r["neutralization"],
            r["is_submittable"],
            r["submission_status"],
            r["max_self_correlation"],
            r["expression"],
            r["evaluated_at"]
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=worldquant_alphas_vault.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("web.server:app", host=host, port=port, reload=True)
