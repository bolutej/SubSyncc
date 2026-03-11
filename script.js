// ============================================================
// SUBTRACK — Full JavaScript
// ============================================================

// -----------------------------------------------------------
// 1. GLOBAL STATE
// -----------------------------------------------------------
let currentDate = new Date();
let viewYear = currentDate.getFullYear();
let viewMonth = currentDate.getMonth();

const knownServiceDomains = {
  "netflix": "netflix.com",
  "icloud": "icloud.com",
  "spotify": "spotify.com",
  "apple music": "music.apple.com",
  "youtube": "youtube.com",
  "youtube premium": "youtube.com",
  "prime video": "primevideo.com",
  "amazon prime": "primevideo.com",
  "chatgpt": "chatgpt.com",
  "openai": "openai.com"
};
let subscriptions = normalizeInitialData(JSON.parse(localStorage.getItem("subtrack") || "[]"));
const themeStorageKey = "subtrack-theme";
const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2
});


// -----------------------------------------------------------
// 2. SAVE TO LOCALSTORAGE
// -----------------------------------------------------------
function saveData() {
  localStorage.setItem("subtrack", JSON.stringify(subscriptions));
}

function setTheme(theme) {
  const supported = ["light", "dark"];
  const resolved = supported.includes(theme) ? theme : "light";

  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem(themeStorageKey, resolved);
  updateThemeToggle(resolved);
}

function updateThemeToggle(activeTheme) {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  const isDark = activeTheme === "dark";
  toggle.textContent = isDark ? "☾" : "☀";
  toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  setTheme(current === "dark" ? "light" : "dark");
}

function initTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = stored || (prefersDark ? "dark" : "light");
  setTheme(initial);
}


// -----------------------------------------------------------
// 3. MODAL OPEN / CLOSE
// -----------------------------------------------------------
function openModal() {
  document.getElementById("modal-overlay").classList.add("open");
  document.getElementById("f-name").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  document.getElementById("f-name").value = "";
  document.getElementById("f-price").value = "";
  document.getElementById("f-day").value = "";
  document.getElementById("f-alert").value = "3";
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
}


// -----------------------------------------------------------
// 4. ADD SUBSCRIPTION
// -----------------------------------------------------------
function addSubscription() {
  const name = document.getElementById("f-name").value.trim();
  const price = parseFloat(document.getElementById("f-price").value);
  const day = parseInt(document.getElementById("f-day").value);
  const alertDays = parseInt(document.getElementById("f-alert").value);

  // Validate all fields
  if (!name || isNaN(price) || isNaN(day) || day < 1 || day > 28) {
    alert("Please fill in all fields correctly (billing day must be 1–28)");
    return;
  }

  // Push new subscription object into array
  subscriptions.push({
    id: Date.now(),       // unique timestamp ID
    name,
    price,
    day,
    alertDays,
    iconUrl: resolveServiceIconUrl(name)
  });

  saveData();
  closeModal();
  renderAll();

  // Ask for browser notification permission on first add
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}


// -----------------------------------------------------------
// 5. DELETE SUBSCRIPTION
// -----------------------------------------------------------
function deleteSubscription(id) {
  subscriptions = subscriptions.filter(s => s.id !== id);
  saveData();
  renderAll();
}


// -----------------------------------------------------------
// 6. RENDER ALL (master update function)
// -----------------------------------------------------------
function renderAll() {
  renderCalendar();
  renderSubList();
  renderAlerts();
  renderStats();
}


// -----------------------------------------------------------
// 7. RENDER STATS BAR
// -----------------------------------------------------------
function renderStats() {
  // Add up all prices
  const total = subscriptions.reduce((acc, s) => acc + s.price, 0);
  document.getElementById("stat-cost").textContent = formatCurrency(total);

  // Count total subscriptions
  document.getElementById("stat-count").textContent = subscriptions.length;

  // Count how many are expiring within their alert window
  const today = new Date();
  const alerts = subscriptions.filter(s => {
    const next = getNextBillingDate(s);
    const diff = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
    return diff <= s.alertDays && diff >= 0;
  });
  document.getElementById("stat-alerts").textContent = alerts.length;
}


// -----------------------------------------------------------
// 8. GET NEXT BILLING DATE
// -----------------------------------------------------------
function getNextBillingDate(sub) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Try this month's billing date first
  let next = new Date(year, month, sub.day);

  // If it's already passed, move to next month
  if (next <= today) {
    next = new Date(year, month + 1, sub.day);
  }

  return next;
}


// -----------------------------------------------------------
// 9. RENDER SUBSCRIPTION LIST (sidebar)
// -----------------------------------------------------------
function renderSubList() {
  const list = document.getElementById("sub-list");

  if (subscriptions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big">📭</div>
        No subscriptions yet
      </div>`;
    return;
  }

  list.innerHTML = subscriptions.map(s => {
    const next = getNextBillingDate(s);
    const dateStr = next.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    const iconUrl = escapeHTML(s.iconUrl || resolveServiceIconUrl(s.name));

    return `
      <div class="sub-item">
        <div class="sub-icon-lg">
          <img class="service-icon-lg" src="${iconUrl}" alt="${escapeHTML(s.name)} icon">
        </div>
        <div class="sub-info">
          <div class="sub-name">${escapeHTML(s.name)}</div>
          <div class="sub-date">Renews ${dateStr}</div>
        </div>
        <div class="sub-price">${formatCurrency(s.price)}</div>
        <button class="delete-btn" onclick="deleteSubscription(${s.id})">✕</button>
      </div>`;
  }).join("");
}


// -----------------------------------------------------------
// 10. RENDER ALERTS PANEL
// -----------------------------------------------------------
function renderAlerts() {
  const list = document.getElementById("alert-list");
  const today = new Date();

  // Build enriched array with daysLeft calculated
  const upcoming = subscriptions
    .map(s => {
      const next = getNextBillingDate(s);
      const diff = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
      return { ...s, daysLeft: diff, next };
    })
    .filter(s => s.daysLeft <= s.alertDays && s.daysLeft >= 0)  // within alert window
    .sort((a, b) => a.daysLeft - b.daysLeft);                   // soonest first

  if (upcoming.length === 0) {
    list.innerHTML = `<div class="no-alerts">✅ No upcoming renewals</div>`;
    return;
  }

  // Render each alert item — label is correctly INSIDE the map
  list.innerHTML = upcoming.map(s => {
    const label =
      s.daysLeft === 0 ? "Renews TODAY!" :
        s.daysLeft === 1 ? "Renews tomorrow" :
          `Renews in ${s.daysLeft} days`;
    const iconUrl = escapeHTML(s.iconUrl || resolveServiceIconUrl(s.name));

    return `
      <div class="alert-item">
        <div class="a-name"><img class="alert-icon" src="${iconUrl}" alt="${escapeHTML(s.name)} icon"> ${escapeHTML(s.name)}</div>
        <div class="a-days">${label} — ${formatCurrency(s.price)}</div>
      </div>`;
  }).join("");

  // Fire browser notifications for same-day or next-day renewals
  if ("Notification" in window && Notification.permission === "granted") {
    upcoming.forEach(s => {
      // Only notify once per session using sessionStorage flag
      if (s.daysLeft <= 1 && !sessionStorage.getItem("notified_" + s.id)) {
        const noticeIcon = s.iconUrl || resolveServiceIconUrl(s.name);
        new Notification(`SubTrack: ${s.name} renews soon!`, {
          body: `${formatCurrency(s.price)} due ${s.daysLeft === 0 ? "today" : "tomorrow"}`,
          icon: noticeIcon
        });
        sessionStorage.setItem("notified_" + s.id, "1");
      }
    });
  }
}


// -----------------------------------------------------------
// 11. RENDER CALENDAR
// -----------------------------------------------------------
function renderCalendar() {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Update the month/year title
  document.getElementById("cal-title").textContent = `${months[viewMonth]} ${viewYear}`;

  const grid = document.getElementById("cal-grid");
  grid.innerHTML = ""; // clear previous cells

  const today = new Date(); // declared here so all loops below can use it

  // Calendar math
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();        // 0=Sun, 6=Sat
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate(); // last day of month
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();        // last day of prev month

  // Build a lookup map: { day: [sub, sub, ...] }
  const dayMap = {};
  subscriptions.forEach(s => {
    if (!dayMap[s.day]) dayMap[s.day] = [];
    dayMap[s.day].push(s);
  });

  // Build alert day map: days within each sub's alert window
  const alertDayMap = {};
  subscriptions.forEach(s => {
    const next = getNextBillingDate(s);
    if (next.getMonth() === viewMonth && next.getFullYear() === viewYear) {
      for (let i = 1; i <= s.alertDays; i++) {
        const alertDay = next.getDate() - i;
        if (alertDay > 0) {
          if (!alertDayMap[alertDay]) alertDayMap[alertDay] = [];
          alertDayMap[alertDay].push(s);
        }
      }
    }
  });

  // --- LOOP 1: Blank cells from end of previous month ---
  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    cell.innerHTML = `<div class="day-num">${prevDays - i}</div>`;
    grid.appendChild(cell);
  }

  // --- LOOP 2: Current month days ---
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    const subs = dayMap[d] || [];
    const hasAlert = alertDayMap[d] && alertDayMap[d].length > 0;
    const isToday = (
      d === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear()
    );

    cell.className = "cal-day" +
      (isToday ? " today" : "") +
      (subs.length > 0 ? " has-sub" : "");

    cell.innerHTML = `
      <div class="day-num">${d}</div>
      <div class="sub-icons">
        ${subs.map(s => `
          <div class="sub-icon">
            <img class="service-icon-sm" src="${escapeHTML(s.iconUrl || resolveServiceIconUrl(s.name))}" alt="${escapeHTML(s.name)} icon">
          </div>`).join("")}
      </div>
      ${hasAlert ? '<div class="alert-dot"></div>' : ""}`;

    grid.appendChild(cell);
  }

  // --- LOOP 3: Blank cells for start of next month ---
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const remaining = totalCells - firstDay - daysInMonth;

  for (let d = 1; d <= remaining; d++) {
    const cell = document.createElement("div");
    cell.className = "cal-day other-month";
    cell.innerHTML = `<div class="day-num">${d}</div>`;
    grid.appendChild(cell);
  }
}


// -----------------------------------------------------------
// 12. CHANGE MONTH (nav arrows)
// -----------------------------------------------------------
function changeMonth(dir) {
  viewMonth += dir; // +1 for next, -1 for previous

  // Handle year rollover
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }

  renderCalendar();
}


// -----------------------------------------------------------
// 13. HELPERS + INITIAL RENDER
// -----------------------------------------------------------
function normalizeServiceKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveServiceDomain(name) {
  const key = normalizeServiceKey(name);
  if (knownServiceDomains[key]) return knownServiceDomains[key];

  const firstWord = key.split(" ")[0];
  return firstWord ? `${firstWord}.com` : "example.com";
}

function resolveServiceIconUrl(name) {
  const domain = resolveServiceDomain(name);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function normalizeInitialData(items) {
  if (!Array.isArray(items)) return [];

  const demoNames = ["Netflix", "Spotify", "iCloud", "ChatGPT"];
  const hasOnlyLegacyDemoData =
    items.length === 4 &&
    items.every(item => demoNames.includes(item.name));

  if (hasOnlyLegacyDemoData) return [];

  return items.map(item => ({
    ...item,
    iconUrl: item.iconUrl || resolveServiceIconUrl(item.name || "")
  }));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(amount) {
  return currencyFormatter.format(Number(amount || 0));
}

// -----------------------------------------------------------
// 14. LOADER + INIT  (two-phase animation)
//   Phase 1: progress bar 0 -> 100%
//   Phase 2: icon zooms in, then show app
// -----------------------------------------------------------
(function startLoader() {
  const overlay = document.getElementById("loader-overlay");
  const fill = document.getElementById("loader-bar-fill");
  const percentEl = document.getElementById("loader-percent");
  const appEl = document.querySelector(".app");

  // Hide app until loader finishes
  if (appEl) {
    appEl.style.opacity = "0";
    appEl.style.display = "none";
  }

  // Init theme early so loader matches
  initTheme();

  const duration = 1200; // ms for progress bar
  let start = null;

  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function tick(timestamp) {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const raw = Math.min(elapsed / duration, 1);
    const progress = Math.round(ease(raw) * 100);

    fill.style.width = progress + "%";
    percentEl.textContent = progress + "%";

    if (raw < 1) {
      requestAnimationFrame(tick);
    } else {
      startZoomPhase();
    }
  }

  function startZoomPhase() {
    overlay.classList.add("zoom");

    setTimeout(function () {
      overlay.classList.add("hide");

      if (appEl) {
        appEl.style.display = "";
        appEl.style.transition = "opacity 0.5s ease";
        appEl.style.opacity = "1";
      }
      renderAll();
    }, 600);
  }

  requestAnimationFrame(tick);
})();

