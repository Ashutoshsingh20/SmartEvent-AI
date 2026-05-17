function setupEventsPage() {
  const state = SmartStore.getState();
  const filters = {
    q: "", categories: new Set(), start: "", end: "", status: "all", available: false, sort: "dateAsc", page: 1
  };
  const params = new URLSearchParams(location.search);
  if (params.get("category")) filters.categories.add(params.get("category"));
  $("#category-filters").innerHTML = SmartStore.categories.map(cat => {
    const count = state.events.filter(event => event.category === cat).length;
    const checked = filters.categories.has(cat) ? "checked" : "";
    return `<label><input type="checkbox" value="${cat}" ${checked}> ${cat} <span>(${count})</span></label>`;
  }).join("");
  function filtered() {
    let events = [...SmartStore.getState().events].filter(event => event.status !== "deleted" && event.status !== "draft");
    const query = filters.q.toLowerCase();
    if (query) events = events.filter(event => [event.title, event.description, event.venue, ...event.tags].join(" ").toLowerCase().includes(query));
    if (filters.categories.size) events = events.filter(event => filters.categories.has(event.category));
    if (filters.start) events = events.filter(event => new Date(event.date) >= new Date(filters.start));
    if (filters.end) events = events.filter(event => new Date(event.date) <= new Date(filters.end + "T23:59"));
    if (filters.status !== "all") events = events.filter(event => event.status === filters.status);
    if (filters.available) events = events.filter(event => event.seatsAvailable > 0);
    const sorts = {
      dateAsc: (a, b) => new Date(a.date) - new Date(b.date),
      dateDesc: (a, b) => new Date(b.date) - new Date(a.date),
      popular: (a, b) => b.registrationCount - a.registrationCount,
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    };
    return events.sort(sorts[filters.sort]);
  }
  function render() {
    const events = filtered();
    const pages = Math.max(1, Math.ceil(events.length / 12));
    filters.page = Math.min(filters.page, pages);
    const chunk = events.slice((filters.page - 1) * 12, filters.page * 12);
    $("#event-count").textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
    $("#events-grid").innerHTML = chunk.length ? chunk.map(event => renderEventCard(event, { trending: SmartAI.trending(events).slice(0, 3).some(item => item.id === event.id) })).join("") : `<div class="empty-state"><div><p class="eyebrow">EMPTY</p><h2>No events match these filters.</h2><button class="button ghost" id="clear-empty">Clear filters</button></div></div>`;
    const pagination = Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === filters.page ? "active" : ""}" data-page-no="${i + 1}">${i + 1}</button>`).join("");
    $("#pagination").innerHTML = pagination;
    $("#pagination-top").innerHTML = pagination;
    $$("[data-page-no]").forEach(btn => btn.addEventListener("click", () => { filters.page = Number(btn.dataset.pageNo); render(); }));
    $("#clear-empty")?.addEventListener("click", reset);
    const nextParams = new URLSearchParams();
    if (filters.q) nextParams.set("q", filters.q);
    if (filters.categories.size === 1) nextParams.set("category", [...filters.categories][0]);
    history.replaceState(null, "", `${location.pathname}${nextParams.toString() ? `?${nextParams}` : ""}`);
  }
  function reset() {
    Object.assign(filters, { q: "", start: "", end: "", status: "all", available: false, sort: "dateAsc", page: 1 });
    filters.categories.clear();
    $("#search-input").value = "";
    $("#start-date").value = "";
    $("#end-date").value = "";
    $("#available-only").checked = false;
    $("#sort-select").value = "dateAsc";
    $('[name="status"][value="all"]').checked = true;
    $$("#category-filters input").forEach(input => input.checked = false);
    render();
  }
  let timer;
  $("#search-input").addEventListener("input", event => { clearTimeout(timer); timer = setTimeout(() => { filters.q = event.target.value; filters.page = 1; render(); }, 300); });
  $$("#category-filters input").forEach(input => input.addEventListener("change", () => { input.checked ? filters.categories.add(input.value) : filters.categories.delete(input.value); filters.page = 1; render(); }));
  $("#start-date").addEventListener("input", event => { filters.start = event.target.value; render(); });
  $("#end-date").addEventListener("input", event => { filters.end = event.target.value; render(); });
  $$('[name="status"]').forEach(input => input.addEventListener("change", event => { filters.status = event.target.value; render(); }));
  $("#available-only").addEventListener("change", event => { filters.available = event.target.checked; render(); });
  $("#sort-select").addEventListener("change", event => { filters.sort = event.target.value; render(); });
  $("#reset-filters").addEventListener("click", reset);
  window.addEventListener("smartstore:update", render);
  render();
}

function setupDetailPage() {
  const id = new URLSearchParams(location.search).get("id");
  const state = SmartStore.getState();
  const event = state.events.find(item => item.id === id) || state.events[0];
  const registered = event.totalSeats - event.seatsAvailable;
  const related = state.events.filter(item => item.id !== event.id && item.category === event.category).slice(0, 3);

  $("#event-detail").innerHTML = `<section class="detail-hero"><img src="${event.bannerUrl}" alt="${event.title} banner"></section>
    <section class="detail-content">
      <article class="detail-main">
        <p class="pill">${event.category}</p>
        <h1>${event.title}</h1>
        <div class="meta-row"><span><i class="fa-solid fa-user"></i> ${event.organizerName}</span><span><i class="fa-regular fa-calendar"></i> ${fmtDate(event.date)}</span><span><i class="fa-solid fa-location-dot"></i> ${event.venue}</span></div>
        <div class="section">
          <h2>Description</h2>
          <p>${event.description}</p>
          <div class="tag-row">${event.tags.map(tag => `<a href="events.html?category=${encodeURIComponent(event.category)}">#${tag}</a>`).join("")}</div>
        </div>
        <section><h2>Related events</h2><div class="event-grid three">${related.map(item => renderEventCard(item)).join("")}</div></section>
      </article>
      <aside class="action-panel" id="action-panel">
        <div id="live-stats"></div>
        <p>Registration deadline: ${fmtDate(event.registrationDeadline)}</p>
        <p class="badge">${daysUntil(event.date)} days to go</p>
        <div id="register-action"></div>
        <button class="button ghost full" id="calendar-btn"><i class="fa-regular fa-calendar-plus"></i>Add to Calendar</button>
        <button class="button ghost full" id="share-btn"><i class="fa-solid fa-share-nodes"></i>Share</button>
      </aside>
    </section>`;

  function updateActionPanel() {
    const container = $("#register-action");
    const stats = $("#live-stats");
    if (!container || !stats) return;

    const user = SmartStore.currentUser();
    const firebaseUser = window.SmartFirebase?.auth?.currentUser;
    const currentState = SmartStore.getState();
    const freshEvent = currentState.events.find(e => e.id === event.id) || event;
    const freshStatus = liveStatus(freshEvent);
    const freshRegistered = freshEvent.totalSeats - freshEvent.seatsAvailable;

    stats.innerHTML = `<strong>${freshEvent.seatsAvailable} seats available</strong>
        <div class="progress"><span style="width:${Math.round((freshRegistered / freshEvent.totalSeats) * 100)}%"></span></div>`;

    if (freshStatus === "past") {
      container.innerHTML = `<button class="button primary full" disabled>Event Ended</button>`;
    } else if (freshEvent.seatsAvailable <= 0) {
      container.innerHTML = `<button class="button primary full" disabled>Event Full</button>`;
    } else if (!firebaseUser) {
      container.innerHTML = `<a class="button primary full" href="login.html?returnUrl=${encodeURIComponent(location.href)}">Sign In to Register</a>`;
    } else if (user && currentState.registrations.some(r => r.userId === user.uid && r.eventId === freshEvent.id && r.status === "active")) {
      container.innerHTML = `<button class="button primary full" disabled>✓ Already Registered</button>`;
    } else if (!user) {
      container.innerHTML = `<button class="button primary full" id="register-now">Register Now</button>`;
      $("#register-now").addEventListener("click", () => toast("Loading profile, please try again in a moment."));
    } else {
      container.innerHTML = `<button class="button primary full" id="register-now">Register Now</button>`;
      $("#register-now").addEventListener("click", () => SmartRegistration.register(freshEvent.id));
    }
  }

  updateActionPanel();
  window.addEventListener("smartstore:update", updateActionPanel);

  $("#calendar-btn").addEventListener("click", () => downloadCalendar(event));
  $("#share-btn").addEventListener("click", async () => {
    const url = location.href;
    if (navigator.share) await navigator.share({ title: event.title, url });
    else { await navigator.clipboard.writeText(url); toast("Event link copied."); }
  });
}

function downloadCalendar(event) {
  const dt = new Date(event.date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const body = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${dt}\nLOCATION:${event.venue}\nDESCRIPTION:${event.description}\nEND:VEVENT\nEND:VCALENDAR`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  a.download = `${event.title.replace(/\W+/g, "-").toLowerCase()}.ics`;
  a.click();
}

SmartStore.ready.then(() => {
  if (page === "events") setupEventsPage();
  if (page === "detail") setupDetailPage();
});
