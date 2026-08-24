import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { collectNews, CHANGELOG_FILE } from '../scripts/news.mjs';

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

// Neuigkeiten (D58): ../docs/CHANGELOG.md (die Notizen) und die git-Historie
// (die Knoten je Tag) werden zur BAUZEIT eingelesen und als virtuelles Modul
// eingebettet — zur Laufzeit gibt es kein git und keinen Server (D11/D19).
// Die Regeln stehen in ../scripts/news.mjs (getestet), hier nur die
// Beschaffung. Scheitert git (kein Repo, flacher Klon, Tarball), bleibt die
// Liste leer statt den Build zu zerreißen: Das Popup sagt dann, dass es nichts
// zu zeigen gibt. Der Dev-Server liest einmal beim Start — neue Einträge
// erscheinen nach einem Neustart.
const NEWS_ID = 'virtual:werkbaum-news';
function newsData() {
  const RES = '\0' + NEWS_ID;
  return {
    name: 'werkbaum-news',
    resolveId: id => (id === NEWS_ID ? RES : null),
    async load(id) {
      if (id !== RES) return null;
      let news = [];
      try {
        const cwd = new URL('..', import.meta.url);
        const { parse } = await import('./src/parser.js');
        const { statusByKey } = await import('./src/model.js');
        news = collectNews({
          run: args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64e6 }),
          changelog: readFileSync(new URL('../' + CHANGELOG_FILE, import.meta.url), 'utf8'),
          parsePlan: text => parse(text).roots,
          statusByKey,
        });
      } catch (e) {
        this.warn(`Neuigkeiten nicht lesbar (${e.message}) — Popup bleibt leer.`);
      }
      return `export default ${JSON.stringify(news)};`;
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
  plugins: [inlineFavicon(), newsData(), viteSingleFile()],
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
