import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type PublicMediaFixture = {
  available: boolean;
  public_id?: string;
  slug?: string;
  asset_id?: string;
  reason?: string;
};

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const configuredEnvFile = process.env.E2E_ENV_FILE;
const envFileArgs = configuredEnvFile
  ? ['--env-file', configuredEnvFile]
  : fs.existsSync(path.join(BACKEND_DIR, '.env'))
    ? ['--env-file', '.env']
    : [];

function runFixture(action: 'public-media-create' | 'public-media-cleanup'): PublicMediaFixture {
  const output =
    process.env.E2E_DOCKER_COMPOSE === 'true'
      ? execFileSync(
          'docker',
          [
            'compose',
            '--project-name',
            'ai-dev-tools-zoomcamp-1',
            '--file',
            'compose.yaml',
            'exec',
            '-T',
            'backend',
            'uv',
            'run',
            'python',
            'manage.py',
            'e2e_fixtures',
            action,
            '--json',
          ],
          { cwd: REPO_ROOT, encoding: 'utf8' },
        )
      : execFileSync(
          'uv',
          ['run', ...envFileArgs, 'python', 'manage.py', 'e2e_fixtures', action, '--json'],
          { cwd: BACKEND_DIR, encoding: 'utf8' },
        );
  return JSON.parse(output.trim()) as PublicMediaFixture;
}

export function createPublicMediaFixture(): PublicMediaFixture {
  return runFixture('public-media-create');
}

export function cleanupPublicMediaFixture(): PublicMediaFixture {
  return runFixture('public-media-cleanup');
}
