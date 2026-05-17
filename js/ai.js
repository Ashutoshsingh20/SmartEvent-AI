const SmartAI = (() => {
  function trending(events) {
    return [...events].map(event => {
      const soon = daysUntil(event.date) >= 0 && daysUntil(event.date) <= 7 ? 1.5 : 1;
      return { ...event, trendingScore: event.registrationCount * soon };
    }).sort((a, b) => b.trendingScore - a.trendingScore);
  }
  function recommend(events, user, registrations = []) {
    const registered = new Set(registrations.filter(reg => reg.userId === user?.uid && reg.status === "active").map(reg => reg.eventId));
    const interests = (user?.interests || []).map(item => item.toLowerCase());
    return events.filter(event => !registered.has(event.id) && event.status !== "past").map(event => {
      let score = 0;
      event.tags.forEach(tag => { if (interests.includes(tag.toLowerCase())) score += 10; });
      if (interests.includes(event.category.toLowerCase())) score += 5;
      if (event.registrationCount > 50) score += 3;
      if (daysUntil(event.date) <= 7 && daysUntil(event.date) >= 0) score += 2;
      return { ...event, recommendationScore: score };
    }).sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, 6);
  }
  function notificationsFor(events) {
    return events.flatMap(event => {
      const notes = [];
      if (event.seatsAvailable / event.totalSeats < .2) notes.push(`${event.title}: seats filling fast.`);
      const deadlineHours = (new Date(event.registrationDeadline) - new Date()) / 36e5;
      if (deadlineHours > 0 && deadlineHours < 48) notes.push(`${event.title}: registration closes soon.`);
      if (Math.abs(new Date(event.date) - new Date()) / 36e5 < .5) notes.push(`${event.title}: live now.`);
      return notes;
    });
  }
  return { trending, recommend, notificationsFor };
})();
