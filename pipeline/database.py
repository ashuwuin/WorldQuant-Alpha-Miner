import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from contextlib import contextmanager

class AlphaDatabase:
    """
    SQLite persistent storage for tracking all evaluated WorldQuant BRAIN alphas,
    their metrics, check results, submittability status, and sync metadata.
    """
    def __init__(self, db_path: str = "alphas_audit.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA busy_timeout = 30000;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS alphas (
                    id TEXT PRIMARY KEY,
                    expression TEXT NOT NULL,
                    region TEXT,
                    universe TEXT,
                    delay INTEGER,
                    decay INTEGER,
                    neutralization TEXT,
                    sharpe REAL,
                    fitness REAL,
                    turnover REAL,
                    returns REAL,
                    drawdown REAL,
                    margin REAL,
                    is_submittable INTEGER NOT NULL,
                    checks_summary TEXT,
                    fail_reasons TEXT,
                    max_self_correlation REAL,
                    correlation_checked INTEGER DEFAULT 0,
                    source TEXT,
                    submission_status TEXT DEFAULT 'UNSUBMITTED',
                    evaluated_at TEXT
                )
            """)
            # Safe schema migration for existing databases
            try:
                conn.execute("ALTER TABLE alphas ADD COLUMN correlation_checked INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_sync_meta (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    user_id TEXT,
                    full_name TEXT,
                    email TEXT,
                    level TEXT,
                    active_synced INTEGER DEFAULT 0,
                    unsubmitted_synced INTEGER DEFAULT 0,
                    last_synced_at TEXT
                )
            """)

            conn.execute("CREATE INDEX IF NOT EXISTS idx_submittable ON alphas(is_submittable)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_source ON alphas(source)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_corr_checked ON alphas(correlation_checked, submission_status)")
            conn.commit()

    def save_sync_meta(
        self,
        active_synced: int,
        unsubmitted_synced: int,
        user_profile: Optional[Dict[str, Any]] = None
    ) -> None:
        """Persists latest WorldQuant BRAIN sync metadata and user standing."""
        now_str = datetime.now(timezone.utc).isoformat()
        profile = user_profile or {}
        with self._get_connection() as conn:
            existing = conn.execute("SELECT * FROM user_sync_meta WHERE id = 1").fetchone()
            ex = dict(existing) if existing else {}
            conn.execute("""
                INSERT INTO user_sync_meta (
                    id, user_id, full_name, email, level,
                    active_synced, unsubmitted_synced, last_synced_at
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = COALESCE(excluded.user_id, user_sync_meta.user_id),
                    full_name = COALESCE(excluded.full_name, user_sync_meta.full_name),
                    email = COALESCE(excluded.email, user_sync_meta.email),
                    level = COALESCE(excluded.level, user_sync_meta.level),
                    active_synced = excluded.active_synced,
                    unsubmitted_synced = excluded.unsubmitted_synced,
                    last_synced_at = excluded.last_synced_at
            """, (
                profile.get("id") or ex.get("user_id") or "WQ-USER",
                profile.get("fullName") or ex.get("full_name") or "Quant Researcher",
                profile.get("email") or ex.get("email") or "",
                profile.get("level") or ex.get("level") or "BRONZE",
                active_synced,
                unsubmitted_synced,
                now_str
            ))
            conn.commit()

    def get_sync_meta(self) -> Dict[str, Any]:
        """Returns the persisted WorldQuant BRAIN sync metadata."""
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM user_sync_meta WHERE id = 1").fetchone()
            return dict(row) if row else {}

    def save_evaluation(self, res: Dict[str, Any], source: str = "local_simulation") -> None:
        """Saves or updates an alpha evaluation record."""
        now_str = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO alphas (
                    id, expression, region, universe, delay, decay, neutralization,
                    sharpe, fitness, turnover, returns, drawdown, margin,
                    is_submittable, checks_summary, fail_reasons, max_self_correlation,
                    source, submission_status, evaluated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    expression = excluded.expression,
                    region = excluded.region,
                    universe = excluded.universe,
                    delay = excluded.delay,
                    decay = excluded.decay,
                    neutralization = excluded.neutralization,
                    sharpe = excluded.sharpe,
                    fitness = excluded.fitness,
                    turnover = excluded.turnover,
                    returns = excluded.returns,
                    drawdown = excluded.drawdown,
                    margin = excluded.margin,
                    is_submittable = excluded.is_submittable,
                    checks_summary = excluded.checks_summary,
                    fail_reasons = excluded.fail_reasons,
                    max_self_correlation = excluded.max_self_correlation,
                    source = excluded.source,
                    evaluated_at = excluded.evaluated_at
            """, (
                res.get("id"),
                res.get("expression", ""),
                res.get("region"),
                res.get("universe"),
                res.get("delay"),
                res.get("decay"),
                res.get("neutralization"),
                res.get("sharpe"),
                res.get("fitness"),
                res.get("turnover"),
                res.get("returns"),
                res.get("drawdown"),
                res.get("margin"),
                1 if res.get("is_submittable") else 0,
                json.dumps(res.get("checks", [])),
                json.dumps(res.get("fail_reasons", [])),
                res.get("max_self_correlation"),
                source,
                res.get("status", "UNSUBMITTED"),
                now_str
            ))
            conn.commit()

    def get_alpha(self, alpha_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM alphas WHERE id = ?", (alpha_id,)).fetchone()
            if row:
                d = dict(row)
                d["checks_summary"] = json.loads(d["checks_summary"]) if d["checks_summary"] else []
                d["fail_reasons"] = json.loads(d["fail_reasons"]) if d["fail_reasons"] else []
                return d
            return None

    def list_submittable(self) -> List[Dict[str, Any]]:
        """List all alphas that passed all submittability checks."""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM alphas WHERE is_submittable = 1 ORDER BY sharpe DESC"
            ).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                d["checks_summary"] = json.loads(d["checks_summary"]) if d["checks_summary"] else []
                d["fail_reasons"] = json.loads(d["fail_reasons"]) if d["fail_reasons"] else []
                results.append(d)
            return results

    def update_submission_status(self, alpha_id: str, status: str = "SUBMITTED") -> None:
        """Updates the submission status of an alpha."""
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE alphas SET submission_status = ? WHERE id = ?",
                (status, alpha_id)
            )

    def count_alphas(self) -> int:
        """Returns the total number of alphas currently in the database."""
        with self._get_connection() as conn:
            return conn.execute("SELECT COUNT(*) FROM alphas").fetchone()[0]

    def save_cloud_alpha(self, raw: Dict[str, Any]) -> bool:
        """
        Parses and upserts an alpha record fetched from the WorldQuant BRAIN API.
        Handles both ACTIVE (submitted) and UNSUBMITTED (draft) alphas.
        """
        alpha_id = raw.get("id")
        if not alpha_id:
            return False

        regular = raw.get("regular") or {}
        expression = regular.get("code") or ""
        settings = raw.get("settings") or {}
        is_m = raw.get("is") or {}

        status_raw = str(raw.get("status") or "UNSUBMITTED").upper()
        is_active = (status_raw == "ACTIVE")
        submission_status = "SUBMITTED" if is_active else "UNSUBMITTED"
        source = "cloud_active" if is_active else "cloud_unsubmitted"

        checks = is_m.get("checks") or []
        fail_reasons = []
        for chk in checks:
            if isinstance(chk, dict) and chk.get("result") in ("FAIL", "ERROR"):
                name = chk.get("name", "CHECK")
                val = chk.get("value")
                limit = chk.get("limit")
                if val is not None and limit is not None:
                    fail_reasons.append(f"{name} ({val} vs {limit})")
                else:
                    fail_reasons.append(name)

        sharpe = is_m.get("sharpe")
        fitness = is_m.get("fitness")
        turnover = is_m.get("turnover")
        returns = is_m.get("returns")
        drawdown = is_m.get("drawdown")
        margin = is_m.get("margin")
        self_corr = is_m.get("selfCorrelation")

        if is_active:
            is_submittable = 1
        else:
            hurdles_pass = (
                len(fail_reasons) == 0 and
                (sharpe is not None and sharpe >= 1.25) and
                (fitness is not None and fitness >= 1.0) and
                (turnover is not None and 0.01 <= turnover <= 0.70)
            )
            is_submittable = 1 if hurdles_pass else 0

        corr_checked_val = 1 if is_active or self_corr is not None else 0
        date_str = raw.get("dateSubmitted") or raw.get("dateCreated") or datetime.now(timezone.utc).isoformat()

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO alphas (
                    id, expression, region, universe, delay, decay, neutralization,
                    sharpe, fitness, turnover, returns, drawdown, margin,
                    is_submittable, checks_summary, fail_reasons, max_self_correlation,
                    correlation_checked, source, submission_status, evaluated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    expression = excluded.expression,
                    region = excluded.region,
                    universe = excluded.universe,
                    delay = excluded.delay,
                    decay = excluded.decay,
                    neutralization = excluded.neutralization,
                    sharpe = excluded.sharpe,
                    fitness = excluded.fitness,
                    turnover = excluded.turnover,
                    returns = excluded.returns,
                    drawdown = excluded.drawdown,
                    margin = excluded.margin,
                    is_submittable = CASE 
                        WHEN alphas.correlation_checked = 1 THEN alphas.is_submittable 
                        ELSE excluded.is_submittable 
                    END,
                    checks_summary = CASE 
                        WHEN alphas.correlation_checked = 1 THEN alphas.checks_summary 
                        ELSE excluded.checks_summary 
                    END,
                    fail_reasons = CASE 
                        WHEN alphas.correlation_checked = 1 THEN alphas.fail_reasons 
                        ELSE excluded.fail_reasons 
                    END,
                    max_self_correlation = CASE 
                        WHEN alphas.correlation_checked = 1 THEN alphas.max_self_correlation 
                        ELSE excluded.max_self_correlation 
                    END,
                    correlation_checked = CASE 
                        WHEN alphas.correlation_checked = 1 THEN 1 
                        ELSE excluded.correlation_checked 
                    END,
                    source = excluded.source,
                    submission_status = excluded.submission_status,
                    evaluated_at = excluded.evaluated_at
            """, (
                alpha_id,
                expression,
                settings.get("region", "USA"),
                settings.get("universe", "TOP3000"),
                settings.get("delay", 1),
                settings.get("decay", 20),
                settings.get("neutralization", "NONE"),
                sharpe,
                fitness,
                turnover,
                returns,
                drawdown,
                margin,
                is_submittable,
                json.dumps(checks),
                json.dumps(fail_reasons),
                self_corr,
                corr_checked_val,
                source,
                submission_status,
                date_str
            ))
            conn.commit()
        return True

    def get_unchecked_unsubmitted_alphas(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns unsubmitted alphas that haven't had their correlation checked yet,
        prioritizing alphas that are currently marked submittable (or highest fitness).
        """
        with self._get_connection() as conn:
            rows = conn.execute("""
                SELECT * FROM alphas 
                WHERE submission_status = 'UNSUBMITTED' 
                  AND (correlation_checked IS NULL OR correlation_checked = 0)
                ORDER BY is_submittable DESC, fitness DESC
                LIMIT ?
            """, (limit,)).fetchall()
            return [dict(r) for r in rows]

    def update_correlation_result(
        self,
        alpha_id: str,
        max_correlation: Optional[float],
        passed: bool,
        fail_reason: Optional[str] = None,
        checks: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """
        Records the platform correlation check result locally on the device.
        If correlation failed, removes the alpha from submittable (is_submittable = 0).
        """
        with self._get_connection() as conn:
            row = conn.execute("SELECT is_submittable, fail_reasons, checks_summary FROM alphas WHERE id = ?", (alpha_id,)).fetchone()
            if not row:
                return

            current_is_submittable = row["is_submittable"]
            try:
                fail_reasons = json.loads(row["fail_reasons"]) if row["fail_reasons"] else []
            except Exception:
                fail_reasons = []

            # If correlation fails, remove from submittable
            new_submittable = current_is_submittable
            if not passed:
                new_submittable = 0
                reason = fail_reason or (f"SELF_CORRELATION failed (max: {max_correlation:.4f} >= 0.70)" if max_correlation is not None else "SELF_CORRELATION failed")
                if reason not in fail_reasons:
                    fail_reasons.append(reason)
            else:
                fail_reasons = [r for r in fail_reasons if not r.startswith("SELF_CORRELATION")]

            checks_json = json.dumps(checks) if checks is not None else row["checks_summary"]

            conn.execute("""
                UPDATE alphas 
                SET max_self_correlation = ?,
                    correlation_checked = 1,
                    is_submittable = ?,
                    fail_reasons = ?,
                    checks_summary = ?
                WHERE id = ?
            """, (
                max_correlation,
                new_submittable,
                json.dumps(fail_reasons),
                checks_json,
                alpha_id
            ))
            conn.commit()

    def get_correlation_progress(self) -> Dict[str, Any]:
        """Returns statistics on correlation check completion for unsubmitted alphas."""
        with self._get_connection() as conn:
            total_unsub = conn.execute(
                "SELECT COUNT(*) FROM alphas WHERE submission_status = 'UNSUBMITTED'"
            ).fetchone()[0]
            checked = conn.execute(
                "SELECT COUNT(*) FROM alphas WHERE submission_status = 'UNSUBMITTED' AND correlation_checked = 1"
            ).fetchone()[0]
            failed_corr = conn.execute("""
                SELECT COUNT(*) FROM alphas 
                WHERE submission_status = 'UNSUBMITTED' 
                  AND correlation_checked = 1 
                  AND (max_self_correlation >= 0.70 OR fail_reasons LIKE '%SELF_CORRELATION%')
            """).fetchone()[0]
            passed_corr = checked - failed_corr
            return {
                "total_unsubmitted": total_unsub,
                "checked_count": checked,
                "remaining_count": max(0, total_unsub - checked),
                "passed_count": max(0, passed_corr),
                "failed_count": failed_corr,
                "complete": (total_unsub > 0 and checked >= total_unsub)
            }

    def get_stats(self, today_only: bool = False, target_date: Optional[str] = None) -> Dict[str, Any]:
        """Returns overview stats of the database, optionally filtered to today only."""
        with self._get_connection() as conn:
            where_clause = ""
            params: List[Any] = []
            if today_only:
                today_str = target_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
                where_clause = " WHERE (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))"
                params = [today_str]

            def q(sql: str, p: List[Any] = params) -> Any:
                res = conn.execute(sql, p).fetchone()
                return res[0] if res else 0

            total = q(f"SELECT COUNT(*) FROM alphas{where_clause}")
            
            sub_where = f" WHERE is_submittable = 1 AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE is_submittable = 1"
            submittable = q(f"SELECT COUNT(*) FROM alphas{sub_where}")

            act_where = f" WHERE submission_status = 'SUBMITTED' AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE submission_status = 'SUBMITTED'"
            active = q(f"SELECT COUNT(*) FROM alphas{act_where}")

            unsub_where = f" WHERE submission_status = 'UNSUBMITTED' AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE submission_status = 'UNSUBMITTED'"
            unsubmitted = q(f"SELECT COUNT(*) FROM alphas{unsub_where}")

            spec_where = f" WHERE fitness >= 2.50 AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE fitness >= 2.50"
            spectacular = q(f"SELECT COUNT(*) FROM alphas{spec_where}")

            exc_where = f" WHERE fitness >= 2.00 AND fitness < 2.50 AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE fitness >= 2.00 AND fitness < 2.50"
            excellent = q(f"SELECT COUNT(*) FROM alphas{exc_where}")

            good_where = f" WHERE fitness >= 1.50 AND fitness < 2.00 AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE fitness >= 1.50 AND fitness < 2.00"
            good = q(f"SELECT COUNT(*) FROM alphas{good_where}")

            metrics_where = f" WHERE sharpe IS NOT NULL AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE sharpe IS NOT NULL"
            row = conn.execute(f"""
                SELECT MAX(sharpe), MAX(fitness), MAX(returns), MIN(drawdown)
                FROM alphas{metrics_where}
            """, params).fetchone()

            max_sharpe = (row[0] if row else None) or 0.0
            max_fitness = (row[1] if row else None) or 0.0
            max_returns = (row[2] if row else None) or 0.0
            min_drawdown = (row[3] if row else None) or 0.0

            lead_where = f" WHERE fitness IS NOT NULL AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))" if today_only else " WHERE fitness IS NOT NULL"
            leader_row = conn.execute(f"""
                SELECT id, fitness, sharpe FROM alphas{lead_where}
                ORDER BY fitness DESC LIMIT 1
            """, params).fetchone()

            leader_id = leader_row[0] if leader_row else None
            leader_fitness = leader_row[1] if leader_row else None
            leader_sharpe = leader_row[2] if leader_row else None

            # Calculate today counts for quick badges
            cur_today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            today_total = conn.execute("SELECT COUNT(*) FROM alphas WHERE (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))", (cur_today_str,)).fetchone()[0]
            today_active = conn.execute("SELECT COUNT(*) FROM alphas WHERE submission_status = 'SUBMITTED' AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))", (cur_today_str,)).fetchone()[0]
            today_submittable = conn.execute("SELECT COUNT(*) FROM alphas WHERE is_submittable = 1 AND (SUBSTR(evaluated_at, 1, 10) = ? OR DATE(evaluated_at) = DATE('now'))", (cur_today_str,)).fetchone()[0]

            return {
                "total": total,
                "submittable": submittable,
                "active": active,
                "unsubmitted": unsubmitted,
                "spectacular": spectacular,
                "excellent": excellent,
                "good": good,
                "max_sharpe": round(max_sharpe, 2),
                "max_fitness": round(max_fitness, 2),
                "max_returns_pct": round(max_returns * 100, 2),
                "min_drawdown_pct": round(min_drawdown * 100, 2),
                "leader_id": leader_id,
                "leader_fitness": round(leader_fitness, 2) if leader_fitness is not None else None,
                "leader_sharpe": round(leader_sharpe, 2) if leader_sharpe is not None else None,
                "today_total": today_total,
                "today_active": today_active,
                "today_submittable": today_submittable,
                "is_today_only": today_only
            }
