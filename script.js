/**
 * Puppy Weight Tracker — script.js
 * Firebase Realtime DB + Auth (Google), Chart.js, Vanilla JS
 * Architecture: Config → Data layer → UI layer → Init
 */

// ═══════════════════════════════════════════════
// 0. WAIT FOR FIREBASE MODULES (loaded via type="module" in HTML)
// ═══════════════════════════════════════════════
const {
  initializeApp,
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  getDatabase, ref, push, remove, onValue
} = window.__firebaseModules;

// ═══════════════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDvL0emjzWd450LvuOCTNs-D3yUOlwy4UA",
  authDomain: "puppy-app-41bf0.firebaseapp.com",
  databaseURL: "https://puppy-app-41bf0-default-rtdb.firebaseio.com",
  projectId: "puppy-app-41bf0",
  appId: "1:958889040689:web:694feb88aca77cb2fbae10"
};

const ADMIN_EMAIL = "bios80@gmail.com";

const PUPPIES = [
  { id: 1,  name: "Green",   gender: "Male",   color: "#3a9e4a" },
  { id: 2,  name: "Pink",    gender: "Female", color: "#e05fa0" },
  { id: 3,  name: "Blue",    gender: "Male",   color: "#3a7bd5" },
  { id: 4,  name: "Red",     gender: "Male",   color: "#d94040" },
  { id: 5,  name: "Yellow",  gender: "Female", color: "#d4a017" },
  { id: 6,  name: "Purple",  gender: "Female", color: "#7e4cb4" },
  { id: 7,  name: "Orange",  gender: "Male",   color: "#e07b3a" },
  { id: 8,  name: "White",   gender: "Female", color: "#9e9e9e" },
];

// ═══════════════════════════════════════════════
// 2. FIREBASE INIT
// ═══════════════════════════════════════════════
const app      = initializeApp(FIREBASE_CONFIG);
const auth     = getAuth(app);
const db       = getDatabase(app);
const provider = new GoogleAuthProvider();

// ═══════════════════════════════════════════════
// 3. APP STATE
// ═══════════════════════════════════════════════
let currentUser  = null;   // Firebase user or null
let isAdmin      = false;
let allEntries   = [];     // [{ id, puppyId, date, weight }]
let growthChart  = null;   // Chart.js instance
let activeTab    = "log";

// ═══════════════════════════════════════════════
// 4. HELPERS
// ═══════════════════════════════════════════════
function getPuppy(id) {
  return PUPPIES.find(p => p.id === Number(id));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Given raw Firebase snapshot, return sorted array of entries.
 */
function parseSnapshot(snapshot) {
  if (!snapshot.exists()) return [];
  const raw = snapshot.val();
  return Object.entries(raw)
    .map(([id, data]) => ({ id, ...data, puppyId: Number(data.puppyId), weight: Number(data.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.puppyId - b.puppyId);
}

/**
 * Build per-puppy timeline: { puppyId -> [{date, weight, dayNumber}] }
 */
function buildTimelines(entries) {
  const map = {};
  for (const p of PUPPIES) map[p.id] = [];
  for (const e of entries) {
    if (map[e.puppyId]) map[e.puppyId].push({ date: e.date, weight: e.weight, entryId: e.id });
  }
  // Add day numbers per puppy (1 = first recorded date)
  for (const pid of Object.keys(map)) {
    const arr = map[pid].sort((a, b) => a.date.localeCompare(b.date));
    arr.forEach((item, i) => { item.dayNumber = i + 1; });
    map[pid] = arr;
  }
  return map;
}

/**
 * For a sorted puppy array, compute daily change vs previous entry.
 */
function computeChange(arr, index) {
  if (index === 0) return null;
  return arr[index].weight - arr[index - 1].weight;
}

function statusBadge(change, isFirst) {
  if (isFirst) return '<span class="badge badge-first">First</span>';
  if (change === null) return '<span class="badge badge-neutral">—</span>';
  if (change < 0)           return '<span class="badge badge-loss">⬇ Weight Loss</span>';
  if (change < 10)          return '<span class="badge badge-low">⚠ Low Gain</span>';
  return '<span class="badge badge-good">✓ Good Gain</span>';
}

function changeCell(change, isFirst) {
  if (isFirst || change === null) return '<span class="change-neu">—</span>';
  if (change > 0) return `<span class="change-pos">+${change}g</span>`;
  if (change < 0) return `<span class="change-neg">${change}g</span>`;
  return '<span class="change-neu">±0g</span>';
}

// All unique sorted dates across all entries
function allDates(timelines) {
  const set = new Set();
  for (const arr of Object.values(timelines)) arr.forEach(e => set.add(e.date));
  return [...set].sort();
}

// ═══════════════════════════════════════════════
// 5. DOM REFERENCES
// ═══════════════════════════════════════════════
const btnLogin         = document.getElementById("btn-login");
const btnLogout        = document.getElementById("btn-logout");
const authStatus       = document.getElementById("auth-status");
const readonlyBanner   = document.getElementById("readonly-banner");
const btnAdd           = document.getElementById("btn-add");
const inputPuppy       = document.getElementById("input-puppy");
const inputDate        = document.getElementById("input-date");
const inputWeight      = document.getElementById("input-weight");
const formMessage      = document.getElementById("form-message");
const entriesTbody     = document.getElementById("entries-tbody");
const filterPuppy      = document.getElementById("filter-puppy");
const colDelete        = document.getElementById("col-delete");
const toggleAverage    = document.getElementById("toggle-average");

// Insights
const insHeaviest   = document.getElementById("ins-heaviest-val");
const insLightest   = document.getElementById("ins-lightest-val");
const insAvg        = document.getElementById("ins-avg-val");
const insGainer     = document.getElementById("ins-gainer-val");
const alertsCont    = document.getElementById("alerts-container");
const milestonesCont= document.getElementById("milestones-container");
const summaryBody   = document.getElementById("puppy-summary-container");

// ═══════════════════════════════════════════════
// 6. AUTH UI
// ═══════════════════════════════════════════════
function updateAuthUI(user) {
  currentUser = user;
  isAdmin     = user?.email === ADMIN_EMAIL;

  if (user) {
    authStatus.textContent = isAdmin ? `Editor: ${user.email}` : `Viewer: ${user.email}`;
    btnLogin.style.display  = "none";
    btnLogout.style.display = "inline-block";
  } else {
    authStatus.textContent  = "";
    btnLogin.style.display  = "inline-block";
    btnLogout.style.display = "none";
  }

  // Read-only banner: show for non-admin (logged out or non-admin user)
  readonlyBanner.style.display = isAdmin ? "none" : "block";

  // Form button
  btnAdd.disabled = !isAdmin;

  // Delete column
  colDelete.style.display = isAdmin ? "" : "none";

  // Re-render table to show/hide delete buttons
  renderTable();
}

btnLogin.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login error:", err);
    showMessage("Login failed: " + err.message, "error");
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout error:", err);
  }
});

onAuthStateChanged(auth, user => updateAuthUI(user));

// ═══════════════════════════════════════════════
// 7. FIREBASE DATA LISTENER (real-time sync)
// ═══════════════════════════════════════════════
const entriesRef = ref(db, "entries");

onValue(entriesRef, (snapshot) => {
  allEntries = parseSnapshot(snapshot);
  renderAll();
}, (err) => {
  console.error("Firebase read error:", err);
  entriesTbody.innerHTML = `<tr><td colspan="8" class="empty-state">⚠ Error loading data: ${err.message}</td></tr>`;
});

// ═══════════════════════════════════════════════
// 8. ADD ENTRY
// ═══════════════════════════════════════════════
btnAdd.addEventListener("click", async () => {
  if (!isAdmin) return;

  const puppyId = Number(inputPuppy.value);
  const date    = inputDate.value;
  const weight  = Number(inputWeight.value);

  // Validation
  if (!puppyId || !date || !weight || weight <= 0) {
    showMessage("Please fill in all fields with valid values.", "error");
    return;
  }

  // Check duplicate
  const dup = allEntries.find(e => e.puppyId === puppyId && e.date === date);
  if (dup) {
    showMessage(`${getPuppy(puppyId)?.name} already has an entry for ${date}.`, "error");
    return;
  }

  btnAdd.disabled = true;
  try {
    await push(entriesRef, { puppyId, date, weight });
    inputWeight.value = "";
    showMessage("Entry added successfully!", "success");
  } catch (err) {
    console.error("Add entry error:", err);
    showMessage("Failed to save: " + err.message, "error");
  } finally {
    btnAdd.disabled = false;
  }
});

function showMessage(msg, type = "info") {
  formMessage.textContent = msg;
  formMessage.className = "form-message" + (type === "success" ? " success" : "");
  setTimeout(() => { formMessage.textContent = ""; formMessage.className = "form-message"; }, 4000);
}

// ═══════════════════════════════════════════════
// 9. DELETE ENTRY
// ═══════════════════════════════════════════════
async function deleteEntry(entryId) {
  if (!isAdmin) return;
  if (!confirm("Delete this entry?")) return;
  try {
    await remove(ref(db, `entries/${entryId}`));
  } catch (err) {
    console.error("Delete error:", err);
    alert("Failed to delete: " + err.message);
  }
}

// ═══════════════════════════════════════════════
// 10. RENDER ALL
// ═══════════════════════════════════════════════
function renderAll() {
  renderTable();
  renderChart();
  renderInsights();
}

// ═══════════════════════════════════════════════
// 11. RENDER TABLE
// ═══════════════════════════════════════════════
function renderTable() {
  const timelines = buildTimelines(allEntries);
  const filterVal = Number(filterPuppy.value) || "all";

  // Build flat rows with change & status
  const rows = [];
  for (const [pidStr, arr] of Object.entries(timelines)) {
    const pid = Number(pidStr);
    arr.forEach((item, i) => {
      const change = computeChange(arr, i);
      rows.push({ ...item, puppyId: pid, change, isFirst: i === 0 });
    });
  }

  // Filter
  const filtered = filterVal === "all" ? rows : rows.filter(r => r.puppyId === filterVal);

  // Sort by date desc, then puppy
  filtered.sort((a, b) => b.date.localeCompare(a.date) || a.puppyId - b.puppyId);

  if (filtered.length === 0) {
    entriesTbody.innerHTML = `<tr><td colspan="8" class="empty-state">No entries yet. Add the first weight above!</td></tr>`;
    return;
  }

  const isAdminNow = isAdmin;
  entriesTbody.innerHTML = filtered.map(row => {
    const puppy = getPuppy(row.puppyId);
    if (!puppy) return "";
    const dateFormatted = new Date(row.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const deleteBtn = isAdminNow
      ? `<button class="btn btn-danger" data-id="${row.entryId}" title="Delete entry">✕</button>`
      : "";
    return `
      <tr>
        <td>${dateFormatted}</td>
        <td><strong>Day ${row.dayNumber}</strong></td>
        <td>
          <div class="puppy-cell">
            <span class="color-dot" style="background:${puppy.color}"></span>
            ${puppy.name}
          </div>
        </td>
        <td>${puppy.gender}</td>
        <td><strong>${row.weight}g</strong></td>
        <td>${changeCell(row.change, row.isFirst)}</td>
        <td>${statusBadge(row.change, row.isFirst)}</td>
        <td>${deleteBtn}</td>
      </tr>`;
  }).join("");

  // Attach delete listeners
  entriesTbody.querySelectorAll(".btn-danger[data-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });
}

// ═══════════════════════════════════════════════
// 12. RENDER CHART
// ═══════════════════════════════════════════════
function renderChart() {
  const timelines = buildTimelines(allEntries);
  const dates = allDates(timelines);

  if (dates.length === 0) {
    if (growthChart) { growthChart.destroy(); growthChart = null; }
    return;
  }

  const showAverage = toggleAverage.checked;
  const dateLabels  = dates.map(d => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  // Build datasets per puppy
  const datasets = PUPPIES.map(puppy => {
    const arr = timelines[puppy.id] || [];
    const dateMap = {};
    arr.forEach(item => { dateMap[item.date] = item.weight; });
    const birthWeight = arr.length > 0 ? arr[0].weight : null;

    const dataPoints = dates.map(d => dateMap[d] ?? null);

    // Point styles: star if weight doubled birth weight
    const pointStyles = dates.map(d => {
      if (!birthWeight || !dateMap[d]) return "circle";
      return dateMap[d] >= birthWeight * 2 ? "star" : "circle";
    });
    const pointRadii = dates.map(d => {
      if (!birthWeight || !dateMap[d]) return 3;
      return dateMap[d] >= birthWeight * 2 ? 9 : 3;
    });

    const hasData = dataPoints.some(v => v !== null);
    return hasData ? {
      label: puppy.name,
      data: dataPoints,
      borderColor: puppy.color,
      backgroundColor: puppy.color + "22",
      borderWidth: 2.5,
      tension: 0.3,
      spanGaps: true,
      pointStyle: pointStyles,
      pointRadius: pointRadii,
      pointHoverRadius: 6,
    } : null;
  }).filter(Boolean);

  // Average line
  if (showAverage && dates.length > 0) {
    const avgData = dates.map(d => {
      const weights = PUPPIES.map(p => {
        const arr = timelines[p.id] || [];
        const found = arr.find(e => e.date === d);
        return found ? found.weight : null;
      }).filter(v => v !== null);
      return weights.length > 0 ? Math.round(weights.reduce((s, v) => s + v, 0) / weights.length) : null;
    });
    datasets.push({
      label: "Litter Average",
      data: avgData,
      borderColor: "#999",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [6, 3],
      tension: 0.3,
      spanGaps: true,
      pointRadius: 2,
      pointStyle: "circle",
    });
  }

  const ctx = document.getElementById("growth-chart").getContext("2d");

  if (growthChart) growthChart.destroy();

  growthChart = new Chart(ctx, {
    type: "line",
    data: { labels: dateLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { family: "'DM Sans', sans-serif", size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              return ctx.parsed.y !== null ? ` ${ctx.dataset.label}: ${ctx.parsed.y}g` : null;
            }
          },
          backgroundColor: "#fff",
          titleColor: "#4a5568",
          bodyColor: "#4a5568",
          borderColor: "#e8dfd0",
          borderWidth: 1,
          padding: 10,
        }
      },
      scales: {
        x: {
          grid: { color: "#f0ebe1" },
          ticks: { font: { family: "'DM Sans', sans-serif", size: 11 }, color: "#718096" }
        },
        y: {
          grid: { color: "#f0ebe1" },
          ticks: {
            font: { family: "'DM Sans', sans-serif", size: 11 },
            color: "#718096",
            callback: v => v + "g"
          },
          title: {
            display: true,
            text: "Weight (g)",
            color: "#8b6f47",
            font: { family: "'Lora', serif", size: 12 }
          }
        }
      }
    }
  });
}

toggleAverage.addEventListener("change", renderChart);

// ═══════════════════════════════════════════════
// 13. RENDER INSIGHTS
// ═══════════════════════════════════════════════
function renderInsights() {
  const timelines = buildTimelines(allEntries);

  // Latest weight per puppy
  const latest = {};
  for (const [pid, arr] of Object.entries(timelines)) {
    if (arr.length > 0) latest[pid] = arr[arr.length - 1].weight;
  }

  const latestEntries = Object.entries(latest).map(([pid, w]) => ({ puppyId: Number(pid), weight: w }));

  if (latestEntries.length === 0) {
    insHeaviest.textContent = "—";
    insLightest.textContent = "—";
    insAvg.textContent      = "—";
    insGainer.textContent   = "—";
    alertsCont.innerHTML    = `<p class="empty-state">No data yet.</p>`;
    milestonesCont.innerHTML= `<p class="empty-state">No milestones yet.</p>`;
    summaryBody.innerHTML   = "";
    return;
  }

  // Heaviest / lightest
  const sorted = [...latestEntries].sort((a, b) => b.weight - a.weight);
  const heaviest = sorted[0];
  const lightest = sorted[sorted.length - 1];

  insHeaviest.textContent = `${getPuppy(heaviest.puppyId)?.name} (${heaviest.weight}g)`;
  insLightest.textContent = `${getPuppy(lightest.puppyId)?.name} (${lightest.weight}g)`;

  const avg = Math.round(latestEntries.reduce((s, e) => s + e.weight, 0) / latestEntries.length);
  insAvg.textContent = `${avg}g`;

  // Biggest gainer (total gain from first to last)
  const gainers = Object.entries(timelines)
    .map(([pid, arr]) => {
      if (arr.length < 2) return null;
      return { puppyId: Number(pid), gain: arr[arr.length - 1].weight - arr[0].weight };
    })
    .filter(Boolean)
    .sort((a, b) => b.gain - a.gain);

  if (gainers.length > 0) {
    const top = gainers[0];
    insGainer.textContent = `${getPuppy(top.puppyId)?.name} (+${top.gain}g)`;
  } else {
    insGainer.textContent = "—";
  }

  // ── Alerts ──────────────────────────────────
  const alerts = [];
  for (const [pid, arr] of Object.entries(timelines)) {
    if (arr.length < 2) continue;
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    const change = last.weight - prev.weight;
    const puppy = getPuppy(Number(pid));
    if (change < 0) {
      alerts.push({ type: "loss", puppy, change, date: last.date });
    } else if (change < 10) {
      alerts.push({ type: "low", puppy, change, date: last.date });
    }
  }

  if (alerts.length === 0) {
    alertsCont.innerHTML = `<p class="empty-state">✅ No alerts — all puppies are doing well!</p>`;
  } else {
    alertsCont.innerHTML = alerts.map(a => {
      const icon  = a.type === "loss" ? "⬇" : "⚠";
      const cls   = a.type === "loss" ? "alert-loss" : "alert-low";
      const label = a.type === "loss"
        ? `Weight loss of ${Math.abs(a.change)}g on ${a.date}`
        : `Low gain of ${a.change}g on ${a.date}`;
      return `<div class="alert-item ${cls}">
        <span>${icon}</span>
        <div><strong>${a.puppy?.name}</strong> — ${label}</div>
      </div>`;
    }).join("");
  }

  // ── Milestones ───────────────────────────────
  const milestones = [];
  for (const [pid, arr] of Object.entries(timelines)) {
    if (arr.length < 2) continue;
    const birthWeight = arr[0].weight;
    const doubled = arr.find((e, i) => i > 0 && e.weight >= birthWeight * 2);
    if (doubled) {
      milestones.push({
        puppy: getPuppy(Number(pid)),
        date: doubled.date,
        weight: doubled.weight,
        birthWeight
      });
    }
  }

  if (milestones.length === 0) {
    milestonesCont.innerHTML = `<p class="empty-state">No puppies have doubled birth weight yet.</p>`;
  } else {
    milestonesCont.innerHTML = milestones.map(m => `
      <div class="milestone-item">
        🎉 <strong>${m.puppy?.name}</strong> doubled birth weight! (${m.birthWeight}g → ${m.weight}g on ${m.date})
      </div>
    `).join("");
  }

  // ── Per-puppy summary table ──────────────────
  const summaryRows = PUPPIES.map(puppy => {
    const arr = timelines[puppy.id] || [];
    if (arr.length === 0) return null;
    const first = arr[0];
    const last  = arr[arr.length - 1];
    const totalGain = last.weight - first.weight;
    const days  = arr.length;
    const avgDaily = days > 1 ? Math.round(totalGain / (days - 1)) : "—";
    return { puppy, first, last, totalGain, days, avgDaily };
  }).filter(Boolean);

  if (summaryRows.length === 0) {
    summaryBody.innerHTML = `<p class="empty-state">No data yet.</p>`;
    return;
  }

  summaryBody.innerHTML = `
    <div class="table-wrapper">
      <table class="summary-table">
        <thead>
          <tr>
            <th>Puppy</th>
            <th>Gender</th>
            <th>Birth Weight</th>
            <th>Current Weight</th>
            <th>Total Gain</th>
            <th>Avg Daily Gain</th>
            <th>Days Logged</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map(r => `
            <tr>
              <td>
                <div class="puppy-cell">
                  <span class="color-dot" style="background:${r.puppy.color}"></span>
                  ${r.puppy.name}
                </div>
              </td>
              <td>${r.puppy.gender}</td>
              <td>${r.first.weight}g</td>
              <td>${r.last.weight}g</td>
              <td>${r.totalGain > 0 ? "+" : ""}${r.totalGain}g</td>
              <td>${r.avgDaily !== "—" ? r.avgDaily + "g" : "—"}</td>
              <td>${r.days}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════════
// 14. TAB NAVIGATION
// ═══════════════════════════════════════════════
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    activeTab = tab;

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");

    // Re-render chart when switching to chart tab (canvas sizing)
    if (tab === "chart") renderChart();
    if (tab === "insights") renderInsights();
  });
});

// ═══════════════════════════════════════════════
// 15. INIT — POPULATE STATIC UI
// ═══════════════════════════════════════════════
function initUI() {
  // Puppy dropdown in form
  inputPuppy.innerHTML = `<option value="">— select puppy —</option>` +
    PUPPIES.map(p => `<option value="${p.id}">${p.name} (${p.gender})</option>`).join("");

  // Puppy filter dropdown
  filterPuppy.innerHTML = `<option value="all">All puppies</option>` +
    PUPPIES.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

  // Date default = today
  inputDate.value = todayStr();

  // Filter change
  filterPuppy.addEventListener("change", renderTable);
}

initUI();
