// Shows the most recent saved matches from Supabase.
async function loadHistory() {
  if (typeof db === "undefined" || !db) return; // Supabase not connected

  const section = document.getElementById("history");
  const list = document.getElementById("history-list");
  const status = document.getElementById("history-status");
  section.hidden = false;
  status.textContent = "Loading...";

  const { data, error } = await db
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    status.textContent = "Could not load matches: " + error.message;
    return;
  }

  list.replaceChildren();
  status.textContent = data.length ? "" : "No saved matches yet.";

  data.forEach((row) => {
    const li = document.createElement("li");

    const teams = document.createElement("div");
    teams.className = "teams";
    teams.textContent = row.team_a + " " + row.a_runs + "/" + row.a_wkts +
      " vs " + row.team_b + " " + row.b_runs + "/" + row.b_wkts;

    const res = document.createElement("div");
    res.className = "res";
    res.textContent = row.result;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = row.overs + " overs · " + new Date(row.created_at).toLocaleString();

    li.append(teams, res, meta);
    list.append(li);
  });
}

loadHistory();
