import asyncio
import unittest
from unittest.mock import MagicMock, patch

from pipeline.config import PipelineConfig
from web import server


class TestWebGlue(unittest.TestCase):
    def test_preview_uses_selected_algorithmic_pattern(self):
        request = MagicMock()
        with patch.object(server, "get_current_session", return_value=None):
            result = asyncio.run(server.generate_preview(server.GeneratePreviewRequest(pattern_idx=2), request))
        self.assertTrue(result["success"])
        self.assertEqual(result["candidate"]["delay"], 1)
        self.assertIn("range_pos", result["candidate"]["expr"])

    def test_batch_exposes_selected_blueprint_without_running_cloud_work(self):
        background = MagicMock()
        with patch.object(server, "get_current_session", return_value=None):
            result = asyncio.run(server.run_batch(
                MagicMock(), background, server.GeneratePreviewRequest(pattern_idx=3)
            ))
        try:
            self.assertEqual(result["blueprint"]["delay"], 1)
            self.assertIn("expr", result["blueprint"])
            background.add_task.assert_called_once()
        finally:
            del server.SIMULATION_TASKS[result["task_id"]]

    def test_manual_simulation_uses_session_client_and_all_settings(self):
        client = MagicMock()
        client.config = PipelineConfig()
        client.simulate_candidate.return_value = {"id": "alpha-test"}
        evaluation = MagicMock()
        evaluation.id = "alpha-test"
        evaluation.sharpe = 1.7
        evaluation.fitness = 1.2
        evaluation.returns = 0.1
        evaluation.turnover = 0.2
        evaluation.margin = 0.001
        evaluation.drawdown = 0.05
        evaluation.max_self_correlation = 0.3
        evaluation.is_submittable = True
        evaluation.fail_reasons = []
        task_id = "test-manual-settings"
        server.SIMULATION_TASKS[task_id] = {"status": "QUEUED", "logs": [], "candidate": None}
        request = server.SimulationRequest(
            name="Test", expr="rank(close)", region="EUR", universe="TOP1000",
            delay=0, decay=15, neutralization="SECTOR", truncation=0.12,
            pasteurization="OFF", nanHandling="ON",
        )
        try:
            with patch.object(server, "BrainClient", side_effect=AssertionError("session ignored")), \
                 patch.object(server, "AlphaDatabase"), \
                 patch.object(server, "AlphaEvaluator") as evaluator:
                evaluator.return_value.evaluate_alpha.return_value = evaluation
                server.run_simulation_task(task_id, request, {"client": client})
            payload = client.simulate_candidate.call_args.args[0]
            self.assertEqual(payload["region"], "EUR")
            self.assertEqual(payload["universe"], "TOP1000")
            self.assertEqual(payload["delay"], 0)
            self.assertEqual(payload["truncation"], 0.12)
            self.assertEqual(payload["pasteurization"], "OFF")
            self.assertEqual(payload["nanHandling"], "ON")
            self.assertEqual(server.SIMULATION_TASKS[task_id]["status"], "COMPLETE")
            self.assertEqual(server.SIMULATION_TASKS[task_id]["candidate"]["id"], "alpha-test")
        finally:
            del server.SIMULATION_TASKS[task_id]

    def test_authenticated_dashboard_summary_uses_session_values(self):
        client = MagicMock()
        client.config.api_base = "https://example.test"
        client._request_with_retry.side_effect = [
            MagicMock(status_code=200, json=lambda: {"results": []}),
            MagicMock(status_code=200, json=lambda: {"results": []}),
        ]
        session = {"client": client, "user": {"fullName": "Researcher"}, "engine": "ollama"}
        with patch.object(server, "get_current_session", return_value=session):
            result = asyncio.run(server.get_dashboard_summary(MagicMock()))
        self.assertEqual(result["user"]["fullName"], "Researcher")
        self.assertEqual(result["engine"], "ollama")
        self.assertEqual(result["streak_days"], 0)


if __name__ == "__main__":
    unittest.main()
