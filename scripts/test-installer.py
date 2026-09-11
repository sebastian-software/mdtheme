"""Exercise installation and failure behavior without network access."""
import hashlib
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

INSTALLER = Path(__file__).resolve().parent.parent / 'install.sh'

class InstallerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.mock = self.root / 'commands'
        self.mock.mkdir()
        self.destination = self.root / 'bin with spaces'
        self.destination.mkdir()
        (self.destination / 'mdtheme').write_text('old installation')
        self.command('uname', 'case "$1" in -s) echo Linux;; -m) echo x86_64;; esac')
        self.command('curl', '''while [ "$#" -gt 0 ]; do
case "$1" in https:*) url=$1;; -o) shift; output=$1;; esac
shift
done
cp "$FIXTURES/${url##*/}" "$output"''')
        self.binary = self.root / 'mdtheme'
        self.binary.write_text('#!/bin/sh\necho "0.3.0"\n')
        self.archive = self.root / 'mdtheme-x86_64-unknown-linux-gnu.tar.gz'
        with tarfile.open(self.archive, 'w:gz') as archive:
            archive.add(self.binary, arcname='mdtheme')
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        (self.root / 'SHA256SUMS').write_text(f'{digest}  {self.archive.name}\n')
        self.env = {**os.environ, 'PATH': str(self.mock) + ':' + os.environ['PATH'], 'FIXTURES': str(self.root)}

    def command(self, name, body):
        path = self.mock / name
        path.write_text('#!/bin/sh\nset -eu\n' + body + '\n')
        path.chmod(0o755)

    def run_install(self, *args):
        return subprocess.run(['sh', str(INSTALLER), '--bin-dir', str(self.destination), *args], env=self.env, text=True, capture_output=True)

    def assert_preserved(self, result):
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.destination / 'mdtheme').read_text(), 'old installation')
        self.assertEqual(list(self.destination.glob('.mdtheme.*')), [])

    def test_versioned_install(self):
        result = self.run_install('--version', '0.3.0')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(subprocess.check_output([str(self.destination / 'mdtheme'), '--version'], text=True).strip(), '0.3.0')

    def test_actual_cli_version_contract(self):
        binary = INSTALLER.parent / 'target/debug/mdtheme'
        self.assertTrue(binary.is_file(), 'Build mdtheme before running installer tests')
        version = subprocess.check_output([str(binary), '--version'], text=True).strip()
        with tarfile.open(self.archive, 'w:gz') as archive:
            archive.add(binary, arcname='mdtheme')
        digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        (self.root / 'SHA256SUMS').write_text(f'{digest}  {self.archive.name}\n')
        result = self.run_install('--version', version)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_latest_install(self):
        self.assertEqual(self.run_install().returncode, 0)

    def test_checksum_mismatch_preserves_existing_installation(self):
        with self.archive.open('ab') as archive:
            archive.write(b'corruption')
        self.assert_preserved(self.run_install())

    def test_missing_checksum_preserves_existing_installation(self):
        (self.root / 'SHA256SUMS').write_text('')
        self.assert_preserved(self.run_install())

    def test_download_failure_preserves_existing_installation(self):
        self.command('curl', 'exit 22')
        self.assert_preserved(self.run_install())

    def test_wrong_version_preserves_existing_installation(self):
        self.assert_preserved(self.run_install('--version', '0.4.0'))

    def test_invalid_version(self):
        self.assert_preserved(self.run_install('--version', '../main'))

    def test_unsupported_platform(self):
        self.command('uname', 'echo FreeBSD')
        self.assert_preserved(self.run_install())

if __name__ == '__main__':
    unittest.main()
