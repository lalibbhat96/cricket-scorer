// Email + password sign in with Supabase Auth.
// Only a signed-in scorer can save matches; everyone can view them.
(function () {
  const panel = document.getElementById("auth");
  if (typeof db === "undefined" || !db) return; // Supabase not connected: hide sign-in
  panel.hidden = false;

  const form = document.getElementById("auth-form");
  const inBox = document.getElementById("auth-in");
  const status = document.getElementById("auth-status");

  function update(session) {
    signedIn = !!session;
    form.hidden = signedIn;
    inBox.hidden = !signedIn;
    if (session) document.getElementById("auth-email").textContent = session.user.email;
    render(); // from main.js: refresh the Save button
  }

  db.auth.getSession().then(({ data }) => update(data.session));
  db.auth.onAuthStateChange((_event, session) => update(session));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Signing in...";
    const { error } = await db.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value,
    });
    status.textContent = error ? "Could not sign in: " + error.message : "";
    if (!error) form.reset();
  });

  document.getElementById("signout").addEventListener("click", () => db.auth.signOut());
})();
