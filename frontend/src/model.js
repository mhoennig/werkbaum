/* Werkbaum-Modell — headless Baum-/Kostenlogik über den geparsten Knotenbaum.
   Kein DOM, keine UI-State-Globals: Zustand (verworfene einblenden, günstigster
   Pfad) wird als Parameter hereingereicht. Grundlage für Renderer, SVG-Export
   und Mermaid-Plugin. Vgl. docs/SPEC.md §3–§5, §9 und D18. */

import { SIZE_RANK } from './parser.js';

/* Gate der Geschwistergruppe: 'or', wenn das erste Kind '|' trägt, sonst 'and'
   (SPEC §3 — Darstellung nach dem ersten Kind). */
export function gateOf(children){
  return children.length && children[0].type === 'or' ? 'or' : 'and';
}

/* Untergliederungspflicht ab Größe M ohne Kinder (SPEC §5); verworfene nie. */
export function needsBreakdown(n){
  if(n.status && n.status.key === 'verworfen') return false;
  return !!n.size && SIZE_RANK[n.size] >= SIZE_RANK.M && !n.children.length;
}

/* Sichtbare Kinder: verworfene ausblenden, außer showDiscarded ist gesetzt. */
export function visibleChildren(n, showDiscarded){
  if(showDiscarded) return n.children;
  return n.children.filter(k => !k.status || k.status.key !== 'verworfen');
}

/* ---------- Günstigster Pfad (D18) ----------
   Nötige Knoten für die günstigste Realisierung: all-of ⇒ alle Kinder,
   any-of ⇒ nur die günstigste Alternative. „Günstig" = kleinste rekursive
   Kosten (eigene Größe + Kinder; any-of das Minimum). Verworfene zählen nie
   mit (unabhängig vom Einblenden-Toggle). Gleichstand ⇒ erste. Fehlende
   Größe = M. */
export function pathChildren(n){
  return n.children.filter(k => !k.status || k.status.key !== 'verworfen');
}
/* fehlende Größe wird als M interpretiert */
export function ownCost(n){ return SIZE_RANK[n.size || 'M'] + 1; }
export function cheapestCost(n){
  const kids = pathChildren(n);
  let c = ownCost(n);
  if(kids.length){
    if(gateOf(kids) === 'or') c += Math.min(...kids.map(cheapestCost));
    else c += kids.reduce((s, k) => s + cheapestCost(k), 0);
  }
  return c;
}
export function markCheapest(n, set){
  set.add(n);
  const kids = pathChildren(n);
  if(!kids.length) return;
  if(gateOf(kids) === 'or'){
    let best = null, bc = Infinity;
    for(const k of kids){ const c = cheapestCost(k); if(c < bc){ bc = c; best = k; } }
    if(best) markCheapest(best, set);
  } else {
    for(const k of kids) markCheapest(k, set);
  }
}
/* Menge der nötigen Knoten über alle Wurzeln. */
export function computeCheapSet(roots){
  const set = new Set();
  roots.forEach(r => markCheapest(r, set));
  return set;
}
/* CSS-Klassen für den günstigen Pfad. Leere `cheapSet` (Pfad aus) ⇒ ''.
   Endknoten (kein Kind liegt auf dem Pfad) bekommt zusätzlich 'cheap-leaf'. */
export function cheapCls(n, cheapSet){
  if(!cheapSet.has(n)) return '';
  const leaf = !pathChildren(n).some(k => cheapSet.has(k));
  return leaf ? 'cheap cheap-leaf' : 'cheap';
}
