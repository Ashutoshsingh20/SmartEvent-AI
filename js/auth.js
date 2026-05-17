async function setupAuth() {
  await SmartStore.ready;
  const { auth, googleProvider, authApi } = window.SmartFirebase;
  const tabs = $$("[data-auth-tab]");
  tabs.forEach(button => button.addEventListener("click", () => {
    tabs.forEach(item => item.classList.toggle("active", item === button));
    $("#signin-form").classList.toggle("hidden", button.dataset.authTab !== "signin");
    $("#signup-form").classList.toggle("hidden", button.dataset.authTab !== "signup");
  }));

  $$(".demo-accounts button").forEach(button => {
    button.textContent = button.dataset.demo === "admin" ? "Admin note" : `${button.dataset.demo[0].toUpperCase()}${button.dataset.demo.slice(1)} email`;
  });
  $$("[data-demo]").forEach(button => button.addEventListener("click", () => {
    const emails = {
      student: "student@college.edu",
      organizer: "organizer@college.edu",
      admin: "Create an account, then promote its users/{uid}.role to admin in Firestore."
    };
    if (button.dataset.demo === "admin") return toast(emails.admin);
    $('#signin-form [name="email"]').value = emails[button.dataset.demo];
    $('#signin-form [name="password"]').focus();
    toast("Enter that Firebase Auth user's password.");
  }));

  $("#google-demo").addEventListener("click", async () => {
    try {
      await (authApi.persistenceReady || Promise.resolve());
      const result = await authApi.signInWithPopup(auth, googleProvider);
      const userDoc = await SmartStore.upsertGoogleUser(result.user);
      routeAfterLogin(userDoc);
    } catch (error) {
      toast(authMessage(error));
    }
  });

  $("#signin-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const email = (data.email || "").trim();
    try {
      await window.SmartFirebase.persistenceReady;
      console.log(`Attempting login with email: "${email}"`);
      const result = await authApi.signInWithEmailAndPassword(auth, email, data.password);
      await SmartStore.refresh();
      const userDoc = SmartStore.currentUser() || await SmartStore.createUserProfile(result.user, { role: "student" });
      routeAfterLogin(userDoc);
    } catch (error) {
      console.error("Login failed:", error);
      toast(authMessage(error));
    }
  });

  const password = $('#signup-form [name="password"]');
  password.addEventListener("input", () => $(".strength-meter").dataset.score = String(scorePassword(password.value)));
  $("#signup-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const email = (data.email || "").trim();
    if (data.password !== data.confirm) return toast("Passwords do not match.");
    if (scorePassword(data.password) < 3) return toast("Use 8+ chars with uppercase, number, and symbol.");
    try {
      await window.SmartFirebase.persistenceReady;
      console.log(`Attempting signup with email: "${email}"`);
      const result = await authApi.createUserWithEmailAndPassword(auth, email, data.password);
      await authApi.updateProfile(result.user, { displayName: data.name });
      const userDoc = await SmartStore.createUserProfile(result.user, { name: data.name, role: data.role });
      routeAfterLogin(userDoc);
    } catch (error) {
      console.error("Signup failed:", error);
      toast(authMessage(error));
    }
  });

  $("#forgot-link").addEventListener("click", async event => {
    event.preventDefault();
    const email = $('#signin-form [name="email"]').value;
    if (!email) return toast("Enter your email first.");
    try {
      await authApi.sendPasswordResetEmail(auth, email);
      toast("Password reset email sent.");
    } catch (error) {
      toast(authMessage(error));
    }
  });
}

function scorePassword(value) {
  return [value.length >= 8, /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
}

function routeAfterLogin(user) {
  toast(`Signed in as ${user.name}.`);
  const returnUrl = new URLSearchParams(location.search).get("returnUrl");
  setTimeout(() => {
    location.href = returnUrl || (user.role === "student" ? "dashboard.html" : "admin.html");
  }, 350);
}

function authMessage(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account.";
  if (code.includes("weak-password")) return "Password is too weak.";
  if (code.includes("invalid-credential")) return "Invalid email or password.";
  if (code.includes("popup")) return "Google sign-in popup was closed or blocked.";
  if (code.includes("permission-denied")) return "Firestore rules blocked this action.";
  return error?.message || "Authentication failed.";
}

setupAuth();
