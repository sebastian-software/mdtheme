"""Exercise draft upload ordering, recovery, and immutable-release rejection."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release_assets", Path(__file__).with_name("release-assets.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
TAG = "mdtheme-v0.5.0"


class ReleaseAssetsTest(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.directory = Path(self.scratch.name)
        for filename in release.PAYLOAD:
            (self.directory / filename).write_text("candidate " + filename)
        self.checksums = "".join(
            f"{hashlib.sha256((self.directory / name).read_bytes()).hexdigest()}  {name}\n"
            for name in sorted(release.PAYLOAD)
        )
        (self.directory / "SHA256SUMS").write_text(self.checksums)
        self.assets = {}
        self.draft = True
        self.calls = []
        self.corrupt_upload = False

    def gh(self, *args):
        self.calls.append(args)
        if args[:2] == ("release", "view"):
            if args[-1] == "isDraft,tagName":
                return json.dumps({"isDraft": self.draft, "tagName": TAG})
            return json.dumps({"assets": list(self.assets.values())})
        if args[:2] == ("release", "delete-asset"):
            del self.assets[args[3]]
        elif args[:2] == ("release", "upload"):
            for filename in args[3:]:
                source = Path(filename)
                digest = hashlib.sha256(source.read_bytes()).hexdigest()
                self.assets[source.name] = {"name": source.name, "digest": "sha256:" + digest}
            if self.corrupt_upload:
                self.assets["install.sh"]["digest"] = "sha256:wrong"
        elif args[:2] == ("release", "edit"):
            self.draft = False
        else:
            self.fail(f"Unexpected gh call: {args}")
        return ""

    def test_complete_upload_precedes_publication(self):
        with patch.object(release, "gh", self.gh):
            release.publish(TAG, self.directory)
        self.assertEqual(set(self.assets), release.ASSETS)
        self.assertEqual(self.calls[-1], ("release", "edit", TAG, "--draft=false"))
        self.assertFalse(any("--clobber" in args for args in self.calls))

    def test_partial_draft_retry_replaces_known_assets(self):
        self.assets["install.sh"] = {"name": "install.sh", "digest": "old"}
        with patch.object(release, "gh", self.gh):
            release.publish(TAG, self.directory)
        self.assertIn(("release", "delete-asset", TAG, "install.sh", "--yes"), self.calls)
        self.assertFalse(self.draft)

    def test_published_release_rejected_before_mutation(self):
        self.draft = False
        with patch.object(release, "gh", self.gh), self.assertRaisesRegex(ValueError, "draft"):
            release.publish(TAG, self.directory)
        self.assertEqual(len(self.calls), 1)

    def test_missing_or_changed_payload_rejected_before_upload(self):
        (self.directory / "install.sh").write_text("changed")
        with patch.object(release, "gh", self.gh), self.assertRaisesRegex(ValueError, "Checksum mismatch"):
            release.publish(TAG, self.directory)
        self.assertEqual(len(self.calls), 1)

    def test_unexpected_draft_asset_blocks_publication(self):
        self.assets["foreign"] = {"name": "foreign"}
        with patch.object(release, "gh", self.gh), self.assertRaisesRegex(ValueError, "unexpected"):
            release.publish(TAG, self.directory)
        self.assertTrue(self.draft)

    def test_uploaded_digest_mismatch_leaves_draft(self):
        self.corrupt_upload = True
        with patch.object(release, "gh", self.gh), self.assertRaisesRegex(ValueError, "digest mismatch"):
            release.publish(TAG, self.directory)
        self.assertTrue(self.draft)


if __name__ == "__main__":
    unittest.main()
