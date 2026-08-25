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
   schätzt sie zwar (`assumedSize`, D18/D66), das ist aber eine Kostenannahme
   des Werkzeugs und keine Aussage des Autors; danach den Baum zuzuklappen
   hieße, eine Vermutung wie eine Angabe zu behandeln. */
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
   Größe wird aus den Teilpaketen geschätzt (`assumedSize`, D66).
   Ist in einer disjunktiven Gruppe etwas realisiert, wird nur noch
   unter den realisierten gewählt (`chosenPool`, D61).
   Optionale Kinder (`+`, SPEC §3/D29) fallen hier ebenfalls heraus — sie sind
   per Definition entbehrlich, also weder Kostenanteil noch Pfadknoten. Da alle
   Nutzer über diese Funktion gehen, gilt das samt Teilbaum.
   AUSNAHME (D61): Wird an der Zugabe gerade gearbeitet (`isStarted`), liegt
   sie auf dem Pfad — angefangene Arbeit IST die offene Front. Erledigte
   Zugaben bleiben draußen: Dort ist nichts mehr zu tun, und was darunter
   offen blieb, ist mit ihnen zusammen entbehrlich (§3). */
export function pathChildren(n){
  return n.children.filter(k =>
    (!k.optional || isStarted(k)) && (!k.status || k.status.key !== 'verworfen'));
}
/* ---------- Erledigt: was nichts mehr kostet (SPEC §9, D46) ----------
   `[x]` fertig und `[^]` in Produktion. Die Beförderung auf Prod ist keine
   Kostenfrage (D30: das tut der Deploy), fertig ist also die Schwelle.
   Angefangenes (`[~]`, `[/]`) zählt bewusst voll: Die Arbeit ist noch offen,
   und Bruchteile ordinaler T-Shirt-Größen wären erfunden.
   Maßgeblich ist der INTRINSISCHE Status — investiert ist investiert, auch
   wenn Abhängigkeiten den Knoten effektiv zurückhalten (D39); deren eigene
   Kosten stehen ohnehin an ihnen selbst. */
export function isDone(n){
  return !!n.status && (n.status.key === 'fertig' || n.status.key === 'prod');
}
/* „realisiert" (SPEC §3, D35): Kosten investiert oder mehr. Trägt die
   XOR-Regel und — seit D61 — die Wahl in Alternativgruppen. */
export function isRealized(n){
  return !!n.status && ['arbeit', 'durchstich', 'fertig', 'prod'].includes(n.status.key);
}
/* Angefangen und noch offen: realisiert, aber nicht erledigt (D61). Aus zwei
   vorhandenen Begriffen zusammengesetzt statt einer dritten Schwelle. */
export function isStarted(n){ return isRealized(n) && !isDone(n); }
/* Wahlmenge einer disjunktiven Gruppe (SPEC §9, D61): Ist etwas realisiert,
   ist die Wahl getroffen — dann wird nur noch unter den realisierten gewählt.
   Sonst stehen alle zur Wahl. Die Kostenregel (kleinste rekursive Kosten,
   Gleichstand ⇒ erste) gilt innerhalb der Menge unverändert. */
export function chosenPool(kids){
  const real = kids.filter(isRealized);
  return real.length ? real : kids;
}
/* ---------- Geschätzte Größe bei fehlender Angabe (SPEC §9, D66) ----------
   Statt pauschal M (die alte D18-Annahme) wird aus den Teilpaketen geschätzt:
   MINDESTENS die größte Größe der zählenden Kinder; tragen drei oder mehr
   Kinder diese größte Größe, eine Stufe mehr (Deckel XXL). Es zählen dieselben
   Kinder wie beim Größen-Konflikt (§5/D62) — direkte, verworfene und optionale
   nie, disjunktiv (`|`/`=`) nur die kleinste Alternative (aus `chosenPool`,
   D61: eine getroffene Wahl gilt) — nur dass Kinder OHNE Größe hier rekursiv
   mitgeschätzt werden: geschätzt wird ohnehin. Ohne zählende Kinder bleibt es
   beim M-Rückfall. Memo per WeakMap: `computeCheapPlan` ruft `ownCost` je
   Suchbelegung über die ganze Menge — ungecacht wäre das O(n²) je Belegung;
   der Parse-Baum wird bei jedem Tastendruck neu gebaut, der Cache kann also
   nie veralten. */
const SIZE_BY_RANK = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const ASSUMED = new WeakMap();
export function assumedSize(n){
  if(n.size) return n.size;
  const memo = ASSUMED.get(n);
  if(memo) return memo;
  const counting = n.children.filter(k =>
    !k.optional && (!k.status || k.status.key !== 'verworfen'));
  /* Erledigte Kinder zählen nicht mit (D70): Die Schätzung ist eine
     Kostenannahme, keine Autoren-Aussage — sie schätzt die noch OFFENE
     Arbeit (D46). Eine ANGEGEBENE Größe bleibt dagegen, wie sie geschrieben
     ist (D69). In einer disjunktiven Gruppe stellt eine erledigte
     realisierte Alternative die Gruppe fertig — genau die würde der Pfad
     wählen (Kosten 0), die Gruppe trägt also nichts mehr bei. */
  let kids;
  if(counting.length && gateOf(counting) !== 'and'){
    const pool = chosenPool(counting);
    kids = pool.some(isDone) ? [] : pool;
  } else {
    kids = counting.filter(k => !isDone(k));
  }
  let size = 'M';
  if(kids.length){
    if(gateOf(counting) !== 'and'){
      /* nur eine Alternative wird realisiert — die kleinste ist der Boden */
      size = SIZE_BY_RANK[Math.min(...kids.map(k => SIZE_RANK[assumedSize(k)]))];
    } else {
      const ranks = kids.map(k => SIZE_RANK[assumedSize(k)]);
      const max = Math.max(...ranks);
      const atMax = ranks.filter(r => r === max).length;
      size = SIZE_BY_RANK[Math.min(max + (atMax >= 3 ? 1 : 0), SIZE_RANK.XXL)];
    }
  } else if(counting.length){
    /* Alles Benannte ist erledigt, der Knoten selbst nicht: Der Rest ist
       seine eigene Abschlussarbeit (er ist die Station, D46) — XS statt des
       M-Rückfalls, sonst ERHÖHTE das Fertigstellen des letzten Kindes den
       Preis. Nur der echte Blattknoten ohne Kinder bleibt bei M. */
    size = 'XS';
  }
  ASSUMED.set(n, size);
  return size;
}
/* fehlende Größe wird geschätzt (assumedSize); Erledigtes kostet nichts mehr */
export function ownCost(n){ return isDone(n) ? 0 : SIZE_RANK[assumedSize(n)] + 1; }
/* Die Größe bepreist den GANZEN Teilbaum (SPEC §9, D69): Wer ein Paket mit
   (S) bewertet hat, hat den Teilbaum bewertet — die Teilpakete kommen nicht
   noch einmal obendrauf. Ob sie in die Größe passen, prüft der
   Größen-Konflikt (§5/D62); fehlt die Größe, vertritt die Schätzung sie
   (assumedSize, D66). Der Preis einer Alternative ist damit schlicht ihr
   eigener — die frühere Rekursion (eigene Größe plus Summe/Minimum der
   Kinder) bestrafte gerade die sorgfältig zerlegten Pakete. */
export function cheapestCost(n){ return ownCost(n); }
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
    const pool = chosenPool(kids);
    let best = pool[0], bc = cheapestCost(pool[0]);
    for(const k of pool.slice(1)){ const c = cheapestCost(k); if(c < bc){ bc = c; best = k; } }
    localChoice.set(kids[0], best);   /* Schlüssel: erstes Kind der Gruppe */
    /* Eine entschiedene Gruppe (genau eine realisierte Alternative, D61) ist
       keine freie Variable mehr — sie koppelt nicht und verkleinert die Suche. */
    if(anyDeps && pool.length > 1 && pool.some(k => touches.get(k)))
      coupled.push({key: kids[0], pool});
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
  /* Preis einer Belegung (D69): Jeder nötige Knoten zählt nur mit dem, was
     seine Größe über die nötigen Teilpakete HINAUS behauptet (nie negativ) —
     die Summe bepreist einen Teilbaum so mit seiner Größe, statt
     Zerlegungstiefe zu bestrafen; gemeinsam Gebrauchtes zählt über die
     Mengen-Vereinigung weiterhin nur einmal. */
  const costOf = set => {
    let c = 0;
    set.forEach(n => {
      let kids = 0;
      for(const k of pathChildren(n)) if(set.has(k)) kids += ownCost(k);
      c += Math.max(0, ownCost(n) - kids);
    });
    return c;
  };

  let product = 1;
  for(const grp of coupled){ product *= grp.pool.length; if(product > EXACT_LIMIT) break; }
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
    coupled.forEach((grp, i) => choice.set(grp.key, grp.pool[idx[i]]));
    const set = needed(choice);
    const c = costOf(set);
    if(c < bc){ bc = c; best = set; }
    let g = coupled.length - 1;
    while(g >= 0 && ++idx[g] >= coupled[g].pool.length){ idx[g] = 0; g--; }
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
/* Dasselbe, aber nur für noch OFFENE Pfadarbeit (D46): Erledigtes zählt nicht
   mehr, es ist keine Station und hält auch keine unter sich. */
export function hidesOpenCheap(n, cheapSet){
  for(const k of n.children || []){
    if((cheapSet.has(k) && !isDone(k)) || hidesOpenCheap(k, cheapSet)) return true;
  }
  return false;
}

export function cheapCls(n, cheapSet, collapsed){
  /* Stationen sind die tiefsten noch OFFENEN Knoten des Pfads (D46). Ein
     erledigter Knoten bleibt `cheap` — er gehört zum Pfad und behält seine
     volle Statusfarbe —, trägt aber keinen Punkt und wird von der Linie
     übergangen; die zeigt den günstigsten noch zu gehenden Rest.
     Eingeklappt steht der Knoten stellvertretend für seinen ganzen Teilbaum
     (SPEC §9/D38): Liegt darin noch offene Pfadarbeit, ist er deren tiefste
     noch SICHTBARE Station — sonst überspränge die Linie den Zweig, als wäre
     dort nichts zu tun. Das gilt auch, wenn er selbst nicht gebraucht wird,
     sein Teilbaum aber schon (eine per `:#…` gezogene Alternative, D42): Er
     ist dann der einzige sichtbare Griff auf nötige Arbeit und darf deshalb
     auch nicht von der Inversion ausgeblasst werden. */
  const onPath = cheapSet.has(n);
  if(collapsed){
    if((onPath && !isDone(n)) || hidesOpenCheap(n, cheapSet)) return 'cheap cheap-leaf';
    return (onPath || hidesCheap(n, cheapSet)) ? 'cheap' : '';
  }
  if(!onPath) return '';
  if(isDone(n)) return 'cheap';
  return hidesOpenCheap(n, cheapSet) ? 'cheap' : 'cheap cheap-leaf';
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

/* Textzeile -> Zeile des Knotens, der sie im Diagramm VERTRITT (SPEC §9,
   D38-Nachtrag 4): der Knoten selbst, solange er sichtbar ist; liegt er in
   einem eingeklappten Teilbaum, der nächste sichtbare Vorfahr — der
   eingeklappte Knoten vertritt seinen Teilbaum, auch für die
   Cursor-Hervorhebung und den Alt+Klick aus dem Text. Beschreibungs- und
   Fortsetzungszeilen (`descLines`) zählen zu ihrem Knoten. Ausgeblendete
   verworfene Elemente fehlen in der Map (visibleChildren) und heben damit
   weiterhin nichts hervor — die SPEC-§9-Regel bleibt. */
export function lineTargets(roots, collapsed, showDiscarded){
  const map = new Map();
  /* `anchor` ist null, solange wir im Sichtbaren sind; darunter die Zeile des
     äußersten eingeklappten Knotens — tiefere Faltungen ändern sie nicht. */
  const walk = (ns, anchor) => {
    for(const n of ns){
      const target = anchor ?? n.line;
      if(n.line != null) map.set(n.line, target);
      if(n.descLines) n.descLines.forEach(l => map.set(l, target));
      const next = anchor ?? (collapsed.has(n) ? n.line : null);
      walk(visibleChildren(n, showDiscarded), next);
    }
  };
  walk(roots, null);
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
