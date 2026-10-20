import os
import time
import random
import logging
import threading
import requests
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from .config import PipelineConfig

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

logger = logging.getLogger(__name__)

class BrainClient:
    """Client for interacting with the WorldQuant BRAIN API."""
    def __init__(
        self,
        config: Optional[PipelineConfig] = None,
        email: Optional[str] = None,
        password: Optional[str] = None
    ):
        self.config = config or PipelineConfig()
        self.email = (email or os.getenv("BRAIN_EMAIL") or "").strip()
        self.password = (password or os.getenv("BRAIN_PASSWORD") or "").strip()
        
        if not self.email or not self.password:
            raise ValueError("WorldQuant BRAIN credentials missing. Provide BRAIN_EMAIL and BRAIN_PASSWORD in .env or pass directly to BrainClient.")
            
        self._lock = threading.Lock()
        self.session = requests.Session()
        self.authenticate()

    def authenticate(self) -> None:
        """Authenticates with the WorldQuant BRAIN API."""
        with self._lock:
            url = f"{self.config.api_base}/authentication"
            resp = self.session.post(url, auth=(self.email, self.password), timeout=30)
            if resp.status_code not in (200, 201):
                raise RuntimeError(f"Authentication failed ({resp.status_code}): {resp.text}")
            logger.info("[✓] Successfully authenticated with WorldQuant BRAIN API.")

    def _request_with_retry(self, method: str, url: str, **kwargs) -> requests.Response:
        """Executes HTTP request with retry on 429 (rate-limit) and auto-reauth on 401."""
        max_retries = 8
        kwargs.setdefault('timeout', 30)
        for attempt in range(max_retries):
            try:
                with self._lock:
                    resp = self.session.request(method, url, **kwargs)
                if resp.status_code == 401:
                    logger.warning("[!] Session expired (401). Re-authenticating...")
                    self.authenticate()
                    continue
                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", random.uniform(5, 10)))
                    logger.warning(f"[!] Rate limited (429). Backing off for {retry_after:.1f}s...")
                    time.sleep(retry_after)
                    continue
                return resp
            except requests.RequestException as e:
                logger.warning(f"[!] Request error ({e}). Retrying {attempt + 1}/{max_retries}...")
                time.sleep(min(30.0, 2 ** attempt + random.uniform(0.5, 1.5)))
        try:
            with self._lock:
                return self.session.request(method, url, **kwargs)
        except Exception as e:
            logger.error(f"[!] Request failed after retries: {e}")
            resp = requests.Response()
            resp.status_code = 500
            resp._content = b'{}'
            return resp

    def dispatch_simulation(self, spec: Dict[str, Any]) -> Optional[str]:
        """
        Submits an alpha simulation task to the WorldQuant BRAIN platform.
        Returns the progress polling URL or None.
        """
        url = f"{self.config.api_base}/simulations"
        resp = self._request_with_retry("POST", url, json=spec)
        if resp.status_code != 201:
            logger.error(f"[!] Failed to dispatch simulation ({resp.status_code}): {resp.text}")
            return None
        
        progress_url = resp.headers.get("Location")
        if not progress_url:
            data = resp.json()
            progress_url = data.get("location") or f"{self.config.api_base}/simulations/{data.get('id')}"
        return progress_url

    def wait_for_simulation(self, progress_url: str, alpha_name: str = "Alpha") -> Optional[str]:
        """
        Polls the simulation progress until complete or timeout.
        Returns the resulting alpha ID.
        """
        start_time = time.time()
        while time.time() - start_time < self.config.simulation_timeout:
            resp = self._request_with_retry("GET", progress_url)
            if resp.status_code != 200:
                time.sleep(self.config.poll_interval)
                continue
                
            retry_after = resp.headers.get("Retry-After")
            poll_wait = float(retry_after) if retry_after else self.config.poll_interval
            
            data = resp.json()
            status = data.get("status")
            
            if status in ("COMPLETE", "DONE", "FINISHED"):
                return data.get("alpha")
            elif status in ("ERROR", "FAIL", "FAILED"):
                logger.error(f"[!] Simulation failed for {alpha_name}: {data.get('message', 'Unknown error')}")
                return None
                
            time.sleep(poll_wait)
            
        logger.error(f"[!] Simulation timed out for {alpha_name}.")
        return None

    def fetch_alpha(self, alpha_id: str) -> Optional[Dict[str, Any]]:
        """Fetches full alpha record and metrics from WorldQuant BRAIN."""
        url = f"{self.config.api_base}/alphas/{alpha_id}"
        resp = self._request_with_retry("GET", url)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"[!] Failed to fetch alpha {alpha_id} ({resp.status_code}): {resp.text}")
        return None

    def run_platform_checks(self, alpha_id: str) -> Optional[Dict[str, Any]]:
        """
        Polls /alphas/{alpha_id}/check which computes all platform checks,
        including SELF_CORRELATION, asynchronously.
        """
        url = f"{self.config.api_base}/alphas/{alpha_id}/check"
        start_time = time.time()
        while time.time() - start_time < self.config.check_timeout:
            resp = self._request_with_retry("GET", url)
            if resp.status_code == 200 and resp.text.strip():
                try:
                    return resp.json()
                except Exception:
                    pass
            retry_after = float(resp.headers.get("Retry-After", 1.5))
            time.sleep(retry_after)
        return None

    def fetch_unsubmitted_alphas(
        self,
        limit: int = 20,
        offset: int = 0,
        min_sharpe: Optional[float] = None,
        min_fitness: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Fetches unsubmitted alphas already saved under the user account.
        """
        url = f"{self.config.api_base}/users/self/alphas"
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "status": "UNSUBMITTED",
            "order": "-dateCreated",
            "hidden": "false"
        }
        if min_sharpe is not None:
            params["is.sharpe>"] = min_sharpe
        if min_fitness is not None:
            params["is.fitness>"] = min_fitness

        resp = self._request_with_retry("GET", url, params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"[!] Failed to fetch unsubmitted alphas ({resp.status_code}): {resp.text}")
        return {"count": 0, "results": []}

    def simulate_candidate(self, candidate: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        High-level wrapper to simulate one candidate specification, wait for it,
        and return the raw alpha data.
        """
        name = candidate.get("name", "Unnamed")
        expr = candidate.get("expr") or candidate.get("code")
        if not expr:
            logger.error(f"[!] Candidate {name} has no expression.")
            return None

        spec = {
            "type": "REGULAR",
            "settings": {
                "instrumentType": candidate.get("instrumentType", self.config.default_instrument_type),
                "region": candidate.get("region", self.config.default_region),
                "universe": candidate.get("universe", self.config.default_universe),
                "delay": candidate.get("delay", self.config.default_delay),
                "decay": candidate.get("decay", self.config.default_decay),
                "neutralization": candidate.get("neutralization", self.config.default_neutralization),
                "truncation": candidate.get("truncation", self.config.default_truncation),
                "pasteurization": candidate.get("pasteurization", self.config.default_pasteurization),
                "unitHandling": candidate.get("unitHandling", self.config.default_unit_handling),
                "nanHandling": candidate.get("nanHandling", self.config.default_nan_handling),
                "language": candidate.get("language", self.config.default_language),
                "visualization": False
            },
            "regular": expr
        }

        progress_url = self.dispatch_simulation(spec)
        if not progress_url:
            return None

        alpha_id = self.wait_for_simulation(progress_url, alpha_name=name)
        if not alpha_id:
            return None

        return self.fetch_alpha(alpha_id)

    def fetch_datasets(self, region: str = "USA", universe: str = "TOP3000", delay: int = 1, limit: int = 50) -> Dict[str, Any]:
        """Fetches available datasets from WorldQuant BRAIN."""
        url = f"{self.config.api_base}/data-sets"
        params = {
            "instrumentType": "EQUITY",
            "region": region,
            "delay": delay,
            "universe": universe,
            "limit": limit
        }
        resp = self._request_with_retry("GET", url, params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"[!] Failed to fetch datasets ({resp.status_code}): {resp.text}")
        return {"count": 0, "results": []}

    def fetch_data_fields(self, search: str = "", dataset_id: str = "", category: str = "", region: str = "USA", universe: str = "TOP3000", delay: int = 1, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Fetches data fields for a specific dataset or search term."""
        url = f"{self.config.api_base}/data-fields"
        params = {
            "instrumentType": "EQUITY",
            "region": region,
            "universe": universe,
            "delay": delay,
            "limit": limit,
            "offset": offset,
            "dataset.id": dataset_id if dataset_id and dataset_id != "ALL" else None,
            "search": search if search else None,
            "category": category if category and category != "ALL" else None
        }
        params = {k: v for k, v in params.items() if v is not None}
        
        resp = self._request_with_retry("GET", url, params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"[!] Failed to fetch data fields ({resp.status_code}): {resp.text}")
        return {"count": 0, "results": []}

    def fetch_alphas(self, limit: int = 50, offset: int = 0, status: Optional[str] = None) -> Dict[str, Any]:
        """Fetches alphas under the user account, optionally filtered by status."""
        url = f"{self.config.api_base}/users/self/alphas"
        params: Dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "order": "-dateCreated",
            "hidden": "false"
        }
        if status:
            params["status"] = status

        resp = self._request_with_retry("GET", url, params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"[!] Failed to fetch alphas ({resp.status_code}): {resp.text}")
        return {"count": 0, "results": []}

    def submit_alpha(self, alpha_id: str) -> Dict[str, Any]:
        """Submits an alpha to WorldQuant BRAIN."""
        url = f"{self.config.api_base}/alphas/{alpha_id}/submit"
        logger.info(f"[*] Submitting alpha {alpha_id} to WorldQuant BRAIN...")
        resp = self._request_with_retry("POST", url)
        if resp.status_code in (200, 201):
            logger.info(f"[✓] Alpha {alpha_id} successfully submitted!")
            return {"success": True, "status_code": resp.status_code, "data": resp.text}
        else:
            logger.error(f"[!] Alpha submission failed ({resp.status_code}): {resp.text}")
            return {"success": False, "status_code": resp.status_code, "error": resp.text}

    def fetch_user_profile(self) -> Dict[str, Any]:
        """Fetches the authenticated user's profile and rank level from WorldQuant BRAIN."""
        url = f"{self.config.api_base}/users/self"
        resp = self._request_with_retry("GET", url)
        if resp.status_code == 200:
            try:
                data = resp.json()
                full_name = (
                    data.get("fullName")
                    or f"{data.get('firstName', '')} {data.get('lastName', '')}".strip()
                    or (self.email.split("@")[0].replace(".", " ").title() if self.email else "Quant Researcher")
                )
                raw_level = str(data.get("level") or data.get("tier") or "BRONZE").strip().upper()
                if "GOLD" in raw_level:
                    level = "GOLD"
                elif "SILVER" in raw_level:
                    level = "SILVER"
                elif "CONSULTANT" in raw_level or "PLATINUM" in raw_level or "ELITE" in raw_level:
                    level = "CONSULTANT"
                else:
                    level = "BRONZE"
                return {
                    "id": data.get("id") or "WQ-USER",
                    "fullName": full_name,
                    "email": data.get("email") or self.email,
                    "level": level,
                }
            except Exception as e:
                logger.warning(f"[!] Failed to parse /users/self profile: {e}")
        return {}

    def sync_user_alphas(self, db: Any, max_unsubmitted: int = 300) -> Dict[str, Any]:
        """
        Pulls all active (submitted) alphas, unsubmitted draft alphas, and user profile
        standing from the user's WorldQuant BRAIN account and persists them into AlphaDatabase.
        """
        logger.info("[*] Initiating full alpha & profile sync from WorldQuant BRAIN API...")
        active_count = 0
        unsubmitted_count = 0
        profile_info: Dict[str, Any] = {}

        # 0. Fetch latest user profile & rank standing (/users/self)
        try:
            profile_info = self.fetch_user_profile()
        except Exception as e:
            logger.warning(f"[!] Could not refresh user profile during sync: {e}")

        # 1. Fetch active (submitted) portfolio alphas
        try:
            offset = 0
            while True:
                resp = self.fetch_alphas(limit=100, offset=offset, status="ACTIVE")
                alphas = resp.get("results", [])
                if not alphas:
                    break
                for a in alphas:
                    if db.save_cloud_alpha(a):
                        active_count += 1
                if len(alphas) < 100 or offset + len(alphas) >= resp.get("count", 0):
                    break
                offset += 100
            logger.info(f"[✓] Synced {active_count} ACTIVE portfolio alphas from BRAIN.")
        except Exception as e:
            logger.error(f"[!] Error syncing ACTIVE alphas: {e}")

        # 2. Fetch unsubmitted draft alphas (up to max_unsubmitted)
        try:
            offset = 0
            while unsubmitted_count < max_unsubmitted:
                fetch_limit = min(100, max_unsubmitted - unsubmitted_count)
                resp = self.fetch_alphas(limit=fetch_limit, offset=offset, status="UNSUBMITTED")
                alphas = resp.get("results", [])
                if not alphas:
                    break
                for a in alphas:
                    if db.save_cloud_alpha(a):
                        unsubmitted_count += 1
                if len(alphas) < fetch_limit or offset + len(alphas) >= resp.get("count", 0):
                    break
                offset += len(alphas)
            logger.info(f"[✓] Synced {unsubmitted_count} UNSUBMITTED alphas from BRAIN.")
        except Exception as e:
            logger.error(f"[!] Error syncing UNSUBMITTED alphas: {e}")

        if hasattr(db, "save_sync_meta"):
            try:
                db.save_sync_meta(
                    active_synced=active_count,
                    unsubmitted_synced=unsubmitted_count,
                    user_profile=profile_info
                )
            except Exception as e:
                logger.warning(f"[!] Could not save sync metadata: {e}")

        return {
            "success": True,
            "active_synced": active_count,
            "unsubmitted_synced": unsubmitted_count,
            "total_synced": active_count + unsubmitted_count,
            "user_profile": profile_info
        }
