"""Alpha Factory: Generator of Complex, Multi-Layered, Unique Alphas for WorldQuant BRAIN.

Generates institutional-grade, multi-term alpha expressions combining:
- Multi-factor model scores & derivatives (model16)
- Risk and idiosyncratic volatility conditioning (model51)
- Analyst consensus revisions & expectations (analyst4)
- Social media sentiment & attention dynamics (socialmedia8)
- Price-volume microstructure & flow imbalances (pv1)
- Implied vs historical volatility surfaces (option8, option9)
- Graph network centrality (pv13)
"""

from typing import List, Dict, Any

class AlphaFactory:
    """Generates unique, multi-layered institutional alpha candidates."""

    @staticmethod
    def get_institutional_v2_candidates() -> List[Dict[str, Any]]:
        """Generates verified Spectacular/Excellent candidates using InstitutionalQuantEngine V2."""
        from .engine_institutional import InstitutionalQuantEngine
        return [
            InstitutionalQuantEngine.generate_candidate(archetype_idx=0, universe="TOP3000", decay=24),
            InstitutionalQuantEngine.generate_candidate(archetype_idx=1, universe="TOP1000", decay=22),
            InstitutionalQuantEngine.generate_candidate(archetype_idx=2, universe="TOP2000", decay=22)
        ]

    @staticmethod
    def get_complex_candidates() -> List[Dict[str, Any]]:
        candidates = [
            # 1. Multi-Layer Quality & Idiosyncratic Risk Dampened Momentum
            {
                "name": "Multi-Layer Quality & Idiosyncratic Risk Filtered Reversal",
                "expr": "group_neutralize(rank(fscore_quality) * rank(fscore_profitability) / (1 + rank(unsystematic_risk_last_60_days)), subindustry) * rank(-ts_delta(close, 5))",
                "decay": 10,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Multi-Factor Quality"
            },
            # 2. Pentagon Surface Acceleration & Trend Divergence
            {
                "name": "Pentagon Style Surface Acceleration & Momentum",
                "expr": "group_neutralize(rank(fscore_surface_accel) * rank(fscore_momentum), subindustry) * rank(-ts_delta(close, 4))",
                "decay": 8,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Factor Acceleration"
            },
            # 3. Analyst EPS Consensus Revision with Quality Synergy
            {
                "name": "Analyst EPS Revision Momentum & Quality Interaction",
                "expr": "group_neutralize(rank(ts_delta(anl4_afv4_eps_mean, 60)) * rank(fscore_quality), subindustry) * rank(-ts_delta(close, 4))",
                "decay": 8,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Analyst Synergy"
            },
            # 4. Volatility Risk Premium (Implied vs Historical Volatility Spread)
            {
                "name": "Volatility Risk Premium Spread & Reversal",
                "expr": "group_neutralize(rank((implied_volatility_call_30 - historical_volatility_30) / (historical_volatility_30 + 0.001)), subindustry) * rank(-ts_delta(close, 5))",
                "decay": 10,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Options Volatility"
            },
            # 5. Long-Short Analyst Revisions Net Ratio with Volume Confirmation
            {
                "name": "Net Upward Analyst Revision Ratio with Short-Term Liquidity Rebound",
                "expr": "group_neutralize(rank((anl4_ady_pu - anl4_ady_down) / (anl4_ady_pu + anl4_ady_down + 1)), subindustry) * rank(-ts_delta(close, 3))",
                "decay": 8,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Analyst Revisions"
            },
            # 6. Microstructure Normalized Gap Flow & Intraday Pressure
            {
                "name": "Microstructure Normalized Overnight Gap & Range Rebound",
                "expr": "group_neutralize(rank((open - ts_delay(close, 1)) / (high - low + 0.0001)) - rank((close - open) / (high - low + 0.0001)), subindustry) * rank(-ts_delta(close, 3))",
                "decay": 12,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Microstructure"
            },
            # 7. Multi-Horizon Analyst EPS Revision Acceleration
            {
                "name": "Analyst EPS Revision Acceleration Multi-Horizon",
                "expr": "group_neutralize(rank(ts_delta(anl4_afv4_eps_mean, 30) - ts_delay(ts_delta(anl4_afv4_eps_mean, 30), 30)), subindustry) * rank(-ts_delta(close, 5))",
                "decay": 10,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Analyst Acceleration"
            },
            # 8. Competitor Network Centrality & Fundamental Profitability
            {
                "name": "Network PageRank Centrality & Profitability Momentum",
                "expr": "group_neutralize(rank(pv13_com_page_rank) * rank(fscore_profitability), subindustry) * rank(-ts_delta(close, 5))",
                "decay": 10,
                "delay": 1,
                "universe": "TOP3000",
                "region": "USA",
                "neutralization": "SUBINDUSTRY",
                "category": "Network Centrality"
            }
        ]
        return candidates

if __name__ == "__main__":
    import json
    cands = AlphaFactory.get_complex_candidates()
    print(f"Generated {len(cands)} complex institutional alpha specifications:")
    for c in cands:
        print(f"[{c['category']}] {c['name']}")
        print(f"  Expr: {c['expr']}")
        print(f"  Decay: {c['decay']} | Neut: {c['neutralization']}")
