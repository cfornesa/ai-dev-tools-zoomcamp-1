import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { fetchProfile } from '../api/profile';
import { generateArtPiece } from '../api/artPieces';
import { buildArtPieceSandboxDocument } from '../generative/artPieceSandbox';
import {
  ART_PIECE_ENGINE_CAPABILITIES,
  type ArtPieceCapabilitySet,
  type ArtPieceLibrary,
} from '../api/artPieces';
import {
  CAPABILITY_OPTIONS,
  normalizeCapabilities,
  SPATIAL_LIBRARIES,
} from '../generative/artPieceCapabilities';
import { captureSandboxScreenshot } from '../generative/artPieceThumbnailCapture';
import LocalTransferConsentDialog from './LocalTransferConsentDialog';
import LocalPublicTransferControl from './LocalPublicTransferControl';
import {
  hasLocalTransferConsent,
  recordLocalTransferConsent,
} from '../storage/localTransferConsent';
import {
  buildLocalGeneratedPiecePackage,
  localGeneratedPackageFilename,
} from '../storage/localGeneratedPiecePackage';
import {
  getProjectWithOwnerFallback,
  listPieceVersions,
  openLocalProjectDatabase,
  restoreLocalGeneratedVersion,
  saveLocalGeneratedVersion,
  updateProject,
  type LocalPieceVersionRecord,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';
import { ensureLocalThumbnail } from '../storage/localThumbnail';

function payloadOf(version: LocalPieceVersionRecord | null) {
  return (version?.payload ?? {}) as {
    source?: string;
    engine?: string;
    description?: string;
    ink?: unknown;
    capabilities?: unknown;
  };
}

function localEngine(value: unknown): ArtPieceLibrary {
  return typeof value === 'string' && value in ART_PIECE_ENGINE_CAPABILITIES
    ? (value as ArtPieceLibrary)
    : 'svg';
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
  const [capabilities, setCapabilities] = useState<ArtPieceCapabilitySet>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  const load = useCallback(async () => {
    if (!id || !owner) return null;
    const db = await openLocalProjectDatabase();
    try {
      const profile = await fetchProfile().catch(() => null);
      const loaded = await getProjectWithOwnerFallback(db, owner, profile?.handle, id);
      if (!loaded || loaded.kind !== 'generated')
        throw new Error('Local generated piece unavailable.');
      const rows = await listPieceVersions(db, owner, id);
      const active = rows.find((row) => row.id === loaded.currentVersionId) ?? rows.at(-1) ?? null;
      return { project: loaded, versions: rows, current: active };
    } finally {
      db.close();
    }
  }, [id, owner]);

  useEffect(() => {
    let current = true;
    void load()
      .then((loaded) => {
        if (!current || !loaded) return;
        setProject(loaded.project);
        setVersions(loaded.versions);
        setCurrent(loaded.current);
        setSource(String(payloadOf(loaded.current).source ?? ''));
        setCapabilities(
          normalizeCapabilities(
            payloadOf(loaded.current).capabilities,
            localEngine(payloadOf(loaded.current).engine),
          ),
        );
      })
      .catch((error) => {
        if (current)
          setMessage(error instanceof Error ? error.message : 'Could not open local piece.');
      });
    return () => {
      current = false;
    };
  }, [load]);

  if (auth.status === 'signed-out') return <Navigate to="/accounts/login/" replace />;
  if (!id || !owner) return <p role="status">Opening local generated editor…</p>;
  if (!project || !current) return <p role="status">Loading local generated piece…</p>;
  const payload = payloadOf(current);
  const engine = localEngine(payload.engine);

  async function save() {
    const db = await openLocalProjectDatabase();
    try {
      const version = await saveLocalGeneratedVersion(db, owner!, id!, {
        ...current!.payload,
        source,
        capabilities: normalizeCapabilities(capabilities, engine),
      });
      const updated = await updateProject(db, owner!, id!, { title: project!.title });
      setProject(updated);
      void ensureLocalThumbnail(updated).catch(() => undefined);
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
      setCapabilities(normalizeCapabilities(payloadOf(version).capabilities, engine));
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

  async function screenshot() {
    if (!previewRef.current) return;
    try {
      const dataUrl = await captureSandboxScreenshot(previewRef.current);
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = `${project!.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      anchor.click();
      setMessage('Captured the local preview screenshot.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The preview could not be captured.');
    }
  }

  function toggleCapability(key: keyof ArtPieceCapabilitySet) {
    setCapabilities((currentCapabilities) =>
      normalizeCapabilities({ ...currentCapabilities, [key]: !currentCapabilities[key] }, engine),
    );
  }

  async function runAiTransfer() {
    if (!aiPrompt.trim() || aiPending) return;
    setAiPending(true);
    setMessage(null);
    try {
      const result = await generateArtPiece(engine, aiPrompt.trim());
      const db = await openLocalProjectDatabase();
      try {
        const version = await saveLocalGeneratedVersion(db, owner!, id!, {
          ...current!.payload,
          source: result.code,
          engine,
          capabilities: normalizeCapabilities(capabilities, engine),
        });
        setVersions((items) => [...items, version]);
        setCurrent(version);
        setSource(result.code);
        setCapabilities(normalizeCapabilities(version.payload.capabilities, engine));
        setAiPrompt('');
        setMessage('AI result saved as a new local version. Nothing was published.');
      } finally {
        db.close();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The AI request failed.');
    } finally {
      setAiPending(false);
    }
  }

  function requestAiTransfer() {
    if (!aiPrompt.trim() || aiPending) return;
    if (hasLocalTransferConsent(owner!, id!, current!.id)) {
      void runAiTransfer();
    } else {
      setConsentOpen(true);
    }
  }

  function confirmAiTransfer() {
    if (!recordLocalTransferConsent(owner!, id!, current!.id)) {
      setMessage('Consent could not be stored; no AI request was sent.');
      return;
    }
    setConsentOpen(false);
    void runAiTransfer();
  }

  return (
    <>
      <LocalPublicTransferControl
        project={project}
        initialDescription={String(payload.description ?? '')}
        onProjectUpdated={setProject}
      />
      <main className="local-generated-editor" aria-labelledby="local-generated-title">
        <p className="eyebrow">LOCAL-ONLY GENERATED PIECE</p>
        <h1 id="local-generated-title">{project.title}</h1>
        <p>{payload.description ?? 'Edit and preview this generated piece locally.'}</p>
        <section className="local-generated-preview" aria-label="Generated piece preview">
          <iframe
            ref={previewRef}
            title={`${project.title} preview`}
            sandbox="allow-scripts"
            srcDoc={buildArtPieceSandboxDocument(source, engine, 'regular', { ink: payload.ink })}
          />
        </section>
        <div className="local-generated-actions">
          <button type="button" onClick={() => void screenshot()}>
            Screenshot
          </button>
        </div>
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
          <div className="local-generated-ai-transfer">
            <h2>AI revision</h2>
            <label htmlFor="local-generated-ai-prompt">Describe the local revision</label>
            <textarea
              id="local-generated-ai-prompt"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Describe what you want AI to generate…"
            />
            <button
              type="button"
              onClick={requestAiTransfer}
              disabled={!aiPrompt.trim() || aiPending}
            >
              {aiPending ? 'Waiting for AI…' : 'Ask AI for a local revision'}
            </button>
          </div>
        </section>
        <fieldset className="local-generated-capabilities" aria-labelledby="capabilities-heading">
          <legend id="capabilities-heading">Capabilities</legend>
          {CAPABILITY_OPTIONS.map(({ key, label, spatialOnly }) => {
            const unsupported =
              (spatialOnly && !SPATIAL_LIBRARIES.has(engine)) ||
              (key === 'download' && !ART_PIECE_ENGINE_CAPABILITIES[engine].download);
            return (
              <label key={key} data-testid={`local-generated-capability-${key}`}>
                <input
                  type="checkbox"
                  checked={!unsupported && Boolean(capabilities[key])}
                  disabled={unsupported}
                  onChange={() => toggleCapability(key)}
                />
                {label}
                {unsupported && ' (unavailable for this engine)'}
              </label>
            );
          })}
          <p>Capability changes are local until an explicit transfer is approved.</p>
        </fieldset>
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
        {consentOpen && (
          <LocalTransferConsentDialog
            pieceTitle={project.title}
            onCancel={() => setConsentOpen(false)}
            onConfirm={confirmAiTransfer}
          />
        )}
        <Link to="/gallery">Back to gallery</Link>
      </main>
    </>
  );
}
