import { runFixtureCommand, type FixtureAction } from './fixtureCommand.js';

export type PublicMediaFixture = {
  available: boolean;
  public_id?: string;
  slug?: string;
  asset_id?: string;
  reason?: string;
};

function runFixture(
  action: Extract<FixtureAction, 'public-media-create' | 'public-media-cleanup'>,
): PublicMediaFixture {
  const output = runFixtureCommand(action);
  return JSON.parse(output.trim()) as PublicMediaFixture;
}

export function createPublicMediaFixture(): PublicMediaFixture {
  return runFixture('public-media-create');
}

export function cleanupPublicMediaFixture(): PublicMediaFixture {
  return runFixture('public-media-cleanup');
}
