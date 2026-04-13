import { getCombinedAwards } from "./trophies.js";
import { getAutomaticMilestones } from "./milestones.js";
import { ADMIN_EMAILS, PUPPIES, TROPHY_OPTIONS, MILESTONE_OPTIONS } from "./config.js";
import { todayStr, formatDate, escapeHtml } from "./helpers.js";
import { state } from "./state.js";
import {
  auth,
  db,
  provider,
  ref,
  push,
  remove,
  onValue,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "./firebase-service.js";

let {
  currentUser,
  isAdmin,
  allEntries,
  allAwards,
  growthChart,
  activeTab
} = state;

function getPuppy(id) {
  return PUPPIES.find(p => p.id === Number(id));
}

function parseEntriesSnapshot(snapshot) {
  if (!snapshot.exists()) return [];
  const raw = snapshot.val();

  return Object.entries(raw)
    .map(([id, data]) => ({
      id,
      ...data,
      puppyId: Number(data.puppyId),
      weight: Number(data.weight)
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.puppyId - b.puppyId);
}

function parseAwardsSnapshot(snapshot) {
  if (!snapshot.exists()) return [];
  const raw = snapshot.val();

  return Object.entries(raw)
    .map(([id, data]) => ({
      id,
      puppyId: Number(data.puppyId),
      type: data.type,
      title: data.title,
      date: data.date,
      notes: data.notes || ""
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function buildTimelines(entries) {
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

// ✅ NEW DOM (split)
const trophyPuppy = document.getElementById("trophy-puppy");
const trophyTitle = document.getElementById("trophy-title");
const trophyDate = document.getElementById("trophy-date");
const trophyNotes = document.getElementById("trophy-notes");
const btnTrophyAdd = document.getElementById("btn-trophy-add");
const trophyFilter = document.getElementById("trophy-filter-puppy");
const trophiesContainer = document.getElementById("trophies-container");

const milestonePuppy = document.getElementById("milestone-puppy");
const milestoneTitle = document.getElementById("milestone-title");
const milestoneDate = document.getElementById("milestone-date");
const milestoneNotes = document.getElementById("milestone-notes");
const btnMilestoneAdd = document.getElementById("btn-milestone-add");
const milestoneFilter = document.getElementById("milestone-filter-puppy");
const milestonesAwardsContainer = document.getElementById("milestones-awards-container");

// EXISTING DOM (unchanged)
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const authStatus = document.getElementById("auth-status");
const readonlyBanner = document.getElementById("readonly-banner");
const btnAdd = document.getElementById("btn-add");
const inputPuppy = document.getElementById("input-puppy");
const inputDate = document.getElementById("input-date");
const inputWeight = document.getElementById("input-weight");
const formMessage = document.getElementById("form-message");
const entriesTbody = document.getElementById("entries-tbody");
const filterPuppy = document.getElementById("filter-puppy");
const colDelete = document.getElementById("col-delete");
const toggleAverage = document.getElementById("toggle-average");

function syncState() {
  state.currentUser = currentUser;
  state.isAdmin = isAdmin;
  state.allEntries = allEntries;
  state.allAwards = allAwards;
  state.growthChart = growthChart;
  state.activeTab = activeTab;
}

function updateAuthUI(user) {
  currentUser = user;
  isAdmin = ADMIN_EMAILS.includes(user?.email);
  syncState();

  btnAdd.disabled = !isAdmin;
  btnTrophyAdd.disabled = !isAdmin;
  btnMilestoneAdd.disabled = !isAdmin;

  renderTable();
  renderTrophies();
  renderMilestonesAwards();
}

// 🔥 NEW ADD FUNCTIONS
btnTrophyAdd?.addEventListener("click", async () => {
  if (!isAdmin) return;

  await push(ref(db, "awards"), {
    puppyId: Number(trophyPuppy.value),
    type: "trophy",
    title: trophyTitle.value,
    date: trophyDate.value,
    notes: trophyNotes.value
  });
});

btnMilestoneAdd?.addEventListener("click", async () => {
  if (!isAdmin) return;

  await push(ref(db, "awards"), {
    puppyId: Number(milestonePuppy.value),
    type: "milestone",
    title: milestoneTitle.value,
    date: milestoneDate.value,
    notes: milestoneNotes.value
  });
});
// 🔥 SPLIT RENDERING

function renderTrophies() {
  if (!trophiesContainer) return;

  const combined = getCombinedAwards(allAwards, allEntries);
  const trophies = combined.filter(a => a.type === "trophy");

  trophiesContainer.innerHTML = trophies.map(t => `
    <div class="award-item">
      🏆 ${escapeHtml(t.title)} (${formatDate(t.date)})
    </div>
  `).join("") || `<p class="empty-state">No trophies yet.</p>`;
}

function renderMilestonesAwards() {
  if (!milestonesAwardsContainer) return;

  const combined = getCombinedAwards(allAwards, allEntries);
  const milestones = combined.filter(a => a.type === "milestone");

  milestonesAwardsContainer.innerHTML = milestones.map(m => `
    <div class="award-item">
      🎉 ${escapeHtml(m.title)} (${formatDate(m.date)})
    </div>
  `).join("") || `<p class="empty-state">No milestones yet.</p>`;
}

// 🔥 TAB LOGIC
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");

    if (tab === "trophies") renderTrophies();
    if (tab === "milestones") renderMilestonesAwards();
  });
});

// 🔥 INIT UI (FIXED)
function initUI() {
  const puppyOptions = PUPPIES.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");

  inputPuppy.innerHTML = `<option value="">— select puppy —</option>` + puppyOptions;

  trophyPuppy.innerHTML = `<option value="">— select puppy —</option>` + puppyOptions;
  milestonePuppy.innerHTML = `<option value="">— select puppy —</option>` + puppyOptions;

  trophyTitle.innerHTML = TROPHY_OPTIONS.map(t =>
    `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`
  ).join("");

  milestoneTitle.innerHTML = MILESTONE_OPTIONS.map(m =>
    `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`
  ).join("");

  inputDate.value = todayStr();
  trophyDate.value = todayStr();
  milestoneDate.value = todayStr();
}

initUI();
syncState();