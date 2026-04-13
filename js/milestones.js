// js/milestones.js

import { PUPPIES } from "./config.js";

export function buildTimelines(entries) {
  const map = {};
  for (const p of PUPPIES) map[p.id] = [];

  for (const e of entries) {
    if (map[e.puppyId]) {
      map[e.puppyId].push({
        date: e.date,
        weight: e.weight,
        entryId: e.id
      });
    }
  }

  for (const pid of Object.keys(map)) {
    const arr = map[pid].sort((a, b) => a.date.localeCompare(b.date));
    arr.forEach((item, i) => {
      item.dayNumber = i + 1;
    });
    map[pid] = arr;
  }

  return map;
}

export function getAutomaticMilestones(entries) {
  const timelines = buildTimelines(entries);
  const auto = [];

  for (const [pid, arr] of Object.entries(timelines)) {
    if (arr.length < 2) continue;

    const birthWeight = arr[0].weight;
    const doubled = arr.find((e, i) => i > 0 && e.weight >= birthWeight * 2);

    if (doubled) {
      auto.push({
        id: `auto-double-${pid}`,
        puppyId: Number(pid),
        type: "milestone",
        title: "Doubled Birth Weight",
        date: doubled.date,
        notes: `${birthWeight}g → ${doubled.weight}g`,
        isAuto: true
      });
    }
  }

  return auto.sort((a, b) => b.date.localeCompare(a.date));
}