const SmartRegistration = (() => {
  function requireUser() {
    // Check Firebase Auth first — don't redirect if just SmartStore hasn't loaded yet
    const firebaseUser = window.SmartFirebase?.auth?.currentUser;
    if (!firebaseUser) {
      toast("Please sign in to register.");
      setTimeout(() => {
        location.href = `login.html?returnUrl=${encodeURIComponent(location.href)}`;
      }, 1000);
      return null;
    }
    const user = SmartStore.currentUser();
    if (!user) {
      // Profile not yet loaded — try again after a brief wait
      toast("Loading your profile, please try again in a moment.");
      return null;
    }
    return user;
  }
  function register(eventId) {
    const user = requireUser();
    if (!user) return;
    let ticket = null;
    SmartStore.setState(state => {
      const event = state.events.find(item => item.id === eventId);
      if (!event) return toast("Event not found.");
      if (event.seatsAvailable <= 0) return toast("This event is full.");
      if (new Date(event.registrationDeadline) < new Date()) return toast("Registration deadline has passed.");
      if (state.registrations.some(reg => reg.userId === user.uid && reg.eventId === eventId && reg.status === "active")) return toast("You already have a ticket.");
      event.seatsAvailable -= 1;
      event.registrationCount += 1;
      ticket = SmartStore.makeRegistration(user, event);
      state.registrations.push(ticket);
      const stateUser = state.users.find(item => item.uid === user.uid);
      stateUser.registeredEvents = [...new Set([...(stateUser.registeredEvents || []), eventId])];
    });
    if (ticket) showTicket(ticket, "Registered successfully.");
  }
  function cancel(ticketId) {
    SmartStore.setState(state => {
      const reg = state.registrations.find(item => item.ticketId === ticketId);
      if (!reg) return;
      const event = state.events.find(item => item.id === reg.eventId);
      if ((new Date(event.date) - new Date()) / 36e5 < 24) return toast("Cancellation closes 24 hours before the event.");
      reg.status = "cancelled";
      event.seatsAvailable += 1;
      event.registrationCount = Math.max(0, event.registrationCount - 1);
    });
    toast("Ticket cancelled.");
  }
  function showTicket(ticket, message = "Ticket") {
    modal(`<p class="eyebrow">${message}</p><h2>${ticket.eventTitle}</h2><p>${fmtDate(ticket.eventDate)} · ${ticket.venue}</p><div id="ticket-qr" class="qr-box" style="width:300px;height:300px;margin:18px auto"></div><p class="badge">${ticket.ticketId}</p><button class="button primary full" id="download-ticket">Download Ticket</button>`);
    setTimeout(() => {
      if (window.QRCode) new QRCode($("#ticket-qr"), { text: ticket.qrPayload, width: 288, height: 288 });
      $("#download-ticket")?.addEventListener("click", () => downloadTicket(ticket));
    });
  }
  function downloadTicket(ticket) {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.font = "700 42px Inter";
    ctx.fillText("SmartEvent AI", 42, 70);
    ctx.font = "700 34px Inter";
    ctx.fillText(ticket.eventTitle, 42, 150);
    ctx.font = "22px Inter";
    ctx.fillText(ticket.userName, 42, 205);
    ctx.fillText(`${fmtDate(ticket.eventDate)} · ${ticket.venue}`, 42, 245);
    ctx.font = "16px monospace";
    ctx.fillText(ticket.ticketId, 42, 450);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${ticket.eventTitle.replace(/\W+/g, "-").toLowerCase()}-ticket.png`;
    a.click();
  }
  return { register, cancel, showTicket, downloadTicket };
})();
