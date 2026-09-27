import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { buildArtPieceSandboxDocument } from '../generative/artPieceSandbox';
import {
  buildLocalGeneratedPiecePackage,
  localGeneratedPackageFilename,
} from '../storage/localGeneratedPiecePackage';
import {
  getProject,
  listPieceVersions,
  openLocalProjectDatabase,
  restoreLocalGeneratedVersion,
  saveLocalGeneratedVersion,
  updateProject,
  type LocalPieceVersionRecord,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';

function payloadOf(version: LocalPieceVersionRecord | null) {
  return (version?.payload ?? {}) as {
    source?: string;
    engine?: string;
    description?: string;
    ink?: unknown;
  };
}

/** Local-only generated editor. It deliberately has no server API imports:
 * generated source stays in IndexedDB until the owner explicitly transfers it
 * through the separate #939 consent contract. */
export default function LocalGeneratedPieceWorkspace() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const owner = auth.user?.username;
  const [project, setProject] = useState<LocalProjectRecord | null>(null);
  const [versions, setVersions] = useState<LocalPieceVersionRecord[]>([]);
  const [current, setCurrent] = useState<LocalPieceVersionRecord | null>(null);
  const [source, setSource] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !owner) return;
    const db = await openLocalProjectDatabase();
    try {
      const loaded = await getProject(db, owner, id);
      if (!loaded || loaded.kind !== 'generated')
        throw new Error('Local generated piece unavailable.');
      const rows = await listPieceVersions(db, owner, id);
      const active = rows.find((row) => row.id === loaded.currentVersionId) ?? rows.at(-1) ?? null;
      setProject(loaded);
      setVersions(rows);
      setCurrent(active);
      setSource(String(payloadOf(active).source ?? ''));
    } finally {
      db.close();
    }
  }, [id, owner]);

  useEffect(() => {
    void load().catch((error) =>
      setMessage(error instanceof Error ? error.message : 'Could not open local piece.'),
    );
  }, [load]);

  if (auth.status === 'signed-out') return <Navigate to="/accounts/login/" replace />;
  if (!id || !owner) return <p role="status">Opening local generated editor…</p>;
  if (!project || !current) return <p role="status">Loading local generated piece…</p>;
  const payload = payloadOf(current);
  const engine = (payload.engine ?? 'svg') as
    'canvas2d' | 'svg' | 'p5js' | 'c2js' | 'c2js-interactive' | 'threejs' | 'aframe';

  async function save() {
    const db = await openLocalProjectDatabase();
    try {
      const version = await saveLocalGeneratedVersion(db, owner!, id!, {
        ...current!.payload,
        source,
      });
      const updated = await updateProject(db, owner!, id!, { title: project!.title });
      setProject(updated);
      setVersions((items) => [...items, version]);
      setCurrent(version);
      setMessage('Saved locally. Nothing was sent to the server.');
    } finally {
      db.close();
    }
  }

  async function restore(versionId: string) {
    const db = await openLocalProjectDatabase();
    try {
      const version = await restoreLocalGeneratedVersion(db, owner!, id!, versionId);
      setCurrent(version);
      setSource(String(payloadOf(version).source ?? ''));
      setMessage(`Restored local version ${version.sequence}.`);
    } finally {
      db.close();
    }
  }

  async function exportPackage() {
    const bytes = await buildLocalGeneratedPiecePackage(project!, versions);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: 'application/zip' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = localGeneratedPackageFilename(project!.title);
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Exported a local-only generated package.');
  }

  return (
    <main className="local-generated-editor" aria-labelledby="local-generated-title">
      <p className="eyebrow">LOCAL-ONLY GENERATED PIECE</p>
      <h1 id="local-generated-title">{project.title}</h1>
      <p>{payload.description ?? 'Edit and preview this generated piece locally.'}</p>
      <section className="local-generated-preview" aria-label="Generated piece preview">
        <iframe
          title={`${project.title} preview`}
          sandbox="allow-scripts"
          srcDoc={buildArtPieceSandboxDocument(source, engine, 'regular', { ink: payload.ink })}
        />
      </section>
      <section className="local-generated-source" aria-labelledby="source-heading">
        <h2 id="source-heading">Source</h2>
        <textarea
          aria-label="Generated source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
        <button type="button" onClick={() => void save()}>
          Save local version
        </button>
        <button type="button" onClick={() => void exportPackage()}>
          Export local package
        </button>
      </section>
      <section aria-labelledby="versions-heading">
        <h2 id="versions-heading">Local versions</h2>
        <ol>
          {versions.map((version) => (
            <li key={version.id}>
              <button type="button" onClick={() => void restore(version.id)}>
                Restore version {version.sequence}
              </button>
              {version.id === current.id ? ' (current)' : ''}
            </li>
          ))}
        </ol>
      </section>
      {message && <p role="status">{message}</p>}
      <Link to="/gallery">Back to gallery</Link>
    </main>
  );
}
