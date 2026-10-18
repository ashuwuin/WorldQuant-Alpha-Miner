"""
Quantum Alpha Studio - Command-Line Interface (CLI)
Automated alpha discovery, simulation, verification, and audit for WorldQuant BRAIN.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List

if __package__ is None or __package__ == "":
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from pipeline.config import PipelineConfig
    from pipeline.client import BrainClient
    from pipeline.evaluator import AlphaEvaluator
    from pipeline.database import AlphaDatabase
    from pipeline.reporter import PipelineReporter
    from pipeline.engine_algorithmic import AlgorithmicEngine
    from pipeline.engine_ai import CloudAIEngine
    from pipeline.engine_institutional import InstitutionalQuantEngine
else:
    from .config import PipelineConfig
    from .client import BrainClient
    from .evaluator import AlphaEvaluator
    from .database import AlphaDatabase
    from .reporter import PipelineReporter
    from .engine_algorithmic import AlgorithmicEngine
    from .engine_ai import CloudAIEngine
    from .engine_institutional import InstitutionalQuantEngine

def cmd_portfolio_status(client: BrainClient) -> None:
    """Displays user profile, tier, and active alphas."""
    print("\n=======================================================")
    print("⚡ WorldQuant BRAIN - Portfolio Status")
    print("=======================================================")
    try:
        u_res = client._request_with_retry("GET", f"{client.config.api_base}/users/self")
        if u_res.status_code == 200:
            u_data = u_res.json()
            print(f"User ID   : {u_data.get('id')}")
            print(f"Name      : {u_data.get('fullName') or u_data.get('firstName')}")
            print(f"Tier      : {u_data.get('level')}")
            print(f"Email     : {u_data.get('email')}")
            
        act_res = client._request_with_retry("GET", f"{client.config.api_base}/users/self/alphas?status=ACTIVE&order=-dateSubmitted&limit=25")
        if act_res.status_code == 200:
            alphas = act_res.json().get("results", [])
            print(f"\nActive Portfolio Alphas ({len(alphas)}):")
            print(f"{'Alpha ID':<12} | {'Submitted':<24} | {'Universe':<10} | {'Sharpe':<6} | {'Fitness':<6}")
            print("-" * 68)
            for a in alphas:
                aid = a.get("id")
                sub_date = (a.get("dateSubmitted") or "")[:19]
                univ = a.get("settings", {}).get("universe", "TOP3000")
                shp = a.get("is", {}).get("sharpe", 0.0)
                fit = a.get("is", {}).get("fitness", 0.0)
                print(f"{aid:<12} | {sub_date:<24} | {univ:<10} | {shp:<6.2f} | {fit:<6.2f}")
    except Exception as e:
        print(f"[!] Error fetching portfolio status: {e}")

def cmd_simulate_file(client: BrainClient, evaluator: AlphaEvaluator, file_path: str) -> None:
    """Simulates and audits all candidates from a JSON file."""
    if not os.path.exists(file_path):
        print(f"[!] File not found: {file_path}")
        return

    with open(file_path, "r") as f:
        candidates = json.load(f)

    print(f"\n[*] Loaded {len(candidates)} candidate(s) from {file_path}")
    for idx, cand in enumerate(candidates, 1):
        name = cand.get("name", f"Candidate_{idx}")
        print(f"\n[{idx}/{len(candidates)}] Simulating: {name} (Univ: {cand.get('universe', 'TOP3000')}, Decay: {cand.get('decay', 20)})...")
        alpha_data = client.simulate_candidate(cand)
        if not alpha_data:
            print(f"  [!] Simulation failed or timed out for {name}")
            continue

        aid = alpha_data.get("id")
        shp = alpha_data.get("is", {}).get("sharpe")
        fit = alpha_data.get("is", {}).get("fitness")
        trn = alpha_data.get("is", {}).get("turnover")
        ret = alpha_data.get("is", {}).get("returns")
        print(f"  [✓] Simulation Complete! Alpha ID: {aid}")
        print(f"      Sharpe: {shp} | Fitness: {fit} | Turnover: {trn:.4f} | Return: {ret:.2%}")

        print("      Auditing platform checks and self-correlation...")
        eval_res = evaluator.evaluate_alpha(alpha_data, name=name)
        print(f"      Submittable: {eval_res.is_submittable}")
        print(f"      Max Self-Correlation: {eval_res.max_self_correlation}")
        if eval_res.fail_reasons:
            print(f"      Hurdle Fails: {eval_res.fail_reasons}")
        else:
            print(f"      🎉 100% HURDLES PASS! Ready for submission!")

def cmd_generate(engine: str = "gemini", count: int = 1, model: str = None) -> None:
    """Generates candidate expressions and prints them."""
    engine_clean = (engine or "gemini").lower()
    if engine_clean in ("ai", "cloud_ai"):
        engine_clean = "gemini"
    print(f"\n[*] Generating {count} candidate(s) using engine '{engine_clean.upper()}'...")
    for i in range(1, count + 1):
        if engine_clean == "algorithmic":
            cand = AlgorithmicEngine.generate_candidate()
        elif engine_clean == "gemini":
            key = os.getenv("GEMINI_API_KEY")
            cand = CloudAIEngine.generate_alpha(provider="gemini", api_key=key, model=model or "gemini-2.0-flash")
        elif engine_clean == "ollama":
            cand = CloudAIEngine.generate_alpha(provider="ollama", model=model or "deepseek-r1:latest")
        elif engine_clean == "institutional":
            cand = InstitutionalQuantEngine.generate_candidate()
        elif engine_clean == "openai":
            key = os.getenv("OPENAI_API_KEY")
            cand = CloudAIEngine.generate_alpha(provider="openai", api_key=key, model=model)
        else:
            print(f"[!] Unknown engine: {engine_clean}")
            return

        print(f"\n--- Candidate #{i}: {cand.get('name')} ---")
        print(f"Universe: {cand.get('universe')} | Delay: {cand.get('delay')} | Decay: {cand.get('decay')}")
        print(f"Expression:\n{cand.get('expr')}")

def main():
    parser = argparse.ArgumentParser(description="Quantum Alpha Studio - WorldQuant BRAIN CLI")
    parser.add_argument("--portfolio-status", action="store_true", help="Display active portfolio status and streak")
    parser.add_argument("--simulate-file", type=str, help="Path to JSON file containing candidate specifications")
    parser.add_argument("--generate", type=str, nargs="?", const="gemini", choices=["gemini", "algorithmic", "ollama", "openai", "ai", "institutional"], help="Generate alpha expressions (defaults to gemini)")
    parser.add_argument("--count", type=int, default=1, help="Number of alphas to generate")
    parser.add_argument("--model", type=str, help="Optional model name for AI generation (e.g. gemini-2.0-flash)")
    parser.add_argument("--benchmark", action="store_true", help="Run empirical benchmark comparison between baseline repo templates and institutional engine")

    args = parser.parse_args()

    if args.benchmark:
        from pipeline.benchmark_comparison import print_benchmark_table
        print_benchmark_table()
        return

    cfg = PipelineConfig()
    try:
        client = BrainClient(cfg)
        evaluator = AlphaEvaluator(client, cfg)
    except Exception as e:
        client = None
        evaluator = None

    if args.portfolio_status:
        if not client:
            print("[!] BRAIN credentials missing in .env. Configure .env first.")
            sys.exit(1)
        cmd_portfolio_status(client)
    elif args.simulate_file:
        if not client:
            print("[!] BRAIN credentials missing in .env. Configure .env first.")
            sys.exit(1)
        cmd_simulate_file(client, evaluator, args.simulate_file)
    elif args.generate:
        cmd_generate(args.generate, args.count, args.model)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
