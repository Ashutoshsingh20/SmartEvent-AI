async function ensureStudent() {
  // Wait for Firebase Auth to confirm session
  const firebaseUser = window.SmartFirebase?.auth?.currentUser;
  if (!firebaseUser) {
    location.href = `login.html?returnUrl=${encodeURIComponent(location.href)}`;
    return null;
  }
  let user = SmartStore.currentUser();
  // If SmartStore has no profile (e.g. prior Firestore write failed), create it now
  if (!user) {
    user = await SmartStore.createUserProfile(firebaseUser, {
      name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Campus User",
      role: "student"
    });
  }
  return user;
}

async function setupDashboard() {
  const user = await ensureStudent();
  if (!user) return;

  // Show Admin link only for organizers and admins
  if (user.role === "organizer" || user.role === "admin") {
    const adminLink = document.getElementById("nav-admin-link");
    if (adminLink) adminLink.hidden = false;
  }

  let currentView = (location.hash || "#overview").slice(1);
  let isRouting = false;

  function renderView(view, u) {
    $$(".tabs a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#${view}`));
    const renderers = { overview, events: myEvents, tickets, recommendations, notifications, profile };
    (renderers[view] || overview)(u);
  }

  function route() {
    if (isRouting) return;
    isRouting = true;
    currentView = (location.hash || "#overview").slice(1);
    const freshUser = SmartStore.currentUser() || user;
    $("#dashboard-view").innerHTML = `<div class="dashboard-hero"><div><div class="skeleton-pill"></div><div class="skeleton-line long" style="height:48px;margin-top:18px"></div></div></div>${skeletonStats(4)}`;
    requestAnimationFrame(() => {
      renderView(currentView, freshUser);
      isRouting = false;
    });
  }

  // On store update, re-render current view in place WITHOUT calling refresh() again
  function onStoreUpdate() {
    if (isRouting) return;
    isRouting = true;
    const freshUser = SmartStore.currentUser() || user;
    requestAnimationFrame(() => {
      renderView(currentView, freshUser);
      isRouting = false;
    });
  }

  addEventListener("hashchange", route);
  addEventListener("smartstore:update", onStoreUpdate);
  route();
}

function userRegs(user) {
  return SmartStore.getState().registrations.filter(reg => reg.userId === user.uid);
}
function statCards(items) {
  return `<div class="cards-grid">${items.map(([label, value]) => `<article class="stat-card"><span>${label}</span><h2>${value}</h2></article>`).join("")}</div>`;
}
function overview(user) {
  const state = SmartStore.getState();
  const regs = userRegs(user);
  const upcoming = regs.filter(reg => new Date(reg.eventDate) > new Date() && reg.status === "active");
  const recs = SmartAI.recommend(state.events, user, state.registrations);
  $("#dashboard-view").innerHTML = `<div class="dashboard-hero"><div><p class="eyebrow">OVERVIEW</p><h1>${greeting()}, ${user.name}</h1></div><a class="button primary" href="events.html">Explore Events</a></div>
    ${statCards([["Events Registered", regs.length], ["Events Attended", regs.filter(r => r.status === "attended").length], ["Upcoming Events", upcoming.length], ["Recommendations", recs.length]])}
    <section class="section"><div class="section-heading"><h2>Upcoming events</h2><a href="#tickets">View tickets</a></div><div class="horizontal-strip">${upcoming.map(reg => ticketCard(reg)).join("") || `<div class="empty-state">No upcoming registrations yet.</div>`}</div></section>
    <section><div class="section-heading"><h2>For You</h2><button class="button ghost" id="refresh-recs">Refresh Recommendations</button></div><div class="event-grid three">${recs.map(event => renderEventCard(event)).join("")}</div></section>`;
  $("#refresh-recs")?.addEventListener("click", () => { toast("Recommendations refreshed."); overview(user); });
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function ticketCard(reg) {
  return `<article class="ticket-card"><div class="qr-box" data-qr="${encodeURIComponent(reg.qrPayload)}"></div><h3>${reg.eventTitle}</h3><p>${fmtDate(reg.eventDate)}<br>${reg.venue}</p><span class="badge">${reg.status}</span><button class="button ghost" data-ticket="${reg.ticketId}">View Full Ticket</button></article>`;
}
function hydrateTicketButtons() {
  $$(".qr-box[data-qr]").forEach(box => {
    if (window.QRCode && !box.dataset.done) {
      new QRCode(box, { text: decodeURIComponent(box.dataset.qr), width: 74, height: 74 });
      box.dataset.done = "1";
    }
  });
  $$("[data-ticket]").forEach(btn => btn.addEventListener("click", () => {
    const reg = SmartStore.getState().registrations.find(item => item.ticketId === btn.dataset.ticket);
    SmartRegistration.showTicket(reg);
  }));
}
function myEvents(user) {
  const ids = new Set(userRegs(user).map(reg => reg.eventId));
  const events = SmartStore.getState().events.filter(event => ids.has(event.id));
  $("#dashboard-view").innerHTML = `<p class="eyebrow">MY EVENTS</p><h1>Registered events</h1><div class="event-grid">${events.map(event => renderEventCard(event)).join("") || `<div class="empty-state">No registered events yet.</div>`}</div>`;
}
function tickets(user) {
  const regs = userRegs(user);
  $("#dashboard-view").innerHTML = `<div class="section-heading"><div><p class="eyebrow">TICKETS</p><h1>Ticket archive</h1></div><select id="ticket-filter"><option value="all">All</option><option value="active">Upcoming</option><option value="attended">Attended</option><option value="cancelled">Cancelled</option></select></div><div class="ticket-grid" id="ticket-grid"></div>`;
  function render() {
    const filter = $("#ticket-filter").value;
    const shown = filter === "all" ? regs : regs.filter(reg => reg.status === filter);
    $("#ticket-grid").innerHTML = shown.map(ticketCard).join("") || `<div class="empty-state">No tickets in this view.</div>`;
    hydrateTicketButtons();
  }
  $("#ticket-filter").addEventListener("change", render);
  render();
}
function recommendations(user) {
  const state = SmartStore.getState();
  const recs = SmartAI.recommend(state.events, user, state.registrations);
  $("#dashboard-view").innerHTML = `<p class="eyebrow">AI SIMULATION</p><h1>For You</h1><p class="page-heading">Scored by interests, tags, category match, popularity, and recency.</p><div class="event-grid">${recs.map(renderEventCard).join("")}</div>`;
}
function notifications(user) {
  const notes = SmartStore.getState().notifications.filter(note => note.userId === user.uid);
  $("#dashboard-view").innerHTML = `<p class="eyebrow">NOTIFICATIONS</p><h1>Notification center</h1><div class="stack">${notes.map(note => `<article class="stat-card"><span>${note.type}</span><h3>${note.message}</h3><p>${fmtDate(note.createdAt)}</p><button class="button ghost" data-read="${note.id}">${note.read ? "Read" : "Mark read"}</button></article>`).join("") || `<div class="empty-state">No notifications yet.</div>`}</div>`;
  $$("[data-read]").forEach(btn => btn.addEventListener("click", () => {
    SmartStore.setState(state => { const note = state.notifications.find(item => item.id === btn.dataset.read); if (note) note.read = true; });
  }));
}
function profile(user) {
  $("#dashboard-view").innerHTML = `<p class="eyebrow">PROFILE</p><h1>${user.name}</h1><form class="panel-form" id="profile-form"><label>Display name<input name="name" value="${user.name}"></label><label>Email<input value="${user.email}" readonly></label><label>Role<input value="${user.role}" readonly></label><label>Member since<input value="${fmtDate(user.createdAt)}" readonly></label><div><h3>Interest tags</h3><div class="chip-row">${SmartStore.categories.map(cat => `<label><input type="checkbox" value="${cat}" ${user.interests.includes(cat) ? "checked" : ""}> ${cat}</label>`).join("")}</div></div><button class="button primary">Save Profile</button></form>`;
  $("#profile-form").addEventListener("submit", event => {
    event.preventDefault();
    const interests = $$('#profile-form input[type="checkbox"]:checked').map(input => input.value);
    const name = new FormData(event.target).get("name");
    SmartStore.setState(state => { const u = state.users.find(item => item.uid === user.uid); u.name = name; u.interests = interests; });
    toast("Profile updated.");
  });
}
SmartStore.ready.then(setupDashboard);
