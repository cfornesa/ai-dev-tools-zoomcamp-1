import type { LocalProjectRecord } from '../storage/localProjectRepository';

export default function LocalCloudSyncControl({ project }: { project: LocalProjectRecord }) {
  return (
    <section aria-label="Local project cloud sync" className="cloud-sync-control">
      <h3>Cloud sync</h3>
      {project.cloudSyncState === 'synced' && project.remotePublicId ? (
        <p>
          This local piece is synced to the private server copy (version{' '}
          {project.remoteVersion ?? 1}).
        </p>
      ) : (
        <p>This piece remains local-only until you explicitly select it for upload.</p>
      )}
    </section>
  );
}
