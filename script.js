import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, push, remove, onValue }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDvL0emjzWd450LvuOCTNs-D3yUOlwy4UA",
  authDomain: "puppy-app-41bf0.firebaseapp.com",
  databaseURL: "https://puppy-app-41bf0-default-rtdb.firebaseio.com",
  projectId: "puppy-app-41bf0",
  appId: "1:958889040689:web:694feb88aca77cb2fbae10"
};

const ADMIN_EMAILS = [
  "bios80@gmail.com",
  "mouniaabdelkader@gmail.com"
];

const PUPPIES = [
  { id: 1, name: "Green",  gender: "Boy",   color: "#3a9e4a" },
  { id: 2, name: "Pink",   gender: "Girl", color: "#ed7db5" },
  { id: 3, name: "Blue",   gender: "Boy",   color: "#4c92f4" },
  { id: 4, name: "Red",    gender: "Girl",   color: "#b40000" },
  { id: 5, name: "Yellow", gender: "Girl", color: "#f8e90b" },
  { id: 7, name: "Orange", gender: "Boy",   color: "#ff741e" },
  { id: 8, name: "White",  gender: "Girl", color: "#ededed" },
];

const TROPHY_OPTIONS = [
  "Drama Queen",
  "The Contortionist",
  "Greatest Explorer",
  "Speedy Gonzales",
  "Milk Monster",
  "Snuggle Champion",
  "Wiggle Machine",
  "The Underpuppy",
  "Little Escape Artist",
  "Sleeping Cutie",
  "The Chupacabra"
];

const MILESTONE_OPTIONS = [
  "Lost Umbilical Cord",
  "Eyes Opened",
  "Started Hearing Sounds",
  "Started Walking",
  "First Bark",
  "First Tail Wag",
  "Started Peeing on Own",
  "Started Pooping on Own",
  "First Tooth",
  "Started Eating Puppy Mush",
  "Fully Weaned"
];

const PAWRENTS = [
  {
    id: "mom",
    role: "Mom",
    name: "Roma",
    dogImage: "images/roma.png",
    color: "#e8b7c8",
    breed: "Shih Tzu",
    age: "1 year",
    favoriteFood: "Anything",
    favoriteSong: "Eye of the Tiger",
    favoriteActivity: "Stealing socks",
    personality: "Sweet, protective, dramatic",
    nickname: "Bella, Romita, Good Girl",
    funFact: "Can demand snacks with one look",
quotes: [
  "I carried this whole family on my back.",
  "I'll keep an eye on your food. Don't worry.",
  "Give me that sock!"
]  },
  {
    id: "dad",
    role: "Dad",
    name: "Leone",
    dogImage: "images/leone.png",
    color: "#c8b089",
    breed: "Yorkshire Terrier",
    age: "almost 2 years",
    favoriteFood: "The one I stole",
    favoriteSong: "Single Ladies",
    favoriteActivity: "Eating toyes",
    personality: "Energetic, scared, sneaky",
    nickname: "Good Boy, Thief",
    funFact: "Acts like he owns the couch",
    quotes: [
  "That thing you are looking for? I haven't seen it.",
  "What was that noise?."
]  }
];

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let isAdmin = false;
let allEntries = [];
let allAwards = [];
let growthChart = null;
let activeTab = "log";

function getPuppy(id) {
  return PUPPIES.find(p => p.id === Number(id));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function genderIcon(gender) {
  if (gender === "Boy") return '<span class="gender male">♂</span>';
  if (gender === "Girl") return '<span class="gender female">♀</span>';
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function computeChange(arr, index) {
  if (index === 0) return null;
  return arr[index].weight - arr[index - 1].weight;
}

function statusBadge(change, isFirst) {
  if (isFirst) return '<span class="badge badge-first">First</span>';
  if (change === null) return '<span class="badge badge-neutral">—</span>';
  if (change < 0) return '<span class="badge badge-loss">⬇ Weight Loss</span>';
  if (change < 10) return '<span class="badge badge-low">⚠ Low Gain</span>';
  return '<span class="badge badge-good">✓ Good Gain</span>';
}

function changeCell(change, isFirst) {
  if (isFirst || change === null) return '<span class="change-neu">—</span>';

  const formatted = Number(change).toFixed(1);

  if (change > 0) return `<span class="change-pos">+${formatted}g</span>`;
  if (change < 0) return `<span class="change-neg">${formatted}g</span>`;
  return '<span class="change-neu">±0g</span>';
}

function allDates(timelines) {
  const set = new Set();
  for (const arr of Object.values(timelines)) {
    arr.forEach(e => set.add(e.date));
  }
  return [...set].sort();
}

function getAutomaticAwards() {
  const timelines = buildTimelines(allEntries);
  const autoAwards = [];

  for (const [pid, arr] of Object.entries(timelines)) {
    if (arr.length < 2) continue;

    const birthWeight = arr[0].weight;
    const doubled = arr.find((e, i) => i > 0 && e.weight >= birthWeight * 2);

    if (doubled) {
      autoAwards.push({
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

  return autoAwards.sort((a, b) => b.date.localeCompare(a.date));
}

function getCombinedAwards() {
  const manualAwards = allAwards.map(item => ({
    ...item,
    isAuto: false
  }));

  return [...manualAwards, ...getAutomaticAwards()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

function renderPuppies() {
  if (!puppiesContainer) return;

  const timelines = buildTimelines(allEntries);
  const combinedAwards = getCombinedAwards();
  const allDatesList = allDates(timelines);
const puppyAge = allDatesList.length;

  function isLightColor(hex) {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 180;
  }

  const cards = PUPPIES.map(puppy => {
    const arr = timelines[puppy.id] || [];
    const puppyAwards = combinedAwards.filter(item => item.puppyId === puppy.id);
    const milestones = puppyAwards.filter(item => item.type === "milestone");
    const trophies = puppyAwards.filter(item => item.type === "trophy");

    const completedMilestones = new Map(
      milestones.map(item => [item.title, item])
    );

    const bannerTextColor = isLightColor(puppy.color) ? "#333" : "#fff";

    // 🟡 NO DATA CASE
    if (arr.length === 0) {
      return `
        <div class="puppy-profile-card">
          <div class="puppy-banner" style="background:${puppy.color}; color:${bannerTextColor}">
            <div class="puppy-banner-content">
              <strong>${puppy.name}</strong>
            </div>
          </div>

          <div class="puppy-profile-body">
            <div class="puppy-gender-line">
              ${genderIcon(puppy.gender)} ${puppy.gender}
            </div>

            <div class="empty-state">No weight data yet.</div>
          </div>
        </div>
      `;
    }

    // 🟢 DATA CASE
    const first = arr[0];
    const last = arr[arr.length - 1];
    const totalGain = last.weight - first.weight;
    const latestChange = arr.length > 1
      ? last.weight - arr[arr.length - 2].weight
      : null;

      const avgDaily = arr.length > 1
  ? (totalGain / (arr.length - 1))
  : null;

    let latestStatus = "First Entry";
    if (latestChange !== null) {
      if (latestChange < 0) latestStatus = "Weight Loss";
      else if (latestChange < 10) latestStatus = "Low Gain";
      else latestStatus = "Good Gain";
    }

    return `
      <div class="puppy-profile-card">
        <div class="puppy-banner" style="background:${puppy.color}; color:${bannerTextColor}">
          <div class="puppy-banner-content">
            <strong>${puppy.name}</strong>
          </div>
        </div>

        <div class="puppy-profile-body">
          <div class="puppy-gender-line">
            ${genderIcon(puppy.gender)} ${puppy.gender}
          </div>

          <div class="puppy-profile-stats">
  <div><strong>🐣 Birth:</strong> ${first.weight}g</div>
  <div><strong>⚖️ Current:</strong> ${last.weight}g</div>
  <div><strong>📈 Total Gain:</strong> ${totalGain > 0 ? "+" : ""}${Number(totalGain).toFixed(1)}g</div>
  <div><strong>🚀 Latest Gain:</strong> ${
    latestChange === null
      ? "—"
      : `${latestChange > 0 ? "+" : ""}${Number(latestChange).toFixed(1)}g`
  }</div>
  <div><strong>📊 Avg / Day:</strong> ${
    avgDaily === null
      ? "—"
      : `${avgDaily > 0 ? "+" : ""}${Number(avgDaily).toFixed(1)}g`
  }</div>
  <div><strong>Status:</strong> ${latestStatus}</div>
</div>

          <div class="puppy-profile-section">
            <h4>Milestones</h4>
            <div class="puppy-milestones-table">
              ${MILESTONE_OPTIONS.map(title => {
                const completed = completedMilestones.get(title);

                return `
                  <div class="puppy-milestone-row">
                    <div class="puppy-milestone-status">
                      ${completed ? "✅" : "—"}
                    </div>
                    <div class="puppy-milestone-title">
                      ${title}
                    </div>
                    <div class="puppy-milestone-date">
                      ${completed ? formatDate(completed.date) : ""}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div class="puppy-profile-section">
            <h4>Trophies</h4>
            ${
              trophies.length
                ? `<ul>${trophies.map(item => `<li>${item.title} (${formatDate(item.date)})</li>`).join("")}</ul>`
                : `<p class="empty-state">No trophies yet.</p>`
            }
          </div>
        </div>
      </div>
    `;
  }).join("");

puppiesContainer.innerHTML = `
  <div class="puppies-age-banner">
    Puppies are <strong>${puppyAge} day${puppyAge === 1 ? "" : "s"} old</strong>
  </div>
  <div class="puppies-grid">${cards}</div>
`;
}

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

const insHeaviest = document.getElementById("ins-heaviest-val");
const insLightest = document.getElementById("ins-lightest-val");
const insAvg = document.getElementById("ins-avg-val");
const insGainer = document.getElementById("ins-gainer-val");
const alertsCont = document.getElementById("alerts-container");
const milestonesCont = document.getElementById("milestones-container");
const summaryBody = document.getElementById("puppy-summary-container");
const puppiesContainer = document.getElementById("puppies-container");

const awardPuppy = document.getElementById("award-puppy");
const awardType = document.getElementById("award-type");
const awardTitle = document.getElementById("award-title");
const awardDate = document.getElementById("award-date");
const awardNotes = document.getElementById("award-notes");
const btnAwardAdd = document.getElementById("btn-award-add");
const awardMessage = document.getElementById("award-message");
const awardFilterPuppy = document.getElementById("award-filter-puppy");
const awardsContainer = document.getElementById("awards-container");
const pawrentsContainer = document.getElementById("pawrents-container");

function updateAuthUI(user) {
  currentUser = user;
  isAdmin = ADMIN_EMAILS.includes(user?.email);

  if (user) {
    authStatus.textContent = isAdmin ? `Editor: ${user.email}` : `Viewer: ${user.email}`;
    btnLogin.style.display = "none";
    btnLogout.style.display = "inline-block";
  } else {
    authStatus.textContent = "";
    btnLogin.style.display = "inline-block";
    btnLogout.style.display = "none";
  }

  readonlyBanner.style.display = isAdmin ? "none" : "block";
  btnAdd.disabled = !isAdmin;
  btnAwardAdd.disabled = !isAdmin;
  colDelete.style.display = isAdmin ? "" : "none";

  renderTable();
  renderAwards();
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

const entriesRef = ref(db, "entries");
const awardsRef = ref(db, "awards");

onValue(entriesRef, (snapshot) => {
  allEntries = parseEntriesSnapshot(snapshot);
  renderAll();
}, (err) => {
  console.error("Firebase read error:", err);
  entriesTbody.innerHTML = `<tr><td colspan="8" class="empty-state">⚠ Error loading data: ${err.message}</td></tr>`;
});

onValue(awardsRef, (snapshot) => {
  allAwards = parseAwardsSnapshot(snapshot);
  renderAwards();
}, (err) => {
  console.error("Firebase awards read error:", err);
  awardsContainer.innerHTML = `<p class="empty-state">⚠ Error loading trophies and milestones: ${err.message}</p>`;
});

btnAdd.addEventListener("click", async () => {
  if (!isAdmin) return;

  const puppyId = Number(inputPuppy.value);
  const date = inputDate.value;
  const weight = Number(inputWeight.value);

  if (!puppyId || !date || !weight || weight <= 0) {
    showMessage("Please fill in all fields with valid values.", "error");
    return;
  }

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

btnAwardAdd.addEventListener("click", async () => {
  if (!isAdmin) return;

  const puppyId = Number(awardPuppy.value);
  const type = awardType.value;
  const title = awardTitle.value.trim();
  const date = awardDate.value;
  const notes = awardNotes.value.trim();

// 🚫 Prevent duplicate milestones
if (type === "milestone") {
  const alreadyExists = allAwards.some(a =>
    a.puppyId === puppyId &&
    a.type === "milestone" &&
    a.title === title
  );

  if (alreadyExists) {
    showAwardMessage("This milestone has already been added for this puppy.", "error");
    return;
  }
}

  if (!puppyId || !type || !title || !date) {
    showAwardMessage("Please complete puppy, type, title, and date.", "error");
    return;
  }

  btnAwardAdd.disabled = true;
  try {
    await push(awardsRef, {
      puppyId,
      type,
      title,
      date,
      notes
    });

    awardNotes.value = "";
    showAwardMessage("Trophy or milestone added successfully!", "success");
  } catch (err) {
    console.error("Add award error:", err);
    showAwardMessage("Failed to save: " + err.message, "error");
  } finally {
    btnAwardAdd.disabled = false;
  }
});

function showMessage(msg, type = "info") {
  formMessage.textContent = msg;
  formMessage.className = "form-message" + (type === "success" ? " success" : "");
  setTimeout(() => {
    formMessage.textContent = "";
    formMessage.className = "form-message";
  }, 4000);
}

function showAwardMessage(msg, type = "info") {
  awardMessage.textContent = msg;
  awardMessage.className = "form-message" + (type === "success" ? " success" : "");
  setTimeout(() => {
    awardMessage.textContent = "";
    awardMessage.className = "form-message";
  }, 4000);
}

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

async function deleteAward(awardId) {
  if (!isAdmin) return;
  if (!confirm("Delete this trophy or milestone?")) return;

  try {
    await remove(ref(db, `awards/${awardId}`));
  } catch (err) {
    console.error("Delete award error:", err);
    alert("Failed to delete: " + err.message);
  }
}

function renderAll() {
  renderTable();
  renderChart();
  renderInsights();
  renderPuppies();
  renderAwards();
}

function renderTable() {
  const timelines = buildTimelines(allEntries);
  const filterVal = Number(filterPuppy.value) || "all";

  const rows = [];
  for (const [pidStr, arr] of Object.entries(timelines)) {
    const pid = Number(pidStr);
    arr.forEach((item, i) => {
      const change = computeChange(arr, i);
      rows.push({ ...item, puppyId: pid, change, isFirst: i === 0 });
    });
  }

  const filtered = filterVal === "all" ? rows : rows.filter(r => r.puppyId === filterVal);
  filtered.sort((a, b) => b.date.localeCompare(a.date) || a.puppyId - b.puppyId);

  if (filtered.length === 0) {
    entriesTbody.innerHTML = `<tr><td colspan="8" class="empty-state">No entries yet. Add the first weight above!</td></tr>`;
    return;
  }

  const isAdminNow = isAdmin;
  entriesTbody.innerHTML = filtered.map(row => {
    const puppy = getPuppy(row.puppyId);
    if (!puppy) return "";

    const deleteBtn = isAdminNow
      ? `<button class="btn btn-danger" data-id="${row.entryId}" title="Delete entry">✕</button>`
      : "";

    return `
      <tr>
        <td>${formatDate(row.date)}</td>
        <td><strong>Day ${row.dayNumber}</strong></td>
        <td>
          <div class="puppy-cell">
            <span class="color-dot" style="background:${puppy.color}"></span>
            ${puppy.name}
          </div>
        </td>
        <td>${genderIcon(puppy.gender)} ${puppy.gender}</td>
        <td><strong>${row.weight}g</strong></td>
        <td>${changeCell(row.change, row.isFirst)}</td>
        <td>${statusBadge(row.change, row.isFirst)}</td>
        <td>${deleteBtn}</td>
      </tr>`;
  }).join("");

  entriesTbody.querySelectorAll(".btn-danger[data-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });
}

const cards = PAWRENTS.map(parent => {
  const initials = parent.name
    .split(/[\s&]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("");

  return `
    <div class="pawrents-card">
      <div class="pawrents-banner" style="background:${parent.color};">

        <div class="pawrents-banner-left">
          <div class="pawrents-avatar" style="background:${parent.avatarColor ?? 'rgba(255,255,255,0.18)'}; color:${parent.avatarTextColor ?? '#fff'};">
            ${initials}
          </div>
          <div>
            <div class="pawrents-banner-name" style="color:${parent.nameColor ?? '#fff'};">${parent.name}</div>
            <div class="pawrents-banner-sub" style="color:${parent.nameColor ?? '#fff'};">${parent.location ?? ''}</div>
          </div>
        </div>

        ${parent.dogImage
          ? `<img class="pawrents-dog-img" src="${parent.dogImage}" alt="Photo of ${parent.name}'s dog" />`
          : `<div class="pawrents-dog-img" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🐾</div>`
        }

      </div>

      <div class="pawrents-body">
        <div class="pawrents-role">
          <span class="pawrents-role-dot"></span>
          ${parent.role}
        </div>

        <div class="pawrents-stats">
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Breed</span>
            <span class="pawrents-stat-value">${parent.breed}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Age</span>
            <span class="pawrents-stat-value">${parent.age}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Favorite food</span>
            <span class="pawrents-stat-value">${parent.favoriteFood}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Favorite song</span>
            <span class="pawrents-stat-value">${parent.favoriteSong}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Favorite activity</span>
            <span class="pawrents-stat-value">${parent.favoriteActivity}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Personality</span>
            <span class="pawrents-stat-value">${parent.personality}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Nickname</span>
            <span class="pawrents-stat-value">${parent.nickname}</span>
          </div>
          <div class="pawrents-stat">
            <span class="pawrents-stat-label">Fun fact</span>
            <span class="pawrents-stat-value">${parent.funFact}</span>
          </div>
        </div>

        <div class="pawrents-quote-box">
          <div class="pawrents-quote-label">Signature quote</div>
          ${parent.quotes.map(q => `<div class="pawrents-quote">"${q}"</div>`).join("")}
        </div>
      </div>
    </div>
  `;
}).join("");

pawrentsContainer.innerHTML = `<div class="pawrents-grid">${cards}</div>`;

function renderChart() {
  const timelines = buildTimelines(allEntries);
  const dates = allDates(timelines);

  if (dates.length === 0) {
    if (growthChart) {
      growthChart.destroy();
      growthChart = null;
    }
    return;
  }

  const showAverage = toggleAverage.checked;
  const dateLabels = dates.map(d => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const datasets = PUPPIES.map(puppy => {
    const arr = timelines[puppy.id] || [];
    const dateMap = {};
    arr.forEach(item => {
      dateMap[item.date] = item.weight;
    });

    const birthWeight = arr.length > 0 ? arr[0].weight : null;
    const dataPoints = dates.map(d => dateMap[d] ?? null);

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

  if (showAverage && dates.length > 0) {
    const avgData = dates.map(d => {
      const weights = PUPPIES.map(p => {
        const arr = timelines[p.id] || [];
        const found = arr.find(e => e.date === d);
        return found ? found.weight : null;
      }).filter(v => v !== null);

      return weights.length > 0
        ? Math.round(weights.reduce((s, v) => s + v, 0) / weights.length)
        : null;
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
          ticks: {
            font: { family: "'DM Sans', sans-serif", size: 11 },
            color: "#718096"
          }
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

function renderInsights() {
  const timelines = buildTimelines(allEntries);

  const latest = {};
  for (const [pid, arr] of Object.entries(timelines)) {
    if (arr.length > 0) latest[pid] = arr[arr.length - 1].weight;
  }

  const latestEntries = Object.entries(latest).map(([pid, w]) => ({
    puppyId: Number(pid),
    weight: w
  }));

  if (latestEntries.length === 0) {
    insHeaviest.textContent = "—";
    insLightest.textContent = "—";
    insAvg.textContent = "—";
    insGainer.textContent = "—";
    alertsCont.innerHTML = `<p class="empty-state">No data yet.</p>`;
    milestonesCont.innerHTML = `<p class="empty-state">No milestones yet.</p>`;
    summaryBody.innerHTML = "";
    return;
  }

  const sorted = [...latestEntries].sort((a, b) => b.weight - a.weight);
  const heaviest = sorted[0];
  const lightest = sorted[sorted.length - 1];

  insHeaviest.textContent = `${getPuppy(heaviest.puppyId)?.name} (${heaviest.weight}g)`;
  insLightest.textContent = `${getPuppy(lightest.puppyId)?.name} (${lightest.weight}g)`;

  const avg = Math.round(latestEntries.reduce((s, e) => s + e.weight, 0) / latestEntries.length);
  insAvg.textContent = `${avg}g`;

  const gainers = Object.entries(timelines)
    .map(([pid, arr]) => {
      if (arr.length < 2) return null;
      return {
        puppyId: Number(pid),
        gain: arr[arr.length - 1].weight - arr[0].weight
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.gain - a.gain);

  if (gainers.length > 0) {
  const top = gainers[0];
  insGainer.textContent = `${getPuppy(top.puppyId)?.name} (+${Number(top.gain).toFixed(1)}g)`;
} else {
  insGainer.textContent = "—";
}

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
      const icon = a.type === "loss" ? "⬇" : "⚠";
      const cls = a.type === "loss" ? "alert-loss" : "alert-low";
const label = a.type === "loss"
  ? `Weight loss of ${Number(Math.abs(a.change)).toFixed(1)}g on ${a.date}`
  : `Low gain of ${Number(a.change).toFixed(1)}g on ${a.date}`;

      return `<div class="alert-item ${cls}">
        <span>${icon}</span>
        <div><strong>${a.puppy?.name}</strong> — ${label}</div>
      </div>`;
    }).join("");
  }

  const milestones = getAutomaticAwards();

  if (milestones.length === 0) {
    milestonesCont.innerHTML = `<p class="empty-state">No puppies have doubled birth weight yet.</p>`;
  } else {
    milestonesCont.innerHTML = milestones.map(m => `
      <div class="milestone-item">
        🎉 <strong>${m.puppyId ? getPuppy(m.puppyId)?.name : ""}</strong> doubled birth weight! (${m.notes} on ${m.date})
      </div>
    `).join("");
  }

  const summaryRows = PUPPIES.map(puppy => {
    const arr = timelines[puppy.id] || [];
    if (arr.length === 0) return null;

    const first = arr[0];
    const last = arr[arr.length - 1];
    const totalGain = last.weight - first.weight;
    const days = arr.length;
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
              <td>${r.totalGain > 0 ? "+" : ""}${Number(r.totalGain).toFixed(1)}g</td>
              <td>${r.avgDaily !== "—" ? r.avgDaily + "g" : "—"}</td>
              <td>${r.days}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

function getAwardOptionsByType(type) {
  return type === "milestone" ? MILESTONE_OPTIONS : TROPHY_OPTIONS;
}

function populateAwardTitleOptions() {
  const options = getAwardOptionsByType(awardType.value);
  awardTitle.innerHTML = options.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
}

function renderAwards() {
  if (!awardsContainer) return;

  const combined = getCombinedAwards();
  const filterVal = Number(awardFilterPuppy.value) || "all";

  const filtered = filterVal === "all"
    ? combined
    : combined.filter(item => item.puppyId === filterVal);

  if (filtered.length === 0) {
    awardsContainer.innerHTML = `<p class="empty-state">No trophies or milestones yet.</p>`;
    return;
  }

  const grouped = PUPPIES.map(puppy => {
    const items = filtered.filter(item => item.puppyId === puppy.id);
    return { puppy, items };
  }).filter(group => group.items.length > 0);

  awardsContainer.innerHTML = `
    <div class="awards-list">
      ${grouped.map(group => `
        <div class="award-puppy-card">
          <div class="award-puppy-header">
            <span class="color-dot" style="background:${group.puppy.color}"></span>
            <div>
              <h3>${group.puppy.name}</h3>
<div class="award-puppy-sub">
  ${genderIcon(group.puppy.gender)} ${group.puppy.gender}
</div>
            </div>
          </div>

          <div class="award-items">
            ${group.items.map(item => {
              const badgeClass = item.type === "trophy" ? "award-badge-trophy" : "award-badge-milestone";
              const badgeLabel = item.type === "trophy" ? "Trophy" : "Milestone";
              const icon = item.type === "trophy" ? "🏆" : "🎉";
              const notesHtml = item.notes
                ? `<div class="award-notes">${escapeHtml(item.notes)}</div>`
                : "";

              const autoBadge = item.isAuto
                ? `<span class="award-badge award-badge-auto">Auto</span>`
                : "";

              const deleteButton = (!item.isAuto && isAdmin)
                ? `<button class="btn-mini-danger" data-award-id="${item.id}" title="Delete">✕</button>`
                : "";

              return `
                <div class="award-item">
                  <div class="award-main">
                    <div class="award-icon">${icon}</div>
                    <div>
                      <div class="award-title-line">
                        <span class="award-title">${escapeHtml(item.title)}</span>
                        <span class="award-date">${formatDate(item.date)}</span>
                      </div>
                      ${notesHtml}
                    </div>
                  </div>

                  <div class="award-meta">
                    <span class="award-badge ${badgeClass}">${badgeLabel}</span>
                    ${autoBadge}
                    ${deleteButton}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;

  awardsContainer.querySelectorAll("[data-award-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteAward(btn.dataset.awardId));
  });
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    activeTab = tab;

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`tab-${tab}`).classList.add("active");

    if (tab === "chart") renderChart();
    if (tab === "insights") renderInsights();
    if (tab === "puppies") renderPuppies();
    if (tab === "trophies") renderAwards();
    if (tab === "pawrents") renderPawrents();
  });
});

function initUI() {
  inputPuppy.innerHTML = `<option value="">— select puppy —</option>` +
    PUPPIES.map(p => `<option value="${p.id}">${p.name} (${p.gender})</option>`).join("");

  filterPuppy.innerHTML = `<option value="all">All puppies</option>` +
    PUPPIES.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

  awardPuppy.innerHTML = `<option value="">— select puppy —</option>` +
    PUPPIES.map(p => `<option value="${p.id}">${p.name} (${p.gender})</option>`).join("");

  awardFilterPuppy.innerHTML = `<option value="all">All puppies</option>` +
    PUPPIES.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

  inputDate.value = todayStr();
  awardDate.value = todayStr();

  populateAwardTitleOptions();

  filterPuppy.addEventListener("change", renderTable);
  awardFilterPuppy.addEventListener("change", renderAwards);
  awardType.addEventListener("change", populateAwardTitleOptions);
}

initUI();