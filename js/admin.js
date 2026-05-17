function ensureAdmin() {
  const user = SmartStore.currentUser();
  if (!user) location.href = `login.html?returnUrl=${encodeURIComponent(location.href)}`;
  if (user && user.role === "student") location.href = "dashboard.html";
  return user;
}
function setupAdmin() {
  const user = ensureAdmin();
  if (!user) return;
  SmartStore.refresh();
  $("#admin-logout").addEventListener("click", async () => {
    await window.SmartFirebase.authApi.signOut(window.SmartFirebase.auth);
    location.href = "index.html";
  });
  function route() {
    const hash = (location.hash || "#overview").slice(1);
    const view = hash.split(":")[0];
    $$(".admin-sidebar a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === `#${view}`));
    $("#admin-view").innerHTML = `<div class="skeleton-pill"></div><div class="skeleton-line long" style="height:48px;margin:18px 0 24px"></div>${skeletonStats(4)}`;
    requestAnimationFrame(() => {
    const renderers = { overview, events, create, analytics, scanner, users, settings };
    (renderers[view] || overview)(user);
    });
  }
  addEventListener("hashchange", route);
  addEventListener("smartstore:update", route);
  route();
}
function overview() {
  const state = SmartStore.getState();
  const attended = state.registrations.filter(reg => reg.status === "attended").length;
  const rate = state.registrations.length ? Math.round((attended / state.registrations.length) * 100) : 0;
  $("#admin-view").innerHTML = `<p class="eyebrow">COMMAND CENTER</p><h1>Admin overview</h1>${statCards([["Total Events", state.events.length], ["Total Registrations", state.registrations.length], ["Attendance Rate", `${rate}%`], ["Active Users", state.users.length]])}<section class="section"><h2>Smart alerts</h2><div class="stack">${SmartAI.notificationsFor(state.events).map(note => `<article class="stat-card">${note}</article>`).join("")}</div></section>`;
}
function events() {
  const state = SmartStore.getState();
  $("#admin-view").innerHTML = `<div class="section-heading"><div><p class="eyebrow">EVENTS</p><h1>Event management</h1></div><button class="button primary" id="export-events">Export CSV</button></div><div class="table-wrap"><table><thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Seats Left</th><th>Registrations</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.events.map(event => `<tr><td>${event.title}</td><td>${event.category}</td><td>${fmtDate(event.date)}</td><td>${event.seatsAvailable}</td><td>${event.registrationCount}</td><td><select data-status="${event.id}"><option ${event.status==="upcoming"?"selected":""}>upcoming</option><option ${event.status==="live"?"selected":""}>live</option><option ${event.status==="past"?"selected":""}>past</option><option ${event.status==="cancelled"?"selected":""}>cancelled</option></select></td><td><button class="button ghost" data-edit="${event.id}">Edit</button> <button class="button ghost" data-delete="${event.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
  $$("[data-status]").forEach(select => select.addEventListener("change", () => SmartStore.setState(state => state.events.find(e => e.id === select.dataset.status).status = select.value)));
  $$("[data-delete]").forEach(btn => btn.addEventListener("click", () => { if (confirm("Soft-delete this event?")) SmartStore.setState(state => state.events.find(e => e.id === btn.dataset.delete).status = "deleted"); }));
  $$("[data-edit]").forEach(btn => btn.addEventListener("click", () => { location.hash = `create:${btn.dataset.edit}`; create(); }));
  $("#export-events").addEventListener("click", () => exportCsv("events.csv", state.events));
}
function create(user = SmartStore.currentUser()) {
  const editId = (location.hash.split(":")[1] || "");
  const event = SmartStore.getState().events.find(item => item.id === editId);
  $("#admin-view").innerHTML = `<p class="eyebrow">${event ? "EDIT" : "CREATE"}</p><h1>${event ? "Edit event" : "Create event"}</h1><form class="panel-form" id="event-form" style="max-width: 680px;">
    <label>Title<input name="title" maxlength="80" required value="${event?.title || ""}"></label>
    <label>Description<textarea name="description" maxlength="2000" required rows="4">${event?.description || ""}</textarea></label>
    <div class="split-inputs">
      <label>Category<select name="category">${SmartStore.categories.map(cat => `<option ${event?.category === cat ? "selected" : ""}>${cat}</option>`).join("")}</select></label>
      <label>Status<select name="status"><option>upcoming</option><option>draft</option><option>cancelled</option></select></label>
    </div>
    <label>Banner URL<input name="bannerUrl" value="${event?.bannerUrl || ""}" placeholder="https://..."></label>
    <div class="split-inputs"><label>Date<input type="date" name="date" required value="${event ? event.date.slice(0,10) : ""}"></label><label>Time<input type="time" name="time" required value="${event ? event.date.slice(11,16) : "10:00"}"></label></div>
    <label>Venue<input name="venue" maxlength="120" required value="${event?.venue || ""}"></label>
    <div class="split-inputs">
      <label>Total Seats<input type="number" name="totalSeats" min="1" max="5000" required value="${event?.totalSeats || 100}"></label>
      <label>Registration Deadline<input type="datetime-local" name="registrationDeadline" required value="${event ? event.registrationDeadline.slice(0,16) : ""}"></label>
    </div>
    <label>Tags<input name="tags" value="${event?.tags?.join(", ") || ""}" placeholder="ai, workshop, design"></label>
    <button class="button primary" style="margin-top: 12px;">Save Event</button>
  </form>`;
  $("#event-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const date = new Date(`${data.date}T${data.time}`);
    const deadline = new Date(data.registrationDeadline);
    if (date <= new Date() || deadline >= date) return toast("Use a future event date and earlier registration deadline.");
    SmartStore.setState(state => {
      const payload = { title: data.title, description: data.description, category: data.category, bannerUrl: data.bannerUrl || state.events[0].bannerUrl, date: date.toISOString(), venue: data.venue, totalSeats: Number(data.totalSeats), registrationDeadline: deadline.toISOString(), tags: data.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0,10), status: data.status, organizerId: user.uid, organizerName: user.name };
      if (event) Object.assign(state.events.find(item => item.id === event.id), payload);
      else state.events.unshift({ id: crypto.randomUUID(), ...payload, seatsAvailable: Number(data.totalSeats), registrationCount: 0, createdAt: new Date().toISOString() });
    });
    toast("Event saved.");
    location.hash = "#events";
  });
}
function analytics() {
  const state = SmartStore.getState();
  $("#admin-view").innerHTML = `<div class="section-heading"><div><p class="eyebrow">ANALYTICS</p><h1>Monochrome analytics</h1></div><button class="button ghost" id="export-analytics">Export Data</button></div><div class="chart-grid">${["Registrations Over Time","Registrations by Category","Top 5 Events by Popularity","Attendance Rate by Event","Monthly Participation Trend","User Growth"].map((title, i) => `<article class="chart-card"><h3>${title}</h3><canvas id="chart-${i}"></canvas></article>`).join("")}</div>`;
  const gray = ["#fff", "#d6d6d6", "#aaa", "#777", "#555", "#333"];
  const byCat = SmartStore.categories.map(cat => state.events.filter(e => e.category === cat).reduce((s, e) => s + e.registrationCount, 0));
  new Chart($("#chart-0"), { type: "line", data: { labels: state.events.slice(0, 8).map(e => e.title.slice(0, 8)), datasets: [{ data: state.events.slice(0, 8).map(e => e.registrationCount), borderColor: gray[0], backgroundColor: "rgba(255,255,255,.1)" }] }, options: chartOptions() });
  new Chart($("#chart-1"), { type: "doughnut", data: { labels: SmartStore.categories, datasets: [{ data: byCat, backgroundColor: gray }] }, options: chartOptions() });
  new Chart($("#chart-2"), { type: "bar", data: { labels: [...state.events].sort((a,b)=>b.registrationCount-a.registrationCount).slice(0,5).map(e=>e.title), datasets: [{ data: [...state.events].sort((a,b)=>b.registrationCount-a.registrationCount).slice(0,5).map(e=>e.registrationCount), backgroundColor: gray[1] }] }, options: chartOptions(true) });
  new Chart($("#chart-3"), { type: "bar", data: { labels: state.events.slice(0, 6).map(e => e.title.slice(0, 12)), datasets: [{ label: "Registered", data: state.events.slice(0, 6).map(e => e.registrationCount), backgroundColor: gray[2] }, { label: "Attended", data: state.events.slice(0, 6).map(e => Math.round(e.registrationCount * .68)), backgroundColor: gray[4] }] }, options: chartOptions() });
  new Chart($("#chart-4"), { type: "line", data: { labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], datasets: [{ data: [90,120,160,150,220,260,240,310,340,390,430,470], fill: true, borderColor: gray[0], backgroundColor: "rgba(255,255,255,.12)" }] }, options: chartOptions() });
  new Chart($("#chart-5"), { type: "line", data: { labels: state.users.map(u => u.name), datasets: [{ data: state.users.map((_, i) => i + 1), borderColor: gray[0] }] }, options: chartOptions() });
  $("#export-analytics").addEventListener("click", () => exportCsv("analytics.csv", state.events));
}
function chartOptions(indexAxisY = false) {
  return { responsive: true, maintainAspectRatio: false, indexAxis: indexAxisY ? "y" : "x", plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue("--text-secondary") } } }, scales: { x: { ticks: { color: "#999" }, grid: { color: "rgba(128,128,128,.18)" } }, y: { ticks: { color: "#999" }, grid: { color: "rgba(128,128,128,.18)" } } } };
}
function scanner() {
  const state = SmartStore.getState();
  $("#admin-view").innerHTML = `<p class="eyebrow">QR SCANNER</p><h1>Attendance scanner</h1><div class="scanner-grid"><div class="camera-box"><video id="qr-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;"></video><canvas id="qr-canvas" style="display:none;"></canvas><div class="crosshair"></div></div><aside class="scan-panel"><label>Manual ticket ID<input id="ticket-id-input" placeholder="Paste ticket ID"></label><button class="button primary full" id="scan-ticket">Verify Ticket</button><h3>Recent scans</h3><div id="scan-log" class="stack"></div></aside></div>`;
  
  function drawLog() {
    $("#scan-log").innerHTML = SmartStore.getState().attendance.slice(-20).reverse().map(row => `<article class="badge">${row.ticketId.slice(0, 8)} · ${fmtDate(row.scannedAt)}</article>`).join("") || `<p>No scans yet.</p>`;
  }

  function processTicket(id) {
    const currentState = SmartStore.getState();
    const reg = currentState.registrations.find(item => item.ticketId === id);
    if (!reg) return toast("Invalid ticket.");
    if (reg.status === "attended") return toast("Ticket already scanned.");
    SmartStore.setState(state => {
      const r = state.registrations.find(item => item.ticketId === id);
      r.status = "attended";
      state.attendance.push({ ticketId: id, userId: r.userId, eventId: r.eventId, scannedAt: new Date().toISOString(), scannedBy: SmartStore.currentUser().uid });
    });
    toast("Attendance marked.");
    drawLog();
  }

  $("#scan-ticket").addEventListener("click", () => {
    const id = $("#ticket-id-input").value.trim();
    if (id) processTicket(id);
  });
  
  drawLog();

  const video = $("#qr-video");
  const canvasElement = $("#qr-canvas");
  const canvas = canvasElement.getContext("2d", { willReadFrequently: true });
  let scanning = true;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(stream => {
    video.srcObject = stream;
    video.play();
    requestAnimationFrame(tick);
  }).catch(err => {
    console.error("Camera access denied or unavailable", err);
    toast("Camera access denied or unavailable.");
  });

  function tick() {
    if (!document.body.contains(video)) {
      if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
      return;
    }
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvasElement.height = video.videoHeight;
      canvasElement.width = video.videoWidth;
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        processTicket(code.data);
        scanning = false;
        setTimeout(() => { scanning = true; requestAnimationFrame(tick); }, 3000);
        return;
      }
    }
    requestAnimationFrame(tick);
  }
}
function users() {
  const state = SmartStore.getState();
  $("#admin-view").innerHTML = `<p class="eyebrow">USERS</p><h1>User management</h1><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Registered</th></tr></thead><tbody>${state.users.map(user => `<tr><td>${user.name}</td><td>${user.email}</td><td><select data-role="${user.uid}"><option ${user.role==="student"?"selected":""}>student</option><option ${user.role==="organizer"?"selected":""}>organizer</option><option ${user.role==="admin"?"selected":""}>admin</option></select></td><td>${fmtDate(user.createdAt)}</td><td>${user.registeredEvents.length}</td></tr>`).join("")}</tbody></table></div>`;
  $$("[data-role]").forEach(select => select.addEventListener("change", () => SmartStore.setState(state => state.users.find(u => u.uid === select.dataset.role).role = select.value)));
}
function settings() {
  $("#admin-view").innerHTML = `<p class="eyebrow">SETTINGS</p><h1>Firestore settings</h1><article class="stat-card"><p>Firebase is configured in <code>js/firebase.js</code>. Use the seed button once from an organizer/admin account to create the starter event catalog in Firestore.</p><button class="button ghost" id="seed-demo">Seed Starter Events</button></article>`;
  $("#seed-demo").addEventListener("click", async () => {
    try {
      await SmartStore.seedDemoEvents();
      toast("Starter events written to Firestore.");
    } catch (error) {
      toast("Could not seed events. Check your role and Firestore rules.");
    }
  });
}
function exportCsv(filename, rows) {
  const keys = Object.keys(rows[0] || {});
  const csv = [keys.join(","), ...rows.map(row => keys.map(key => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}
SmartStore.ready.then(setupAdmin);
