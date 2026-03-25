const knownServiceDomains = {
  netflix: "netflix.com",
  icloud: "icloud.com",
  spotify: "spotify.com",
  "apple music": "music.apple.com",
  youtube: "youtube.com",
  "youtube premium": "youtube.com",
  "prime video": "primevideo.com",
  "amazon prime": "primevideo.com",
  chatgpt: "chatgpt.com",
  openai: "openai.com",
};
let subscriptions = [];
let spendingChartInstance = null;
let pendingDeleteSubscription = null;
const themeStorageKey = "subtrack-theme";
const seenNotificationsStorageKey = "subtrack-seen-notifications";
const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});
const categoryDisplayNames = {
  streaming: "Streaming",
  music: "Music",
  software: "Software",
  gaming: "Gaming",
  fitness: "Fitness",
  news: "News",
  cloud: "Cloud Storage",
  other: "Other",
};

// -----------------------------------------------------------
// 2. SAVE TO LOCALSTORAGE
// -----------------------------------------------------------

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
  toggle.textContent = isDark ? "\u263E" : "\u2600";
  toggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode",
  );
}

function initTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
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
async function addSubscription() {
  const name = document.getElementById("f-name").value.trim();
  const price = parseFloat(document.getElementById("f-price").value);
  const day = getSelectedBillingDay();
  const alertDays = parseInt(document.getElementById("f-alert").value, 10);
  const cycle = String(document.getElementById("f-cycle")?.value || "monthly");
  const category = String(document.getElementById("f-category")?.value || "");

  if (!name || isNaN(price) || price <= 0 || isNaN(day) || day < 1 || day > 31) {
    alert("Please fill in all fields correctly (billing day must be 1-31)");
    return;
  }

  let newSub = null;
  try {
    newSub = await window.dbFunctions.addSubscriptionDB({
      name,
      price,
      day,
      alertDays,
      cycle,
      category,
      iconUrl: resolveServiceIconUrl(name),
    });
  } catch (error) {
    console.error("Add subscription failed:", error);
  }

  if (!newSub) {
    alert("Could not add subscription. Please try again.");
    return;
  }

  subscriptions.push({
    id: newSub.id,
    name: newSub.name,
    price: newSub.price,
    day: newSub.day,
    alertDays: newSub.alert_days,
    cycle: newSub.cycle || cycle,
    category: newSub.category || category,
    iconUrl: newSub.icon_url,
  });
  closeModal();
  renderAll();
}

// -----------------------------------------------------------
// 5. DELETE SUBSCRIPTION
// -----------------------------------------------------------
function openDeleteModal(id, name) {
  const overlay = document.getElementById("delete-modal-overlay");
  const serviceNameEl = document.getElementById("delete-modal-service");
  if (!overlay || !id) return;

  pendingDeleteSubscription = {
    id,
    name: String(name || "this subscription"),
  };

  if (serviceNameEl) {
    serviceNameEl.textContent = pendingDeleteSubscription.name;
  }

  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
  const overlay = document.getElementById("delete-modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  pendingDeleteSubscription = null;
}

async function confirmDeleteSubscription() {
  const confirmBtn = document.getElementById("delete-modal-confirm");
  const pendingId = pendingDeleteSubscription?.id;
  if (!pendingId) {
    closeDeleteModal();
    return;
  }

  const originalConfirmLabel = confirmBtn?.textContent || "Delete";
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting...";
  }

  try {
    await window.dbFunctions.deleteSubscriptionDB(pendingId);
    subscriptions = subscriptions.filter((s) => s.id !== pendingId);
    closeDeleteModal();
    renderAll();
  } catch (error) {
    console.error("Delete subscription failed:", error);
    alert("Could not delete subscription. Please try again.");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalConfirmLabel;
    }
  }
}

// -----------------------------------------------------------
// 6. RENDER ALL (master update function)
// -----------------------------------------------------------
function renderAll() {
  renderSubList();
  renderNotificationBell();
  renderStats();
  renderSpendingChart();
  renderCategoryBreakdown();
}

function getUpcomingRenewals() {
  const today = new Date();

  return subscriptions
    .map((s) => {
      const next = getNextBillingDate(s);
      const diff = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
      return {
        ...s,
        daysLeft: diff,
        next,
        notificationKey: buildNotificationKey(s, next),
      };
    })
    .filter((s) => s.daysLeft <= s.alertDays && s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

function buildNotificationKey(subscription, nextDate) {
  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, "0");
  const day = String(nextDate.getDate()).padStart(2, "0");
  return `${subscription.id}|${year}-${month}-${day}`;
}

function readSeenNotifications() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(seenNotificationsStorageKey) || "{}",
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSeenNotifications(map) {
  localStorage.setItem(seenNotificationsStorageKey, JSON.stringify(map));
}

function markNotificationSeenByKey(notificationKey) {
  if (!notificationKey) return;
  const seen = readSeenNotifications();
  seen[notificationKey] = Date.now();
  writeSeenNotifications(seen);
}

function markAllUpcomingNotificationsSeen() {
  const seen = readSeenNotifications();
  getUpcomingRenewals().forEach((item) => {
    seen[item.notificationKey] = Date.now();
  });
  writeSeenNotifications(seen);
}
// -----------------------------------------------------------
// 7. RENDER STATS BAR
// -----------------------------------------------------------
function renderStats() {
  // Monthly total normalized across billing cycles.
  const total = subscriptions.reduce(
    (acc, s) => acc + getMonthlyEquivalentPrice(s),
    0,
  );
  const statCost = document.getElementById("stat-cost");
  if (statCost) statCost.textContent = formatCurrency(total);

  const statYearly = document.getElementById("stat-yearly");
  if (statYearly) statYearly.textContent = formatCurrency(total * 12);

  // Count total subscriptions
  const statCount = document.getElementById("stat-count");
  if (statCount) statCount.textContent = subscriptions.length;

  // Count how many are expiring within their alert window
  const alerts = getUpcomingRenewals();
  const statAlerts = document.getElementById("stat-alerts");
  if (statAlerts) statAlerts.textContent = alerts.length;
}

function getMonthlyEquivalentPrice(subscription) {
  const amount = Number(subscription.price || 0);
  const cycle = String(subscription.cycle || "monthly").toLowerCase();

  if (cycle === "yearly" || cycle === "annual") return amount / 12;
  if (cycle === "weekly") return (amount * 52) / 12;
  return amount;
}

function inferCategoryKey(subscription) {
  const explicit = normalizeServiceKey(subscription.category || "").replaceAll(
    " ",
    "",
  );

  if (explicit === "cloudstorage") return "cloud";
  if (categoryDisplayNames[explicit]) return explicit;

  const nameKey = normalizeServiceKey(subscription.name);
  if (
    /netflix|prime video|primevideo|disney|hulu|showmax|max|stream|youtube/.test(
      nameKey,
    )
  ) {
    return "streaming";
  }
  if (/spotify|apple music|music|deezer|audiomack/.test(nameKey)) return "music";
  if (/chatgpt|adobe|figma|notion|github|canva|office|software|saas/.test(nameKey)) {
    return "software";
  }
  if (/xbox|playstation|steam|gaming|game pass/.test(nameKey)) return "gaming";
  if (/gym|fitness|health/.test(nameKey)) return "fitness";
  if (/news|times|post|magazine|journal/.test(nameKey)) return "news";
  if (/icloud|drive|dropbox|onedrive|cloud/.test(nameKey)) return "cloud";

  return "other";
}

function renderSpendingChart() {
  const canvas = document.getElementById("spending-chart");
  if (!canvas || typeof window.Chart === "undefined") return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const today = new Date();
  const monthLabels = [];
  const monthlyValues = [];

  const recurringTotal = subscriptions.reduce(
    (acc, subscription) => acc + getMonthlyEquivalentPrice(subscription),
    0,
  );
  const currentMonthTotal = subscriptions.reduce((acc, subscription) => {
    const dueDay = Number(subscription.day || 1);
    return acc + (dueDay >= today.getDate() ? getMonthlyEquivalentPrice(subscription) : 0);
  }, 0);

  for (let i = 0; i < 6; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    monthLabels.push(
      monthDate.toLocaleDateString("en-NG", { month: "short" }),
    );
    monthlyValues.push(i === 0 ? currentMonthTotal : recurringTotal);
  }

  if (spendingChartInstance) {
    spendingChartInstance.destroy();
  }

  spendingChartInstance = new window.Chart(context, {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [
        {
          data: monthlyValues,
          borderColor: "#f4f4f5",
          backgroundColor: "rgba(244,244,245,0.16)",
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          pointBackgroundColor: "#f4f4f5",
          pointBorderColor: "#0a0a0f",
          pointBorderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (contextItem) => formatCurrency(contextItem.parsed.y),
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: { color: "rgba(244,244,245,0.58)" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.08)" },
          ticks: {
            color: "rgba(244,244,245,0.58)",
            callback: (value) => formatCurrency(value),
          },
        },
      },
    },
  });
}

function renderCategoryBreakdown() {
  const container = document.getElementById("cat-breakdown");
  if (!container) return;

  const totalsByCategory = subscriptions.reduce((acc, subscription) => {
    const categoryKey = inferCategoryKey(subscription);
    const current = Number(acc[categoryKey] || 0);
    acc[categoryKey] = current + getMonthlyEquivalentPrice(subscription);
    return acc;
  }, {});

  const sorted = Object.entries(totalsByCategory)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    container.innerHTML = `<div class="no-alerts">No category data yet</div>`;
    return;
  }

  const grandTotal = sorted.reduce((sum, [, amount]) => sum + amount, 0);

  container.innerHTML = sorted
    .map(([categoryKey, amount]) => {
      const percentage = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
      const categoryName =
        categoryDisplayNames[categoryKey] || categoryDisplayNames.other;

      return `
        <div class="cat-item">
          <div class="cat-row">
            <span class="cat-name">${escapeHTML(categoryName)}</span>
            <span class="cat-amount">${formatCurrency(amount)}</span>
          </div>
          <div class="cat-bar-bg">
            <div class="cat-bar-fill" style="width:${percentage.toFixed(1)}%"></div>
          </div>
        </div>`;
    })
    .join("");
}

// -----------------------------------------------------------
// 8. GET NEXT BILLING DATE
// -----------------------------------------------------------
function getNextBillingDate(sub) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Try this month's billing date first, clamped to the last valid day.
  let next = getBillingDateForMonth(year, month, sub.day);

  // If it's already passed, move to next month.
  if (next <= today) {
    next = getBillingDateForMonth(year, month + 1, sub.day);
  }

  return next;
}

function getBillingDateForMonth(year, month, day) {
  const rawDay = Number(day);
  const safeDay = Number.isFinite(rawDay)
    ? Math.max(1, Math.min(31, Math.trunc(rawDay)))
    : 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(safeDay, daysInMonth));
}

// -----------------------------------------------------------
// 9. RENDER SUBSCRIPTION LIST (sidebar)
// -----------------------------------------------------------
function renderSubList() {
  const list = document.getElementById("sub-list");
  if (!list) return;

  const query = getSearchQuery();
  const filteredSubs = query
    ? subscriptions.filter((s) =>
        s.name.toLowerCase().includes(query) ||
        normalizeServiceKey(s.name).includes(query),
      )
    : subscriptions;

  if (subscriptions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big">
          <span class="icon icon--lg" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
            </svg>
          </span>
        </div>
        No subscriptions yet
      </div>`;
    return;
  }

  if (filteredSubs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="big">
          <span class="icon icon--lg" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
        </div>
        No subscriptions match your search
      </div>`;
    return;
  }

  list.innerHTML = filteredSubs
    .map((s) => {
      const next = getNextBillingDate(s);
      const dateStr = next.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
      });
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
        <button class="delete-btn" onclick='openDeleteModal(${JSON.stringify(s.id)}, ${JSON.stringify(s.name)})' aria-label="Delete ${escapeHTML(s.name)}">&times;</button>
      </div>`;
    })
    .join("");
}

// -----------------------------------------------------------
// 12. HELPERS + INITIAL RENDER
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

function getSearchQuery() {
  const input = document.getElementById("search-input");
  return String(input?.value || "")
    .trim()
    .toLowerCase();
}

function getSelectedBillingDay() {
  const dayInput = document.getElementById("f-day");
  const dateInput = document.getElementById("f-date");

  const dayFromField = parseInt(dayInput?.value || "", 10);
  if (!isNaN(dayFromField)) return dayFromField;

  const dateValue = String(dateInput?.value || "");
  const parts = dateValue.split("-");
  const dayFromDate = parseInt(parts[2] || "", 10);

  if (!isNaN(dayFromDate)) {
    if (dayInput) dayInput.value = String(dayFromDate);
    return dayFromDate;
  }

  return NaN;
}

function initUiBindings() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.addEventListener("input", renderSubList);

  const notifBtn = document.getElementById("notif-btn");
  const notifModalOverlay = document.getElementById("notif-modal-overlay");
  const notifCloseBtn = document.getElementById("notif-close-btn");
  const notifMarkAllBtn = document.getElementById("notif-mark-all-btn");
  const notifList = document.getElementById("notif-list");
  const deleteModalOverlay = document.getElementById("delete-modal-overlay");
  const deleteModalCancel = document.getElementById("delete-modal-cancel");
  const deleteModalConfirm = document.getElementById("delete-modal-confirm");

  if (notifBtn && notifModalOverlay) {
    const openNotifications = () => {
      notifModalOverlay.classList.add("open");
      notifBtn.setAttribute("aria-expanded", "true");
    };

    const closeNotifications = () => {
      notifModalOverlay.classList.remove("open");
      notifBtn.setAttribute("aria-expanded", "false");
    };

    notifBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !notifModalOverlay.classList.contains("open");
      if (willOpen) {
        openNotifications();
      } else {
        closeNotifications();
      }
    });

    if (notifCloseBtn) {
      notifCloseBtn.addEventListener("click", closeNotifications);
    }

    notifModalOverlay.addEventListener("click", (event) => {
      if (event.target === notifModalOverlay) {
        closeNotifications();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && notifModalOverlay.classList.contains("open")) {
        closeNotifications();
      }
    });

    if (notifMarkAllBtn) {
      notifMarkAllBtn.addEventListener("click", () => {
        markAllUpcomingNotificationsSeen();
        renderNotificationBell();
      });
    }

    if (notifList) {
      notifList.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const seenButton = target.closest(".notif-seen-btn");
        if (!seenButton) return;

        const notificationKey = seenButton.getAttribute("data-notif-key");
        if (!notificationKey) return;

        markNotificationSeenByKey(notificationKey);
        renderNotificationBell();
      });
    }
  }

  const dateInput = document.getElementById("f-date");
  const dayInput = document.getElementById("f-day");
  if (dateInput && dayInput) {
    const syncDay = () => {
      const value = String(dateInput.value || "");
      const parts = value.split("-");
      const day = parseInt(parts[2] || "", 10);
      dayInput.value = isNaN(day) ? "" : String(day);
    };

    dateInput.addEventListener("change", syncDay);
    dateInput.addEventListener("input", syncDay);
    syncDay();
  }

  if (deleteModalCancel) {
    deleteModalCancel.addEventListener("click", closeDeleteModal);
  }

  if (deleteModalConfirm) {
    deleteModalConfirm.addEventListener("click", confirmDeleteSubscription);
  }

  if (deleteModalOverlay) {
    deleteModalOverlay.addEventListener("click", (event) => {
      if (event.target === deleteModalOverlay) {
        closeDeleteModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && deleteModalOverlay?.classList.contains("open")) {
      closeDeleteModal();
    }
  });
}

function renderNotificationBell() {
  const notifBtn = document.getElementById("notif-btn");
  const notifCount = document.getElementById("notif-count");
  const notifList = document.getElementById("notif-list");
  const notifEmpty = document.getElementById("notif-empty");
  const notifMarkAllBtn = document.getElementById("notif-mark-all-btn");
  if (!notifBtn || !notifCount || !notifList || !notifEmpty) return;

  const upcoming = getUpcomingRenewals();
  const seen = readSeenNotifications();
  const unseenCount = upcoming.filter((s) => !seen[s.notificationKey]).length;

  if (upcoming.length === 0) {
    notifBtn.classList.remove("has-alert");
    notifCount.hidden = true;
    notifCount.textContent = "0";
    notifList.innerHTML = "";
    notifEmpty.style.display = "block";
    if (notifMarkAllBtn) {
      notifMarkAllBtn.disabled = true;
      notifMarkAllBtn.textContent = "Mark all seen";
    }
    return;
  }

  notifBtn.classList.toggle("has-alert", unseenCount > 0);
  notifCount.hidden = unseenCount === 0;
  notifCount.textContent = unseenCount > 9 ? "9+" : String(unseenCount);
  notifEmpty.style.display = "none";
  if (notifMarkAllBtn) {
    notifMarkAllBtn.disabled = unseenCount === 0;
    notifMarkAllBtn.textContent =
      unseenCount === 0 ? "All seen" : "Mark all seen";
  }

  notifList.innerHTML = upcoming
    .slice(0, 6)
    .map((s) => {
      const iconUrl = escapeHTML(s.iconUrl || resolveServiceIconUrl(s.name));
      const seenByUser = Boolean(seen[s.notificationKey]);
      const when =
        s.daysLeft === 0
          ? "Renews today"
          : s.daysLeft === 1
            ? "Renews tomorrow"
            : `Renews in ${s.daysLeft} days`;
      const seenLabel = seenByUser ? "Seen" : "Mark as seen";

      return `
        <div class="notif-item ${seenByUser ? "is-seen" : ""}">
          <div class="notif-item-head">
            <div class="notif-item-title">
              <img src="${iconUrl}" alt="${escapeHTML(s.name)} icon">
              Your ${escapeHTML(s.name)} subscription is about to expire
            </div>
            <button class="notif-seen-btn ${seenByUser ? "is-seen" : ""}" type="button" data-notif-key="${escapeHTML(s.notificationKey)}" ${seenByUser ? "disabled" : ""}>${seenLabel}</button>
          </div>
          <div class="notif-item-sub">${when} - ${formatCurrency(s.price)}</div>
        </div>`;
    })
    .join("");
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

  if (!overlay) {
    if (appEl) {
      appEl.style.display = "";
      appEl.style.opacity = "1";
    }
    return;
  }

  // Hide app until loader finishes
  if (appEl) {
    appEl.style.opacity = "0";
    appEl.style.display = "none";
  }

  // Init theme early so loader matches
  initTheme();
  initUiBindings();

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

    if (fill) fill.style.width = progress + "%";
    if (percentEl) percentEl.textContent = progress + "%";

    if (raw < 1) {
      requestAnimationFrame(tick);
    } else {
      startZoomPhase();
    }
  }

  function startZoomPhase() {
    overlay.classList.add("zoom");

    setTimeout(async function () {
      overlay.classList.add("hide");

      if (appEl) {
        appEl.style.display = "";
        appEl.style.transition = "opacity 0.5s ease";
        appEl.style.opacity = "1";
      }

      const waitForDB = (timeoutMs = 8000) =>
        new Promise((resolve) => {
          const started = Date.now();
          const check = setInterval(() => {
            if (window.dbFunctions?.getSubscriptions) {
              clearInterval(check);
              resolve(true);
              return;
            }
            if (Date.now() - started >= timeoutMs) {
              clearInterval(check);
              resolve(false);
            }
          }, 50);
        });

      const dbReady = await waitForDB();
      if (dbReady) {
        const data = await window.dbFunctions.getSubscriptions();
        subscriptions = data.map((s) => ({
          id: s.id,
          name: s.name,
          price: Number(s.price),
          day: s.day,
          alertDays: s.alert_days,
          cycle: s.cycle || "monthly",
          category: s.category || "other",
          iconUrl: s.icon_url || resolveServiceIconUrl(s.name),
        }));
      }
      renderAll();
    }, 600);
  }

  if (fill && percentEl) {
    requestAnimationFrame(tick);
  } else {
    setTimeout(startZoomPhase, 350);
  }
})();
