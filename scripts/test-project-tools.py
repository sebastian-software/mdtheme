"""Exercise the real mise resolver and released mdtheme in isolated project fixtures.

Requires mise on PATH. Downloads the pinned release during explicit setup only.
"""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
MISE = shutil.which('mise')

class ProjectToolsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not MISE:
            raise RuntimeError('Install the pinned mise version before running this suite')
        cls.temp = tempfile.TemporaryDirectory(prefix='mdtheme-project-tools-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.project = cls.root / 'project'
        cls.project.mkdir()
        for name in ['mise.toml', 'mise.lock']:
            shutil.copyfile(ROOT / name, cls.project / name)
        (cls.project / 'README.md.src').write_text('# Project tools fixture\n')
        cls.env = dict(os.environ)
        for key in list(cls.env):
            if key.startswith('MISE_'):
                del cls.env[key]
        cls.env.update({
            'MISE_DATA_DIR': str(cls.root / 'data'),
            'MISE_CACHE_DIR': str(cls.root / 'cache'),
            'MISE_STATE_DIR': str(cls.root / 'state'),
            'MISE_CONFIG_DIR': str(cls.root / 'config'),
            'MISE_GLOBAL_CONFIG_FILE': str(cls.root / 'global.toml'),
            'MISE_TRUSTED_CONFIG_PATHS': str(cls.root),
            'MISE_CEILING_PATHS': str(cls.root.parent),
            'MISE_YES': '1',
            'PATH': str(Path(MISE).parent) + os.pathsep + os.environ['PATH'],
        })
        result = cls.run_mise('install', '--locked')
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)

    @classmethod
    def run_mise(cls, *args, project=None, extra=None):
        return subprocess.run([MISE, *args], cwd=project or cls.project,
                              env={**cls.env, **(extra or {})}, text=True, capture_output=True)

    def test_installed_cli_works_offline_and_preserves_source(self):
        source = (self.project / 'README.md.src').read_bytes()
        result = self.run_mise('run', 'readme:write', extra={'MISE_OFFLINE': 'true'})
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.run_mise('run', 'readme:check', extra={'MISE_OFFLINE': 'true'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.project / 'README.md.src').read_bytes(), source)

    def test_missing_installation_never_runs_global_binary(self):
        fake_bin = self.root / 'global-bin'
        fake_bin.mkdir(exist_ok=True)
        marker = self.root / 'fallback-ran'
        fake = fake_bin / 'mdtheme'
        fake.write_text('#!/bin/sh\ntouch "' + str(marker) + '"\nexit 0\n')
        fake.chmod(0o755)
        if os.name == 'nt':
            resolved = self.run_mise('which', 'mdtheme')
            self.assertEqual(resolved.returncode, 0, resolved.stderr)
            shutil.copyfile(resolved.stdout.strip(), fake_bin / 'mdtheme.exe')
        empty = self.root / 'empty-data'
        result = self.run_mise('run', 'readme:check', extra={
            'MISE_DATA_DIR': str(empty), 'MISE_OFFLINE': 'true',
            'PATH': str(fake_bin) + os.pathsep + self.env['PATH'],
        })
        self.assertNotEqual(result.returncode, 0, result.stderr)
        self.assertFalse(marker.exists(), 'A global mdtheme was executed')
        self.assertFalse(any(empty.rglob('mdtheme.exe')))
        self.assertFalse(any(p.is_file() for p in empty.rglob('mdtheme')))

    def test_other_project_cannot_use_installed_wrong_version(self):
        other = self.root / 'other-project'
        other.mkdir(exist_ok=True)
        config = (self.project / 'mise.toml').read_text().replace('version = "0.3.1"', 'version = "0.3.0"')
        (other / 'mise.toml').write_text(config)
        result = self.run_mise('run', 'readme:check', project=other, extra={'MISE_OFFLINE': 'true'})
        self.assertNotEqual(result.returncode, 0, result.stderr)
        result = self.run_mise('which', 'mdtheme', extra={'MISE_OFFLINE': 'true'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('0.3.1', result.stdout)

    def test_wrong_archive_checksum_is_rejected(self):
        import re
        corrupt = self.root / 'corrupt-lock'
        corrupt.mkdir(exist_ok=True)
        shutil.copyfile(self.project / 'mise.toml', corrupt / 'mise.toml')
        lock = (self.project / 'mise.lock').read_text()
        (corrupt / 'mise.lock').write_text(re.sub(r'sha256:[0-9a-f]{64}', 'sha256:' + '0' * 64, lock))
        result = self.run_mise('install', '--locked', project=corrupt, extra={
            'MISE_DATA_DIR': str(self.root / 'corrupt-data'),
            'MISE_CACHE_DIR': str(self.root / 'corrupt-cache'),
        })
        self.assertNotEqual(result.returncode, 0, result.stderr)
        self.assertIn('checksum', result.stderr.lower())

    def test_pre_push_uses_the_same_resolver(self):
        fixture = self.root / 'git-project'
        fixture.mkdir(exist_ok=True)
        for name in ['mise.toml', 'mise.lock', 'README.md.src']:
            shutil.copyfile(self.project / name, fixture / name)
        def git(*args):
            subprocess.run(['git', *args], cwd=fixture, check=True, capture_output=True)
        git('init')
        git('config', 'user.email', 'fixture@example.invalid')
        git('config', 'user.name', 'Fixture')
        result = self.run_mise('run', 'readme:write', project=fixture)
        self.assertEqual(result.returncode, 0, result.stderr)
        git('add', '.')
        git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture')
        result = self.run_mise('run', 'readme:pre-push', project=fixture, extra={'MISE_OFFLINE': 'true'})
        self.assertEqual(result.returncode, 0, result.stderr)
        (fixture / 'README.md.src').write_text('# Changed source\n')
        result = self.run_mise('run', 'readme:pre-push', project=fixture, extra={'MISE_OFFLINE': 'true'})
        self.assertNotEqual(result.returncode, 0, result.stderr)
        status = subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=fixture, text=True)
        self.assertEqual(status, '')

if __name__ == '__main__':
    unittest.main()
