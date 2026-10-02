import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readE2EState } from './state.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const ALLOWED_ENVIRONMENTS = new Set([
  'disposable-local',
  'disposable-ci',
  'disposable-compose',
  'disposable-staging',
  'disposable-test',
]);

export type FixtureAction =
  'create' | 'cleanup' | 'reset-sessions' | 'public-media-create' | 'public-media-cleanup';

type FixtureTarget = { compose: true } | { compose: false; envFile: string };

export function resolveFixtureTarget(): FixtureTarget {
  const environment = process.env.E2E_FIXTURE_ENVIRONMENT;
  if (!environment || !ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      'Fixture setup requires E2E_FIXTURE_ENVIRONMENT to explicitly name a disposable target ' +
        '(disposable-local, disposable-ci, disposable-compose, or disposable-staging).',
    );
  }
  const compose = process.env.E2E_DOCKER_COMPOSE === 'true';
  if (environment === 'disposable-compose' && compose) return { compose: true };
  if (compose || environment === 'disposable-compose') {
    throw new Error(
      'Compose fixture mode requires both disposable-compose and E2E_DOCKER_COMPOSE=true.',
    );
  }
  if (environment === 'disposable-test') {
    throw new Error(
      'disposable-test is reserved for backend pytest and cannot run Playwright fixtures.',
    );
  }
  const configured = process.env.E2E_ENV_FILE;
  if (!configured || !path.isAbsolute(configured) || !fs.existsSync(configured)) {
    throw new Error(
      'Fixture setup requires E2E_ENV_FILE to name an existing absolute disposable environment file; ' +
        'backend/.env is never selected implicitly.',
    );
  }
  return { compose: false, envFile: configured };
}

export function runFixtureCommand(action: FixtureAction, expectedFingerprint?: string): string {
  const target = resolveFixtureTarget();
  if (!expectedFingerprint) {
    const state = readE2EState();
    if (state.available && state.databaseFingerprint) {
      expectedFingerprint = state.databaseFingerprint;
    } else if (action !== 'create') {
      throw new Error(
        'Fixture mutation requires a successful setup state with a database fingerprint.',
      );
    }
  }
  const baseEnv = {
    ...process.env,
    UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? path.join(os.tmpdir(), 'creatrweb-uv-cache'),
    ...(expectedFingerprint ? { E2E_EXPECTED_DATABASE_FINGERPRINT: expectedFingerprint } : {}),
  };
  if (target.compose) {
    return execFileSync(
      'docker',
      [
        'compose',
        '--project-name',
        'ai-dev-tools-zoomcamp-1',
        '--file',
        'compose.yaml',
        'exec',
        '-T',
        '-e',
        'E2E_FIXTURE_ENVIRONMENT=disposable-compose',
        '-e',
        'E2E_DOCKER_COMPOSE=true',
        ...(expectedFingerprint
          ? ['-e', `E2E_EXPECTED_DATABASE_FINGERPRINT=${expectedFingerprint}`]
          : []),
        'backend',
        'uv',
        'run',
        'python',
        'manage.py',
        'e2e_fixtures',
        action,
        '--json',
      ],
      { cwd: REPO_ROOT, env: baseEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }
  return execFileSync(
    'uv',
    ['run', '--env-file', target.envFile, 'python', 'manage.py', 'e2e_fixtures', action, '--json'],
    {
      cwd: BACKEND_DIR,
      env: { ...baseEnv, E2E_ENV_FILE: target.envFile },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}
