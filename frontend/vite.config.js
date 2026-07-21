import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Bettet das Favicon (../docs/brand/favicon.svg, außerhalb des Roots) als
// data:-URI direkt in <link rel="icon"> ein, damit die gebaute Datei wirklich
// EINE self-contained Datei ist (kein Sibling-Asset). Läuft vor Vites eigener
// HTML-Asset-Auflösung ('pre'), damit Vite die data:-URI unangetastet lässt.
function inlineFavicon() {
  return {
    name: 'werkbaum-inline-favicon',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const svg = readFileSync(new URL('../docs/brand/favicon.svg', import.meta.url), 'utf8');
        const uri = 'data:image/svg+xml,' + encodeURIComponent(svg.trim());
        return html.replace(/href="[^"]*favicon\.svg"/, `href="${uri}"`);
      },
    },
  };
}

// Werkbaum bleibt bewusst eine einzelne, self-contained Datei (file://-tauglich,
// D16). Vite dient nur als Bündler/Testrunner (D19): `vite build` inlint alle
// Module + CSS in dist/index.html; im Dev-Server (`vite`) werden sie einzeln
// geladen. `fs.allow: ['..']` lässt den Dev-Server das Favicon aus
// ../docs/brand/ ausliefern (liegt außerhalb des Projekt-Roots frontend/).
export default defineConfig({
  root: '.',
  plugins: [inlineFavicon(), viteSingleFile()],
  server: { port: 8137, strictPort: true, fs: { allow: ['..'] } },
  build: {
    // Alles inlinen -> keine externen Assets, eine Datei.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    passWithNoTests: true,
  },
});
