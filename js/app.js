const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fmtDate = iso => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const daysUntil = iso => Math.ceil((new Date(iso) - new Date()) / 86400000);
const page = document.body.dataset.page;

// Always compute event status from current time, ignoring the stored status field
function liveStatus(event) {
  const now = new Date();
  const start = new Date(event.date);
  // Consider event "live" for 3 hours after start time
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  if (now > end) return "past";
  if (now >= start) return "live";
  return "upcoming";
}

function toast(message) {
  const root = $("#toast-root") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "toast-root", className: "toast-root" }));
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 4000);
}

function modal(html) {
  const root = $("#modal-root") || document.body.appendChild(document.createElement("div"));
  root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="modal-panel">${html}<button class="button ghost full modal-close" type="button">Close</button></div></div>`;
  $(".modal-backdrop").addEventListener("click", event => {
    if (event.target.classList.contains("modal-backdrop") || event.target.classList.contains("modal-close")) root.innerHTML = "";
  });
}

function renderEventCard(event, opts = {}) {
  const status = liveStatus(event);
  const sold = Math.round((event.registrationCount / event.totalSeats) * 100);
  const trend = opts.trending ? `<span class="badge">Trending ■</span>` : "";
  const liveBadge = status === "live" ? `<span class="badge" style="background:#000;color:#fff">● LIVE</span>` : "";
  const pastLabel = status === "past" ? `<span class="badge" style="opacity:0.5">Past</span>` : "";
  const initials = event.category.slice(0, 2).toUpperCase();
  return `<a class="event-card${status === "past" ? " past-event" : ""}" href="event-detail.html?id=${event.id}">
    <div class="banner fast-banner" aria-label="${event.title} banner"><span>${initials}</span></div>
    <div class="event-card-body">
      <div class="meta-row"><span class="pill">${event.category}</span>${trend}${liveBadge}${pastLabel}</div>
      <h3 class="event-title">${event.title}</h3>
      <div class="meta-row"><span><i class="fa-regular fa-calendar"></i> ${fmtDate(event.date)}</span><span><i class="fa-solid fa-location-dot"></i> ${event.venue}</span></div>
      <div class="seat-line">${status === "past" ? "Event ended" : `${event.seatsAvailable} seats left`}<div class="progress"><span style="width:${sold}%"></span></div></div>
    </div>
  </a>`;
}

function statCards(items) {
  return `<div class="cards-grid">${items.map(([label, value]) => `<article class="stat-card"><span>${label}</span><h2>${value}</h2></article>`).join("")}</div>`;
}

function skeletonCards(count = 6) {
  return Array.from({ length: count }, () => `<article class="skeleton-card" aria-hidden="true">
    <div class="skeleton-media"></div>
    <div class="skeleton-body">
      <div class="skeleton-pill"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short"></div>
    </div>
  </article>`).join("");
}

function skeletonStats(count = 4) {
  return `<div class="cards-grid">${Array.from({ length: count }, () => `<article class="stat-card" aria-hidden="true"><div class="skeleton-line short"></div><div class="skeleton-line medium" style="height:34px;margin-top:16px"></div></article>`).join("")}</div>`;
}

function setupGlobalUi() {
  const theme = "light";
  document.documentElement.dataset.theme = theme;
  $$(".theme-toggle").forEach(button => button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
  }));
  $(".nav-toggle")?.addEventListener("click", () => $(".site-nav")?.classList.toggle("open"));

  // Update nav auth links reactively (auth may load after initial render on public pages)
  function updateNavAuth() {
    const user = SmartStore.currentUser();
    const firebaseUser = window.SmartFirebase?.auth?.currentUser;

    $$(".auth-link").forEach(link => {
      if (user) {
        link.textContent = user.role === "student" ? "Dashboard" : "Admin";
        link.href = user.role === "student" ? "dashboard.html" : "admin.html";
      } else if (firebaseUser) {
        // Firebase says logged in but profile not yet loaded
        link.textContent = "Dashboard";
        link.href = "dashboard.html";
      } else {
        link.textContent = "Login";
        link.href = "login.html";
      }
    });

    // Show/hide logout button
    let logoutBtn = $("#nav-logout-btn");
    if ((user || firebaseUser) && !logoutBtn) {
      const nav = $(".site-nav");
      if (nav) {
        logoutBtn = document.createElement("button");
        logoutBtn.id = "nav-logout-btn";
        logoutBtn.className = "button ghost";
        logoutBtn.textContent = "Logout";
        logoutBtn.style.fontSize = "14px";
        logoutBtn.addEventListener("click", async () => {
          await window.SmartFirebase.authApi.signOut(window.SmartFirebase.auth);
          location.href = "index.html";
        });
        nav.appendChild(logoutBtn);
      }
    } else if (!user && !firebaseUser && logoutBtn) {
      logoutBtn.remove();
    }
  }

  updateNavAuth();
  window.addEventListener("smartstore:update", updateNavAuth);

  $("#contact-form")?.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    SmartStore.addContact(data)
      .then(() => {
        event.target.reset();
        toast("Message stored in Firestore contactMessages.");
      })
      .catch(() => toast("Could not send message. Check Firestore rules."));
  });
}

function setupHome() {
  const state = SmartStore.getState();
  const trending = SmartAI.trending(state.events);
  $("#featured-events").innerHTML = [...state.events].sort((a, b) => b.registrationCount - a.registrationCount).slice(0, 3).map(event => renderEventCard(event)).join("");
  $("#trending-events").innerHTML = trending.slice(0, 5).map(event => renderEventCard(event, { trending: true })).join("");
  $("#category-grid").innerHTML = SmartStore.categories.map(cat => {
    const count = state.events.filter(event => event.category === cat).length;
    const icon = { Tech: "fa-microchip", Cultural: "fa-masks-theater", Sports: "fa-medal", Workshop: "fa-screwdriver-wrench", Seminar: "fa-chalkboard-user", Hackathon: "fa-code" }[cat];
    return `<a class="category-tile" href="events.html?category=${encodeURIComponent(cat)}"><i class="fa-solid ${icon}"></i><h3>${cat}</h3><span>${count} events</span></a>`;
  }).join("");
  const quotes = [
    ["Registration that finally feels as fast as the rest of campus life.", "Priya Sharma", "CS Sophomore"],
    ["We stopped reconciling spreadsheets at midnight after every event.", "Rahul Verma", "Tech Club"],
    ["The analytics view gives Student Affairs a clean operational picture.", "Dr. Anjali Mehta", "Dean"]
  ];
  let index = 0;
  const drawQuote = () => {
    const item = quotes[index % quotes.length];
    $("#testimonials").innerHTML = `<article class="testimonial"><blockquote>“${item[0]}”</blockquote><strong>${item[1]}</strong><p>${item[2]}</p></article>`;
    index += 1;
  };
  drawQuote();
  setInterval(drawQuote, 5000);
  const counters = $$("[data-count]");
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const target = entry.target;
    const end = Number(target.dataset.count);
    let current = 0;
    const tick = () => {
      current += Math.ceil(end / 42);
      target.textContent = Math.min(current, end).toLocaleString();
      if (current < end) requestAnimationFrame(tick);
    };
    tick();
    observer.unobserve(target);
  }));
  counters.forEach(counter => observer.observe(counter));
  const hero = $(".spotlight");
  window.addEventListener("pointermove", event => {
    hero?.style.setProperty("--mx", `${(event.clientX / innerWidth) * 100}%`);
    hero?.style.setProperty("--my", `${(event.clientY / innerHeight) * 100}%`);
  });
  setupParticles();
}

function setupParticles() {
  const canvas = $("#particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dots = Array.from({ length: 28 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2, vx: -.12 + Math.random() * .24, vy: -.12 + Math.random() * .24 }));
  const resize = () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  };
  resize();
  addEventListener("resize", resize, { passive: true });
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary");
    dots.forEach(dot => {
      dot.x = (dot.x + dot.vx / canvas.width + 1) % 1;
      dot.y = (dot.y + dot.vy / canvas.height + 1) % 1;
      ctx.globalAlpha = .35;
      ctx.beginPath();
      ctx.arc(dot.x * canvas.width, dot.y * canvas.height, dot.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  frame();
}

document.addEventListener("DOMContentLoaded", async () => {
  await SmartStore.ready;
  setupGlobalUi();
  if (page === "home") setupHome();
});
