import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("verify_native_sources",
    Path(__file__).resolve().parents[1] / "scripts/verify_native_sources.py")
verify = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify)


class LiveVerificationHarnessTest(unittest.TestCase):
    def test_all_sources_are_checked_after_failure_and_catalog_is_not_touched(self):
        def source(name, output, timeout):
            return {"source": name, "status": "failed" if name == "bad" else "passed", "count": 1}
        with tempfile.TemporaryDirectory() as tmp, patch.object(verify, "run_source", side_effect=source) as called, \
                patch.object(verify.workflow, "refresh") as refresh:
            report = verify.verify(Path(tmp), ("bad", "good"), discovery_input=Path(tmp) / "bundle.json")
            self.assertEqual(called.call_count, 2)
            self.assertEqual(report["status"], "failed")
            self.assertFalse(report["discovery_bundle_checked"])
            self.assertEqual(report["catalog_refresh"]["status"], "not_run")
            refresh.assert_not_called()

    def test_source_subset_never_claims_full_catalog_verification(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(verify, "run_source",
                return_value={"source": "namu", "status": "passed", "count": 1}):
            report = verify.verify(Path(tmp), ("namu",))
            self.assertEqual(report["catalog_refresh"]["status"], "not_run")

    def test_complete_refresh_uses_an_external_catalog_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            source_dir = output / "namu"
            source_dir.mkdir()
            (source_dir / "normalized.json").write_text("[]")
            original = (verify.ROOT / "server/data/events.json").read_bytes()
            with patch.object(verify.workflow, "SOURCES", ("namu",)), patch.object(verify, "run_source",
                    return_value={"source": "namu", "status": "passed", "count": 0}), patch.object(
                    verify.workflow, "refresh", return_value={"changed": False}) as refresh:
                report = verify.verify(output, ("namu",))
            self.assertEqual(report["catalog_refresh"]["status"], "passed")
            self.assertEqual(refresh.call_args.args[0], output / "isolated-catalog")
            self.assertEqual((verify.ROOT / "server/data/events.json").read_bytes(), original)
            self.assertEqual(json.loads((output / "report.json").read_text())["status"], "passed")

    def test_repository_output_path_is_rejected_before_collection(self):
        with patch.object(verify, "verify") as collect, self.assertRaises(SystemExit):
            verify.main(["--output", str(verify.ROOT / "diagnostics")])
        collect.assert_not_called()
