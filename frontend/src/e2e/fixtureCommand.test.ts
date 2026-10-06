import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../e2e/support/fixtureCommand.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../e2e/support/fixtureCommand.js')>();
  return { ...actual, runFixtureCommand: vi.fn() };
});

import { resolveFixtureTarget } from '../../e2e/support/fixtureCommand.js';
import globalTeardown from '../../e2e/support/global-teardown.js';
import { clearE2EState, writeE2EState } from '../../e2e/support/state.js';
import { runFixtureCommand } from '../../e2e/support/fixtureCommand.js';

const savedEnvironment = { ...process.env };
const envDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-command-test-'));
const envFile = path.join(envDir, 'disposable.env');
fs.writeFileSync(envFile, 'DATABASE_URL=postgres://fixture-only\n');

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, savedEnvironment);
  clearE2EState();
  vi.clearAllMocks();
});

afterAll(() => fs.rmSync(envDir, { recursive: true, force: true }));

describe('Playwright disposable fixture selection', () => {
  it('rejects a missing opt-in before global setup or teardown can invoke a fixture command', () => {
    delete process.env.E2E_FIXTURE_ENVIRONMENT;
    delete process.env.E2E_ENV_FILE;
    expect(() => resolveFixtureTarget()).toThrow(/E2E_FIXTURE_ENVIRONMENT/);
  });

  it('rejects an implicit backend env-file fallback', () => {
    process.env.E2E_FIXTURE_ENVIRONMENT = 'disposable-local';
    delete process.env.E2E_ENV_FILE;
    expect(() => resolveFixtureTarget()).toThrow(/E2E_ENV_FILE.*never selected implicitly/);
  });

  it('accepts an explicitly selected existing disposable env file', () => {
    process.env.E2E_FIXTURE_ENVIRONMENT = 'disposable-local';
    process.env.E2E_ENV_FILE = envFile;
    expect(resolveFixtureTarget()).toEqual({ compose: false, envFile });
  });

  it('accepts the explicit Docker Compose mode without an env file', () => {
    process.env.E2E_FIXTURE_ENVIRONMENT = 'disposable-compose';
    process.env.E2E_DOCKER_COMPOSE = 'true';
    delete process.env.E2E_ENV_FILE;
    expect(resolveFixtureTarget()).toEqual({ compose: true });
  });

  it('skips teardown when setup recorded unavailable prerequisites', async () => {
    writeE2EState({ available: false, reason: 'server unavailable' });
    await globalTeardown();
    expect(runFixtureCommand).not.toHaveBeenCalled();
  });

  it('tears down with the fingerprint recorded by successful setup', async () => {
    writeE2EState({
      available: true,
      databaseFingerprint: 'setup-target-fingerprint',
      password: 'test-only',
      owner: { username: 'owner', email: 'owner@example.test' },
      other: { username: 'other', email: 'other@example.test' },
      empty: { username: 'empty', email: 'empty@example.test' },
      admin: { username: 'admin', email: 'admin@example.test' },
      deletable: { username: 'deletable', email: 'deletable@example.test' },
      split: { username: 'split', email: 'split@example.test' },
    });
    await globalTeardown();
    expect(runFixtureCommand).toHaveBeenCalledWith('cleanup', 'setup-target-fingerprint');
  });
});
