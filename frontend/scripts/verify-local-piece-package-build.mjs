import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';

const outputDir = resolve('dist');
const assetsDir = resolve(outputDir, 'assets');
const assets = await readdir(assetsDir);

if (assets.some((name) => /^piecePackage-.*\.ts$/.test(name))) {
  throw new Error('The production build emitted a TypeScript package asset.');
}

const packageLoaderName = assets.find((name) => /^localPiecePackage-.*\.js$/.test(name));
if (!packageLoaderName) {
  throw new Error('The production build did not emit the local package loader chunk.');
}

const packageLoader = await readFile(resolve(assetsDir, packageLoaderName), 'utf8');
const packageImport = packageLoader.match(/import\(`([^`]*piecePackage-[^`]*\.js)`\)/);
if (!packageImport) {
  throw new Error('The local package loader does not dynamically import a JavaScript chunk.');
}

const server = await preview({
  configFile: resolve('vite.config.ts'),
  preview: { host: '127.0.0.1', port: 0, strictPort: false },
});

try {
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Vite preview did not expose a TCP address.');
  }
  const loaderUrl = new URL(`/assets/${packageLoaderName}`, `http://127.0.0.1:${address.port}`);
  const chunkUrl = new URL(packageImport[1], loaderUrl);
  if (!chunkUrl.pathname.endsWith('.js')) {
    throw new Error(`The package chunk URL is not JavaScript: ${chunkUrl.pathname}`);
  }

  const response = await fetch(chunkUrl);
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !/javascript|ecmascript/i.test(contentType)) {
    throw new Error(
      `Package chunk response was ${response.status} with Content-Type ${contentType || '(missing)'}.`,
    );
  }

  console.log(`Local package chunk verified: ${chunkUrl.pathname} (${contentType}).`);
} finally {
  await server.close();
}
