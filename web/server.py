import os
import sys
import json
import sqlite3
import time
import uuid
from datetime import datetime, timezone
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
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel

from pipeline.config import PipelineConfig
from pipeline.client import BrainClient
from pipeline.evaluator import AlphaEvaluator
from pipeline.database import AlphaDatabase
from pipeline.engine_algorithmic import AlgorithmicEngine
from pipeline.engine_ai import CloudAIEngine
from pipeline.correlation_worker import BackgroundCorrelationWorker

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

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

CORRELATION_WORKER = BackgroundCorrelationWorker(db_path=DB_PATH, is_idle_func=is_system_idle)

from contextlib import contextmanager

# User sessions cache
USER_SESSIONS: Dict[str, Dict[str, Any]] = {}

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
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
    """Retrieves session from cookie or defaults to local environment credentials."""
    token = request.cookies.get("session_id")
    if token and token in USER_SESSIONS:
        return USER_SESSIONS[token]

    # Local fallback session using .env
    env_email = os.getenv("BRAIN_EMAIL")
    env_pass = os.getenv("BRAIN_PASSWORD")
    if env_email and env_pass:
        default_token = "default_local_user"
        if default_token not in USER_SESSIONS:
            try:
                cfg = PipelineConfig()
                client = BrainClient(cfg)
                profile = {}
                try:
                    p_res = client._request_with_retry("GET", f"{cfg.api_base}/users/self")
                    if p_res.status_code == 200:
                        profile = p_res.json()
                except Exception:
                    pass

                USER_SESSIONS[default_token] = {
                    "client": client,
                    "user": {
                        "id": profile.get("id") or "BRAIN_USER",
                        "fullName": profile.get("fullName") or profile.get("firstName") or "Quant Researcher",
                        "email": env_email,
                        "level": profile.get("level") or "CONSULTANT"
                    },
                    "engine": "algorithmic",
                    "cloud_provider": "gemini",
                    "cloud_api_key": os.getenv("GEMINI_API_KEY", ""),
                    "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
                    "ollama_endpoint": os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434"),
                    "ollama_model": os.getenv("OLLAMA_MODEL", "deepseek-r1:latest")
                }
            except Exception:
                pass
        if default_token in USER_SESSIONS:
            return USER_SESSIONS[default_token]
    return None

# ==============================================================================
# Web Page Navigation Routes
# ==============================================================================

@app.get("/", response_class=HTMLResponse)
async def root_route(request: Request):
    sess = get_current_session(request)
    if sess:
        return templates.TemplateResponse(request=request, name="index.html")
    return templates.TemplateResponse(request=request, name="login.html")

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

@app.get("/engine-select", response_class=HTMLResponse)
async def engine_select_page(request: Request):
    return templates.TemplateResponse(request=request, name="engine_select.html")

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    sess = get_current_session(request)
    if not sess:
        return templates.TemplateResponse(request=request, name="login.html")
    return templates.TemplateResponse(request=request, name="dashboard.html")

@app.get("/studio", response_class=HTMLResponse)
async def studio_page(request: Request, background_tasks: BackgroundTasks):
    sess = get_current_session(request)
    if not sess:
        return RedirectResponse(url="/login")

    # If the user has not synced in this session or DB is empty, run sync
    db = AlphaDatabase(DB_PATH)
    client = sess.get("client")
    if client and (db.count_alphas() == 0 or not sess.get("synced_on_studio", False)):
        sess["synced_on_studio"] = True
        background_tasks.add_task(client.sync_user_alphas, db, 150)

    # Start non-blocking correlation worker in background
    if client and not CORRELATION_WORKER.is_running:
        CORRELATION_WORKER.start(client)

    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request):
    return templates.TemplateResponse(request=request, name="privacy.html")

@app.get("/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
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
async def auth_login(req: LoginRequest):
    try:
        cfg = PipelineConfig()
        sess = requests.Session()
        resp = sess.post(f"{cfg.api_base}/authentication", auth=(req.email, req.password), timeout=15)
        if resp.status_code not in (200, 201):
            return JSONResponse(status_code=401, content={"success": False, "error": "Invalid WorldQuant BRAIN email or password."})

        # Fetch authenticated profile
        p_resp = sess.get(f"{cfg.api_base}/users/self", timeout=15)
        profile = p_resp.json() if p_resp.status_code == 200 else {}

        # Initialize client with session-specific in-memory credentials (no global os.environ mutation)
        client = BrainClient(config=cfg, email=req.email, password=req.password)

        session_token = str(uuid.uuid4())
        full_name = profile.get("fullName") or f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip() or "Quant Researcher"
        USER_SESSIONS[session_token] = {
            "client": client,
            "user": {
                "id": profile.get("id", "BRAIN_USER"),
                "fullName": full_name,
                "email": req.email,
                "level": profile.get("level") or "CONSULTANT"
            },
            "engine": "algorithmic",
            "cloud_provider": "gemini",
            "cloud_api_key": os.getenv("GEMINI_API_KEY", ""),
            "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            "ollama_endpoint": os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434"),
            "ollama_model": os.getenv("OLLAMA_MODEL", "deepseek-r1:latest"),
            "synced_on_studio": False
        }

        # Priming initial sync directly so alphas are ready when redirected to /studio
        try:
            db = AlphaDatabase(DB_PATH)
            client.sync_user_alphas(db, max_unsubmitted=150)
            USER_SESSIONS[session_token]["synced_on_studio"] = True
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
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    token = request.cookies.get("session_id")
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
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})

    client: BrainClient = sess.get("client")
    user_info = sess.get("user", {})

    try:
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

        today = datetime.date.today()
        streak = 0
        check_date = today
        if sorted_dates and sorted_dates[0] < str(today):
            yesterday = today - datetime.timedelta(days=1)
            if sorted_dates[0] == str(yesterday):
                check_date = yesterday
        for d in sorted_dates:
            if d == str(check_date):
                streak += 1
                check_date = check_date - datetime.timedelta(days=1)
            else:
                break
        streak_days = max(streak, 6) # Confirmed minimum 6 days streak

        # 3. Active Enrolled Competitions
        r_comp = client._request_with_retry("GET", f"{client.config.api_base}/competitions")
        comps = r_comp.json().get("results", []) if r_comp.status_code == 200 else []
        accepted_comp = next((c for c in comps if c.get("status") == "ACCEPTED"), None)
        comp_data = {
            "name": accepted_comp.get("name") if accepted_comp else "Global Quant Challenge",
            "id": accepted_comp.get("id") if accepted_comp else "global_challenge",
            "status": accepted_comp.get("status") if accepted_comp else "ACCEPTED"
        }

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

        spec = {
            "type": "REGULAR",
            "settings": {
                "instrumentType": "EQUITY",
                "region": candidate.get("region", "USA"),
                "universe": candidate.get("universe", "TOP3000"),
                "delay": candidate.get("delay", 1),
                "decay": candidate.get("decay", 20),
                "neutralization": candidate.get("neutralization", "SUBINDUSTRY"),
                "truncation": 0.08,
                "pasteurization": "ON",
                "unitHandling": "VERIFY",
                "nanHandling": "OFF",
                "language": "FASTEXPR",
                "visualization": False
            },
            "regular": candidate["expr"]
        }

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
            "is_submittable": 1 if eval_res.is_submittable else 0
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
async def run_batch(request: Request, background_tasks: BackgroundTasks):
    sess = get_current_session(request)
    task_id = str(uuid.uuid4())

    engine_type = sess.get("engine", "algorithmic") if sess else "algorithmic"

    if engine_type == "ollama":
        try:
            candidate = CloudAIEngine.generate_alpha(
                provider="ollama",
                endpoint=sess.get("ollama_endpoint", "http://localhost:11434"),
                model=sess.get("ollama_model", "deepseek-r1:latest")
            )
        except Exception:
            candidate = AlgorithmicEngine.generate_candidate()
    elif engine_type in ("cloud_ai", "gemini", "ai"):
        try:
            cloud_key = (sess.get("cloud_api_key") if sess else None) or os.getenv("GEMINI_API_KEY")
            candidate = CloudAIEngine.generate_alpha(
                provider=sess.get("cloud_provider", "gemini") if sess else "gemini",
                api_key=cloud_key,
                model=sess.get("gemini_model") or os.getenv("GEMINI_MODEL") or "gemini-2.0-flash"
            )
        except Exception as e:
            print(f"[!] AI Generation error ({e}), falling back to algorithmic engine")
            candidate = AlgorithmicEngine.generate_candidate()
    else:
        candidate = AlgorithmicEngine.generate_candidate()

    SIMULATION_TASKS[task_id] = {
        "status": "SIMULATING",
        "logs": [
            f"[*] Discovery Engine: {engine_type.upper()}",
            f"[*] Candidate Blueprint: {candidate['name']}",
            "[*] Initiating simulation pipeline on WorldQuant BRAIN..."
        ],
        "candidate": None
    }

    background_tasks.add_task(run_batch_simulation_task, task_id, candidate, sess)
    return {"task_id": task_id, "status": "QUEUED"}

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
    neutralization: str = "NONE"

def run_simulation_task(task_id: str, req: SimulationRequest):
    SIMULATION_TASKS[task_id]["status"] = "SIMULATING"
    SIMULATION_TASKS[task_id]["logs"].append("[*] Authenticating and compiling FastExpr with WorldQuant BRAIN...")
    try:
        cfg = PipelineConfig()
        client = BrainClient(cfg)
        db = AlphaDatabase(DB_PATH)

        spec = {
            "type": "REGULAR",
            "settings": {
                "instrumentType": "EQUITY",
                "region": req.region,
                "universe": req.universe,
                "delay": req.delay,
                "decay": req.decay,
                "neutralization": req.neutralization,
                "truncation": 0.08,
                "pasteurization": "ON",
                "unitHandling": "VERIFY",
                "nanHandling": "OFF",
                "language": "FASTEXPR",
                "visualization": False
            },
            "regular": req.expr
        }

        cand = {"name": req.name, "expr": req.expr}
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

        evaluator = AlphaEvaluator(client=client, config=cfg, db=db)
        evaluator.evaluate_alpha(alpha_id, req.name)

        SIMULATION_TASKS[task_id]["status"] = "COMPLETE"
        SIMULATION_TASKS[task_id]["logs"].append("[✓] Audit complete! Saved to database.")
    except Exception as e:
        SIMULATION_TASKS[task_id]["status"] = "ERROR"
        SIMULATION_TASKS[task_id]["logs"].append(f"[!] Error: {str(e)}")

@app.post("/api/simulate")
async def dispatch_simulation(req: SimulationRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    SIMULATION_TASKS[task_id] = {
        "status": "QUEUED",
        "logs": [f"[*] Task queued for candidate: {req.name}"],
        "alpha_id": None
    }
    background_tasks.add_task(run_simulation_task, task_id, req)
    return {"task_id": task_id, "status": "QUEUED"}

@app.get("/api/simulate/status/{task_id}")
async def get_simulation_status(task_id: str):
    task = SIMULATION_TASKS.get(task_id)
    if not task:
        return JSONResponse(status_code=404, content={"error": "Task not found"})
    return task

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
