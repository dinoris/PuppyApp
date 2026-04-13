// js/trophies.js

import { getAutomaticMilestones } from "./milestones.js";

export function getCombinedAwards(allAwards, allEntries) {
  const manual = allAwards.map(item => ({
    ...item,
    isAuto: false
  }));

  return [
    ...manual,
    ...getAutomaticMilestones(allEntries)
  ].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}