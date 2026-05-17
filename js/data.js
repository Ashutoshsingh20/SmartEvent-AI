const SmartStore = (() => {
  const categories = ["Tech", "Cultural", "Sports", "Workshop", "Seminar", "Hackathon"];
  const images = [
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80"
  ];
  const seedEvents = [
    ["ev-ai-summit", "AI Research Summit", "Tech", 12, "Auditorium A", 320, 91, ["ai", "research", "seminar"], "A high-density summit covering applied AI, responsible systems, and student research demos."],
    ["ev-hack-night", "48 Hour Campus Hackathon", "Hackathon", 20, "Innovation Lab", 180, 157, ["coding", "product", "ai"], "Teams ship prototypes with mentors, judging, live demos, and late-night build rooms."],
    ["ev-design-sprint", "UX Design Sprint Studio", "Workshop", 7, "Design Block 204", 60, 44, ["design", "portfolio", "workshop"], "Hands-on design sprint for student founders and creative technologists."],
    ["ev-cultural", "Monochrome Cultural Night", "Cultural", 16, "Open Air Theatre", 500, 388, ["music", "dance", "art"], "A campus arts showcase with performances, installations, and club pop-ups."],
    ["ev-football", "Inter-Department Football Finals", "Sports", 4, "Main Ground", 900, 702, ["football", "sports"], "The annual finals with student sections, live scoreboards, and awards."],
    ["ev-career", "Founder Stories Seminar", "Seminar", 10, "Seminar Hall 2", 140, 53, ["startup", "career"], "Alumni founders discuss the first 100 days of building from campus ideas."],
    ["ev-cyber", "Cybersecurity Capture The Flag", "Tech", 28, "Network Lab", 120, 68, ["security", "ctf", "coding"], "A guided CTF for beginner and intermediate security learners."],
    ["ev-data", "Data Visualization Masterclass", "Workshop", 32, "Analytics Studio", 90, 22, ["data", "charts", "portfolio"], "Build readable dashboards and portfolio-grade visual narratives."],
    ["ev-debate", "Policy Debate Invitational", "Cultural", 3, "Library Forum", 160, 159, ["debate", "policy"], "Fast-paced debate rounds hosted by the humanities council."],
    ["ev-robotics", "Robotics Line Follower League", "Tech", 40, "Robotics Arena", 220, 109, ["robotics", "hardware"], "Student robots compete across precision, speed, and recovery tracks."],
    ["ev-yoga", "Sunrise Wellness Session", "Sports", -3, "Central Lawn", 80, 75, ["wellness", "fitness"], "A calm early-morning session for students before exam week."],
    ["ev-ml", "ML Paper Reading Circle", "Seminar", 2, "CS Lab 1", 70, 41, ["ai", "reading", "research"], "A structured paper discussion with practical takeaways and open Q&A."]
  ].map((row, i) => {
    const date = new Date();
    date.setDate(date.getDate() + row[3]);
    date.setHours(10 + (i % 8), i % 2 ? 30 : 0, 0, 0);
    const deadline = new Date(date);
    deadline.setDate(deadline.getDate() - 1);
    const status = row[3] < 0 ? "past" : row[3] <= 1 ? "live" : "upcoming";
    return {
      id: row[0], title: row[1], category: row[2], date: date.toISOString(), venue: row[4],
      totalSeats: row[5], registrationCount: row[6], seatsAvailable: row[5] - row[6],
      tags: row[7], description: row[8], organizerName: ["Rahul Verma", "Tech Club", "Student Affairs"][i % 3],
      bannerUrl: images[i % images.length], registrationDeadline: deadline.toISOString(), status,
      createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString()
    };
  });

  let firebase = null;
  let state = { events: seedEvents, users: [], currentUserId: null, registrations: [], attendance: [], notifications: [], contactMessages: [] };

  const ready = (async () => {
    const page = document.body.dataset.page;
    const mustWaitForFirebase = ["login", "dashboard", "admin", "contact"].includes(page);
    if (!mustWaitForFirebase) {
      waitForFirebase()
        .then(fb => {
          firebase = fb;
          return waitForAuth();
        })
        .then(() => refresh());
      return state;
    }
    firebase = await waitForFirebase();
    await waitForAuth();
    if (["dashboard", "admin"].includes(page)) await refresh();
    else refresh();
    return state;
  })();

  function waitForFirebase() {
    if (window.SmartFirebase) return Promise.resolve(window.SmartFirebase);
    return new Promise(resolve => {
      window.addEventListener("smartfirebase:ready", () => resolve(window.SmartFirebase), { once: true });
    });
  }

  function waitForAuth() {
    return new Promise(resolve => {
      firebase.authApi.onAuthStateChanged(firebase.auth, async user => {
        state.currentUserId = user?.uid || null;
        resolve(user);
      });
    });
  }

  function cleanDoc(data) {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => {
      if (value?.toDate) return [key, value.toDate().toISOString()];
      return [key, value];
    }));
  }

  async function loadCollection(name) {
    try {
      const snap = await firebase.dbApi.getDocs(firebase.dbApi.collection(firebase.db, name));
      return snap.docs.map(docSnap => ({ id: docSnap.id, ...cleanDoc(docSnap.data()) }));
    } catch (error) {
      console.warn(`Could not read ${name}`, error.code || error.message);
      return [];
    }
  }

  async function refresh() {
    const page = document.body.dataset.page;
    const needsEvents = !["login", "about"].includes(page);
    const eventsPromise = needsEvents ? loadCollection("events") : Promise.resolve([]);
    const events = await eventsPromise;
    let users = [];
    let registrations = [];
    let attendance = [];
    let notifications = [];
    const uid = firebase.auth.currentUser?.uid;
    if (uid) {
      const ownUser = await loadDoc("users", uid);
      if (ownUser) users = [ownUser];
      registrations = await loadWhere("registrations", "userId", "==", uid);
      notifications = await loadWhere("notifications", "userId", "==", uid);
      if (ownUser?.role === "organizer" || ownUser?.role === "admin") {
        const [allUsers, allRegistrations, allAttendance, allNotifications] = await Promise.all([
          loadCollection("users"),
          loadCollection("registrations"),
          loadCollection("attendance"),
          loadCollection("notifications")
        ]);
        users = allUsers.length ? allUsers : users;
        registrations = allRegistrations.length ? allRegistrations : registrations;
        attendance = allAttendance;
        notifications = allNotifications.length ? allNotifications : notifications;
      }
    }
    state = { ...state, events: events.length ? events : state.events, users, registrations, attendance, notifications, currentUserId: uid || null };
    window.dispatchEvent(new CustomEvent("smartstore:update"));
    return state;
  }

  async function loadDoc(name, id) {
    try {
      const snap = await firebase.dbApi.getDoc(firebase.dbApi.doc(firebase.db, name, id));
      return snap.exists() ? { id: snap.id, ...cleanDoc(snap.data()) } : null;
    } catch (error) {
      console.warn(`Could not read ${name}/${id}`, error.code || error.message);
      return null;
    }
  }

  async function loadWhere(name, field, op, value) {
    try {
      const ref = firebase.dbApi.collection(firebase.db, name);
      const q = firebase.dbApi.query(ref, firebase.dbApi.where(field, op, value));
      const snap = await firebase.dbApi.getDocs(q);
      return snap.docs.map(docSnap => ({ id: docSnap.id, ...cleanDoc(docSnap.data()) }));
    } catch (error) {
      console.warn(`Could not query ${name}`, error.code || error.message);
      return [];
    }
  }

  function getState() {
    return state;
  }

  async function setState(mutator) {
    mutator(state);
    window.dispatchEvent(new CustomEvent("smartstore:update"));
    await persistAll();
    return state;
  }

  async function persistAll() {
    if (!firebase.auth.currentUser) return;
    const uid = firebase.auth.currentUser.uid;
    const user = state.users.find(u => u.uid === uid);
    const userRole = user?.role || "student";
    const isOrganizerOrAdmin = userRole === "organizer" || userRole === "admin";

    // Always write only the current user's own document
    const usersBatch = firebase.dbApi.writeBatch(firebase.db);
    const ownUser = state.users.find(u => u.uid === uid);
    if (ownUser) {
      usersBatch.set(firebase.dbApi.doc(firebase.db, "users", uid), withoutId(ownUser), { merge: true });
    }

    // Students can only write their own registrations
    state.registrations
      .filter(reg => reg.userId === uid)
      .forEach(reg => usersBatch.set(firebase.dbApi.doc(firebase.db, "registrations", reg.ticketId), withoutId(reg), { merge: true }));

    try {
      await usersBatch.commit();
    } catch (error) {
      console.warn("Firestore write failed", error.code || error.message);
    }

    // Organizers and admins can also write events, attendance, notifications
    if (isOrganizerOrAdmin) {
      try {
        const adminBatch = firebase.dbApi.writeBatch(firebase.db);
        state.events.forEach(event => adminBatch.set(firebase.dbApi.doc(firebase.db, "events", event.id), withoutId(event), { merge: true }));
        state.attendance.forEach(row => adminBatch.set(firebase.dbApi.doc(firebase.db, "attendance", row.ticketId), withoutId(row), { merge: true }));
        state.notifications
          .filter(n => n.userId === uid)
          .forEach(note => adminBatch.set(firebase.dbApi.doc(firebase.db, "notifications", note.id), withoutId(note), { merge: true }));
        await adminBatch.commit();
      } catch (error) {
        console.warn("Firestore organizer write failed", error.code || error.message);
        if (typeof toast === "function") toast("Firestore rejected one or more writes. Check rules/role.");
      }
    }
  }

  function withoutId(item) {
    const copy = { ...item };
    delete copy.id;
    return copy;
  }

  async function createUserProfile(user, profile) {
    const payload = {
      uid: user.uid,
      name: profile.name || user.displayName || user.email?.split("@")[0] || "Campus User",
      email: user.email,
      role: profile.role === "organizer" ? "organizer" : "student",
      interests: profile.interests || [],
      registeredEvents: [],
      disabled: false,
      createdAt: new Date().toISOString()
    };
    await firebase.dbApi.setDoc(firebase.dbApi.doc(firebase.db, "users", user.uid), payload, { merge: true });
    await refresh();
    return payload;
  }

  async function upsertGoogleUser(user) {
    const ref = firebase.dbApi.doc(firebase.db, "users", user.uid);
    const existing = await firebase.dbApi.getDoc(ref);
    if (!existing.exists()) return createUserProfile(user, { role: "student" });
    await refresh();
    return { uid: user.uid, ...existing.data() };
  }

  async function seedDemoEvents() {
    const batch = firebase.dbApi.writeBatch(firebase.db);
    const user = currentUser();
    seedEvents.forEach(event => batch.set(firebase.dbApi.doc(firebase.db, "events", event.id), withoutId({
      ...event,
      organizerId: user?.uid || firebase.auth.currentUser.uid,
      organizerName: user?.name || firebase.auth.currentUser.displayName || "Campus Organizer"
    }), { merge: true }));
    await batch.commit();
    await refresh();
  }

  async function addContact(data) {
    await firebase.dbApi.addDoc(firebase.dbApi.collection(firebase.db, "contactMessages"), {
      ...data,
      createdAt: new Date().toISOString()
    });
  }

  function makeRegistration(user, event) {
    const ticketId = crypto.randomUUID();
    return {
      ticketId, userId: user.uid, eventId: event.id, userName: user.name, eventTitle: event.title,
      eventDate: event.date, venue: event.venue, qrPayload: JSON.stringify({ ticketId, userId: user.uid, eventId: event.id }),
      status: "active", registeredAt: new Date().toISOString()
    };
  }

  function currentUser() {
    return state.users.find(user => user.uid === state.currentUserId) || null;
  }

  return { categories, ready, refresh, getState, setState, currentUser, makeRegistration, createUserProfile, upsertGoogleUser, seedDemoEvents, addContact };
})();
