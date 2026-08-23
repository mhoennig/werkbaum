/* Werkbaum-Modell — headless Baum-/Kostenlogik über den geparsten Knotenbaum.
   Kein DOM, keine UI-State-Globals: Zustand (verworfene einblenden, günstigster
   Pfad) wird als Parameter hereingereicht. Grundlage für Renderer, SVG-Export
   und Mermaid-Plugin. Vgl. docs/SPEC.md §3–§5, §9 und D18. */

import { SIZE_RANK } from './parser.js';

/* Gate der Geschwistergruppe nach dem ERSTEN Kind (SPEC §3): 'or' (`|`),
   'xor' (`=`) oder 'and' (`-`/`+`). 'xor' bleibt ein eigener Wert, damit die
   mixedGate-Warnung Mischungen mit `|` meldet; wer nur konjunktiv/disjunktiv
   unterscheidet, prüft `!== 'and'` (D35). */
export function gateOf(children){
  if(!children.length) return 'and';
  const t = children[0].type;
  return t === 'or' || t === 'xor' ? t : 'and';
}

/* Untergliederungspflicht ab Größe M ohne Kinder (SPEC §5); verworfene nie. */
export function needsBreakdown(n){
  if(n.status && n.status.key === 'verworfen') return false;
  return !!n.size && SIZE_RANK[n.size] >= SIZE_RANK.M && !n.children.length;
}

/* Faltung-Voreinstellung „Größe M und kleiner zuklappen" (SPEC §9, D44):
   Knoten mit ANGEGEBENER Größe bis einschließlich M — offen bleiben also nur
   L, XL, XXL. Fehlt die Angabe, wird nichts angenommen: Der günstigste Pfad
   rechnet sie zwar als M (D18), das ist aber eine Kostenannahme des Werkzeugs
   und keine Aussage des Autors; danach den Baum zuzuklappen hieße, eine
   Vermutung wie eine Angabe zu behandeln. */
export function atMostM(n){ return !!n.size && SIZE_RANK[n.size] <= SIZE_RANK.M; }

/* Sichtbare Kinder: verworfene ausblenden, außer showDiscarded ist gesetzt. */
export function visibleChildren(n, showDiscarded){
  if(showDiscarded) return n.children;
  return n.children.filter(k => !k.status || k.status.key !== 'verworfen');
}

/* ---------- Günstigster Pfad (D18) ----------
   Nötige Knoten für die günstigste Realisierung: all-of ⇒ alle Kinder,
   any-of und XOR ⇒ nur die günstigste Alternative. „Günstig" = kleinste rekursive
   Kosten (eigene Größe + Kinder; any-of das Minimum). Verworfene zählen nie
   mit (unabhängig vom Einblenden-Toggle). Gleichstand ⇒ erste. Fehlende
   Größe = M.
   Optionale Kinder (`+`, SPEC §3/D29) fallen hier ebenfalls heraus — sie sind
   per Definition entbehrlich, also weder Kostenanteil noch Pfadknoten. Da beide
   Nutzer (`cheapestCost`, `markCheapest`) über diese Funktion gehen, gilt das
   samt Teilbaum. */
export function pathChildren(n){
  return n.children.filter(k =>
    !k.optional && (!k.status || k.status.key !== 'verworfen'));
}
/* fehlende Größe wird als M interpretiert */
export function ownCost(n){ return SIZE_RANK[n.size || 'M'] + 1; }
export function cheapestCost(n){
  const kids = pathChildren(n);
  let c = ownCost(n);
  if(kids.length){
    if(gateOf(kids) !== 'and') c += Math.min(...kids.map(cheapestCost));
    else c += kids.reduce((s, k) => s + cheapestCost(k), 0);
  }
  return c;
}
/* ---------- Günstigster Pfad auf der Dependency Closure (SPEC §9, D42) ----
   Mit Abhängigkeiten zählt nicht mehr der gewählte Teilbaum, sondern die
   HÜLLE: Jeder nötige Knoten zieht seine `:#…`-Ziele samt deren Realisierung
   nach; gemeinsam Gebrauchtes zählt über die Mengen-Vereinigung nur EINMAL.
   Damit ist die Wahl je Alternativgruppe nicht mehr lokal optimal (D34).

   Verfahren — gewählt und benannt (D42): ERSCHÖPFENDE SUCHE, aber nur über
   die GEKOPPELTEN Gruppen — disjunktive Gruppen, in deren Teilbäumen
   Abhängigkeiten stehen oder auf deren Knoten Abhängigkeiten zeigen. Alle
   übrigen Gruppen sind von der Kopplung unberührt und wählen lokal wie
   bisher (kleinste rekursive Kosten, Gleichstand ⇒ erste). Ohne
   Abhängigkeiten gibt es keine gekoppelten Gruppen und genau eine
   Auswertung — das alte Verhalten. Übersteigt das Produkt der
   Gruppengrößen EXACT_LIMIT, fällt die Rechnung auf die gierige lokale
   Wahl zurück und SAGT es (`exact:false` ⇒ Warnung `cheapApprox`).

   Regeln der Hülle: Abhängigkeiten ziehen ihr Ziel auch dann, wenn es
   optional ist oder in einer nicht gewählten Alternative steht — gebraucht
   ist gebraucht; nur verworfene Ziele nie (§9: verworfen zählt nie), deren
   Unerfüllbarkeit zeigt der effektive Status (D39). Bei doppelter ID gilt
   die erste Vergabe (D36); Zyklen enden über die Mengen-Prüfung von selbst. */
const EXACT_LIMIT = 20000;
export function computeCheapPlan(roots){
  const nodes = [], byId = new Map(), referenced = new Set();
  (function walk(ns){
    for(const n of ns){
      nodes.push(n);
      if(n.id != null && !byId.has(n.id)) byId.set(n.id, n);
      walk(n.children);
    }
  })(roots);
  for(const n of nodes) for(const d of n.deps || []) referenced.add(d);
  const anyDeps = referenced.size > 0;

  /* Teilbaum berührt die Kopplung? (hat Abhängigkeiten oder wird gebraucht) */
  const touches = new Map();
  const touch = n => {
    let v = (n.deps && n.deps.length > 0) || (n.id != null && referenced.has(n.id));
    for(const k of n.children) v = touch(k) || v;
    touches.set(n, v);
    return v;
  };
  roots.forEach(touch);

  /* Wahlpunkte: disjunktive Gruppen mit mehr als einer Alternative.
     Lokale Wahl vorab (kleinste rekursive Kosten, Gleichstand ⇒ erste) —
     sie gilt für ungekoppelte Gruppen und für den gierigen Rückfall. */
  const coupled = [], localChoice = new Map();
  const groups = [];
  /* Nur Kindergruppen — Wurzeln sind immer alle nötig (wie bisher). */
  (function groupsOf(ns){
    for(const n of ns){
      const kids = pathChildren(n);
      if(kids.length > 1 && gateOf(kids) !== 'and') groups.push(kids);
      groupsOf(n.children);
    }
  })(roots);
  for(const kids of groups){
    let best = kids[0], bc = cheapestCost(kids[0]);
    for(const k of kids.slice(1)){ const c = cheapestCost(k); if(c < bc){ bc = c; best = k; } }
    localChoice.set(kids[0], best);   /* Schlüssel: erstes Kind der Gruppe */
    if(anyDeps && kids.some(k => touches.get(k))) coupled.push(kids);
  }

  /* Nötige Menge für eine Belegung der gekoppelten Gruppen. */
  const needed = choice => {
    const set = new Set(), queue = [...roots];
    while(queue.length){
      const n = queue.pop();
      if(set.has(n)) continue;
      set.add(n);
      const kids = pathChildren(n);
      if(kids.length){
        if(gateOf(kids) !== 'and'){
          queue.push(kids.length === 1 ? kids[0]
            : (choice.get(kids[0]) || localChoice.get(kids[0])));
        } else for(const k of kids) queue.push(k);
      }
      for(const d of n.deps || []){
        const t = byId.get(d);
        if(t && !(t.status && t.status.key === 'verworfen')) queue.push(t);
      }
    }
    return set;
  };
  const costOf = set => { let c = 0; set.forEach(n => c += ownCost(n)); return c; };

  let product = 1;
  for(const kids of coupled){ product *= kids.length; if(product > EXACT_LIMIT) break; }
  if(product > EXACT_LIMIT){
    /* Gierig, aber benannt (D42): lokale Wahl überall, Hülle trotzdem. */
    return {set: needed(new Map()), exact: false};
  }

  /* Erschöpfend, lexikografisch — frühere Gruppen wechseln zuletzt, strikt
     kleiner gewinnt: Bei Gleichstand bleibt so die erste Alternative (§9). */
  const idx = coupled.map(() => 0);
  let best = null, bc = Infinity;
  for(;;){
    const choice = new Map();
    coupled.forEach((kids, g) => choice.set(kids[0], kids[idx[g]]));
    const set = needed(choice);
    const c = costOf(set);
    if(c < bc){ bc = c; best = set; }
    let g = coupled.length - 1;
    while(g >= 0 && ++idx[g] >= coupled[g].length){ idx[g] = 0; g--; }
    if(g < 0) break;
  }
  return {set: best, exact: true};
}
/* Menge der nötigen Knoten über alle Wurzeln (Rückgabe wie bisher). */
export function computeCheapSet(roots){
  return computeCheapPlan(roots).set;
}
/* CSS-Klassen für den günstigen Pfad. Leere `cheapSet` (Pfad aus) ⇒ ''.
   Endknoten (kein Kind liegt auf dem Pfad) bekommt zusätzlich 'cheap-leaf'. */
/* Liegt im Teilbaum eines Knotens etwas auf dem Pfad? Gebraucht für
   eingeklappte Knoten (siehe `cheapCls`). Verworfene sind nie in `cheapSet`
   (SPEC §9), es braucht also keine eigene Filterung. */
export function hidesCheap(n, cheapSet){
  for(const k of n.children || []){
    if(cheapSet.has(k) || hidesCheap(k, cheapSet)) return true;
  }
  return false;
}

export function cheapCls(n, cheapSet, collapsed){
  /* Eingeklappt steht der Knoten stellvertretend für seinen ganzen Teilbaum
     (SPEC §9/D38): Liegt darin etwas auf dem Pfad, ist er dessen tiefste noch
     SICHTBARE Station — sonst überspränge die Linie den Zweig, als wäre dort
     nichts zu tun. Das gilt auch, wenn er selbst nicht gebraucht wird, sein
     Teilbaum aber schon (eine per `:#…` gezogene Alternative, D42): Er ist
     dann der einzige sichtbare Griff auf nötige Arbeit und darf deshalb auch
     nicht von der Inversion ausgeblasst werden. */
  if(collapsed) return (cheapSet.has(n) || hidesCheap(n, cheapSet)) ? 'cheap cheap-leaf' : '';
  if(!cheapSet.has(n)) return '';
  const leaf = !pathChildren(n).some(k => cheapSet.has(k));
  return leaf ? 'cheap cheap-leaf' : 'cheap';
}

/* ---------- Effektiver Status (SPEC §4/§9, D39) ----------
   Fortschritts-Rang entlang der Ergebnis-Skala (D5). Außerhalb der Skala:
   neutrale und verworfene Knoten zählen als 0 („nichts Anrechenbares"),
   High Risk als 1 (Absicht ohne Investition, D35). */
export const PROGRESS_RANK = { idee:0, geplant:1, highrisk:1, arbeit:2, durchstich:3, fertig:4, prod:5 };
const RANK_STATUS_KEY = ['idee', 'geplant', 'arbeit', 'durchstich', 'fertig', 'prod'];
export function progressRank(n){
  if(!n.status) return 0;
  const r = PROGRESS_RANK[n.status.key];
  return r === undefined ? 0 : r;   /* verworfen -> 0 */
}
/* Diskrepanzen des effektiven Status: Map Knoten -> effektiver Status-KEY,
   nur für Knoten, deren eigener Status weiter ist. Effektiver Rang = Minimum
   des intrinsischen Rangs über die Abhängigkeits-Hülle (Knoten selbst plus
   alles per `:#…` Erreichbare), als Fixpunkt-Iteration — Ränge sinken nur,
   Zyklen teilen so von selbst ihr Minimum („wird gemeinsam fertig", §1).
   Unbekannte IDs zählen nicht (schon gewarnt, `unknownDep`); bei doppelter
   ID gilt die ERSTE Vergabe (D36/D39). */
export function effectiveStatus(roots){
  const nodes = [], byId = new Map();
  (function walk(ns){
    for(const n of ns){
      nodes.push(n);
      if(n.id != null && !byId.has(n.id)) byId.set(n.id, n);
      walk(n.children);
    }
  })(roots);
  const eff = new Map(nodes.map(n => [n, progressRank(n)]));
  let changed = true;
  while(changed){
    changed = false;
    for(const n of nodes){
      let v = eff.get(n);
      for(const d of n.deps || []){
        const target = byId.get(d);
        if(target && eff.get(target) < v) v = eff.get(target);
      }
      if(v < eff.get(n)){ eff.set(n, v); changed = true; }
    }
  }
  const map = new Map();
  eff.forEach((r, n) => { if(r < progressRank(n)) map.set(n, RANK_STATUS_KEY[r]); });
  return map;
}

/* ---------- Was ist neu? (D28) ----------
   „Neu" heißt hier bewusst nicht „Zeile hinzugefügt", sondern **neu in
   Produktion**: ein Knoten, der jetzt `[^]` trägt und es in der zuletzt
   gesehenen Fassung noch nicht tat (weil er anders stand oder fehlte). Das ist
   die Änderungsmeldung, die einen Plan-Leser wirklich interessiert.

   Knoten-Identität ist der **Pfad der Labels** von der Wurzel, nicht die
   Zeilennummer: Umeinrücken oder Umsortieren erzeugt so keine Falschmeldungen.
   Gleichnamige Geschwister werden über einen Index unterschieden. Ein
   umbenanntes Label gilt als neuer Knoten — gewollt, der Text ist der Vertrag
   (D14). */
function walkKeys(nodes, parentKey, fn){
  const seen = new Map();
  for(const n of nodes){
    const base = parentKey + ' > ' + n.label;
    const i = seen.get(base) || 0;
    seen.set(base, i + 1);
    const key = i ? base + '#' + i : base;
    fn(key, n);
    walkKeys(n.children, key, fn);
  }
}
/* Knoten -> stabiler Schlüssel (Label-Pfad) über den ganzen Baum. Dieselbe
   Identität wie bei „Was ist neu?" — sie überlebt Umsortieren und Neu-Parsen;
   genutzt für die interaktiven Falt-Eingriffe (D38). */
export function nodeKeys(roots){
  const map = new Map();
  walkKeys(roots, '', (key, n) => map.set(n, key));
  return map;
}

/* ---------- Faltmarken (SPEC §1/§9, D38) ----------
   Anfangszustand der Faltung aus den Textmarken: `>` klappt den Knoten ein.
   `<` (und mit `rescueFocus` auch die Fokusmarke `!!!`) holt den eigenen
   Teilbaum hervor, indem die Faltung die Pfad-Ebenen HINUNTERWANDERT: Jeder
   eingeklappte Vorfahr wird geöffnet, seine Nicht-Pfad-Kinder werden
   stattdessen eingeklappt. Sichtbar ist genau der Pfad samt Teilbaum, die
   Geschwister stehen als einzelne eingeklappte Knoten da — und jede
   gezeichnete Kante bleibt eine echte. Ein `>` innerhalb des hervorgeholten
   Teilbaums bleibt respektiert. */
export function initialCollapsed(roots, rescueFocus){
  const set = new Set();
  const paths = [];
  const walk = (n, path) => {
    const p = path.concat(n);
    if(n.fold === '>') set.add(n);
    if(n.fold === '<' || (rescueFocus && n.focus)) paths.push(p);
    n.children.forEach(c => walk(c, p));
  };
  roots.forEach(r => walk(r, []));
  for(const p of paths){
    for(let i = 0; i < p.length - 1; i++){
      if(!set.has(p[i])) continue;
      set.delete(p[i]);
      for(const c of p[i].children)
        if(c !== p[i+1] && c.children.length) set.add(c);
    }
    set.delete(p[p.length - 1]);   /* der geholte Knoten selbst ist offen */
  }
  return set;
}

/* key -> Status-Schlüssel ('' für neutrale Knoten) über den ganzen Baum. */
export function statusByKey(roots){
  const map = new Map();
  walkKeys(roots, '', (key, n) => map.set(key, n.status ? n.status.key : ''));
  return map;
}
/* Menge der Knoten, die gegenüber `prevRoots` NEU in Produktion sind.
   `prevRoots == null` (noch keine Vergleichsfassung) ⇒ leere Menge — sonst
   leuchtete beim ersten Ansehen der ganze fertige Teil des Plans auf. */
export function freshProdSet(prevRoots, currRoots){
  const set = new Set();
  if(!prevRoots) return set;
  const before = statusByKey(prevRoots);
  walkKeys(currRoots, '', (key, n) => {
    if(n.status && n.status.key === 'prod' && before.get(key) !== 'prod') set.add(n);
  });
  return set;
}
