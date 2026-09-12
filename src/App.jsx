import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://zrkqlozptvaogsbuznkp.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3Fsb3pwdHZhb2dzYnV6bmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwOTgxNzEsImV4cCI6MjEwMzY3NDE3MX0.8KoRdnKfjvjZvqU294_7HxRBeguB1XR246WcRD0nNUE";

const CLIENTS = ["Talabat", "Keeta", "Snoonu", "Rafeeq"];
const DEDUCTION_TYPES = [
  "Traffic Violation",
  "Internet Bill",
  "Motor Bike Rent",
  "Cash Advance",
  "Merchandise Damaged",
  "Bad Order Id",
  "Office Charge",
  "Other",
];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => d.slice(0, 7);
const fmt = (n) => Number(n || 0).toFixed(2);
const monthLabel = (mk) => {
  const [y, m] = mk.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Supabase helpers (plain fetch, no SDK needed) ----
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign in failed");
  return data; // { access_token, user, ... }
}

function sb(session) {
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
  return {
    async list(table, order = "") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${order}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async insert(table, row) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async update(table, id, patch) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async remove(table, id) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
    },
  };
}

// DB rows use snake_case; app state uses camelCase
const riderFromDb = (r) => ({ id: r.id, riderId: r.rider_id || "", name: r.name, qid: r.qid || "", phone: r.phone || "", client: r.client, rate: Number(r.rate), kmRate: Number(r.km_rate || 0), status: r.status });
const riderToDb = (r) => ({ id: r.id, rider_id: r.riderId, name: r.name, qid: r.qid, phone: r.phone, client: r.client, rate: r.rate, km_rate: r.kmRate, status: r.status });
const deliveryFromDb = (d) => ({ id: d.id, riderId: d.rider_id, date: d.date, count: d.count === null ? "" : Number(d.count), km: d.km === null ? "" : Number(d.km) });
const deductionFromDb = (d) => ({ id: d.id, riderId: d.rider_id, amount: Number(d.amount), type: d.type, note: d.note || "", date: d.date });

export default function RiderApp() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("riders");
  const [riders, setRiders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      setLoaded(false);
      try {
        const client = sb(session);
        const [r, d, de] = await Promise.all([
          client.list("riders", "&order=name.asc"),
          client.list("deliveries"),
          client.list("deductions"),
        ]);
        setRiders(r.map(riderFromDb));
        setDeliveries(d.map(deliveryFromDb));
        setDeductions(de.map(deductionFromDb));
      } catch (e) {
        showToast("Could not load data: " + e.message);
      }
      setLoaded(true);
    })();
  }, [session]);

  if (!session) {
    return <LoginScreen onSignedIn={setSession} />;
  }

  return (
    <div style={{ fontFamily: "var(--font-sans, system-ui)", maxWidth: 960, margin: "0 auto", color: "#1c1c1a" }}>
      <div style={{ background: "#14201c", color: "#f4f1ea", borderRadius: 12, padding: "20px 24px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, width: 140, height: 140, borderRadius: "50%", background: "rgba(244,196,26,0.08)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#f4c41a", fontWeight: 500 }}>New Jamuna Express</div>
            <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>Rider & Salary System</div>
            <div style={{ fontSize: 13, color: "#c9c6bb", marginTop: 4 }}>Signed in as {session.user?.email}</div>
          </div>
          <button
            onClick={() => { setSession(null); window.location.reload(); }}
            style={{ background: "transparent", border: "1px solid rgba(244,241,234,0.4)", color: "#f4f1ea", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Log out
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #e4e1d8" }}>
        {[
          ["riders", "Riders"],
          ["details", "Rider Details"],
          ["entry", "Daily entry"],
          ["salary", "Salary & export"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              borderBottom: tab === key ? "2px solid #14201c" : "2px solid transparent",
              fontWeight: tab === key ? 500 : 400,
              color: tab === key ? "#14201c" : "#6b6a63",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8a8880" }}>Loading…</div>
      ) : tab === "riders" ? (
        <RidersTab session={session} riders={riders} setRiders={setRiders} showToast={showToast} />
      ) : tab === "details" ? (
        <RiderDetailsTab riders={riders} deliveries={deliveries} deductions={deductions} />
      ) : tab === "entry" ? (
        <EntryTab session={session} riders={riders} deliveries={deliveries} setDeliveries={setDeliveries} showToast={showToast} />
      ) : (
        <SalaryTab session={session} riders={riders} deliveries={deliveries} deductions={deductions} setDeductions={setDeductions} showToast={showToast} />
      )}

      {toast && (
        <div style={{ position: "sticky", bottom: 12, marginTop: 16, background: "#14201c", color: "#f4f1ea", padding: "10px 16px", borderRadius: 8, fontSize: 13, textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    setBusy(true);
    try {
      const data = await signIn(email.trim(), password);
      onSignedIn(data);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 380, margin: "60px auto", fontFamily: "var(--font-sans, system-ui)" }}>
      <div style={{ background: "#14201c", color: "#f4f1ea", borderRadius: 12, padding: "20px 24px", marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#f4c41a", fontWeight: 500 }}>New Jamuna Express</div>
        <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>Staff Login</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e4e1d8", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: "#6b6a63" }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #d8d5ca", fontSize: 14 }}
        />
        <label style={{ fontSize: 12, color: "#6b6a63" }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #d8d5ca", fontSize: 14 }}
        />
        {error && <div style={{ color: "#a32d2d", fontSize: 12 }}>{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={busy}
          style={{ marginTop: 6, background: "#14201c", color: "#f4f1ea", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
        >
          {busy ? "Signing in…" : "Log in"}
        </button>
        <div style={{ fontSize: 12, color: "#8a8880", marginTop: 4, textAlign: "center" }}>
          Ask the owner to create your account in Supabase if you don't have one yet.
        </div>
      </div>
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", border: "1px solid #e4e1d8", borderRadius: 12, padding: "16px 18px", ...style }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "default", ...rest }) {
  const base = {
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid #d8d5ca",
    background: "#fff",
    color: "#1c1c1a",
  };
  const primary = { background: "#14201c", color: "#f4f1ea", border: "1px solid #14201c" };
  return (
    <button onClick={onClick} style={variant === "primary" ? { ...base, ...primary } : base} {...rest}>
      {children}
    </button>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #d8d5ca",
        fontSize: 13,
        width: "100%",
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

function RidersTab({ session, riders, setRiders, showToast }) {
  const [form, setForm] = useState({ riderId: "", name: "", qid: "", phone: "", client: CLIENTS[0], rate: "", kmRate: "" });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const client = sb(session);

  function startEdit(r) {
    setEditingId(r.id);
    setEditForm({ riderId: r.riderId, name: r.name, qid: r.qid, phone: r.phone, client: r.client, rate: r.rate, kmRate: r.kmRate });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id) {
    if (!editForm.name.trim() || !editForm.rate || Number(editForm.rate) <= 0) {
      showToast("Enter a name and a rate above 0.");
      return;
    }
    const patch = {
      rider_id: editForm.riderId.trim(),
      name: editForm.name.trim(),
      qid: editForm.qid.trim(),
      phone: editForm.phone,
      client: editForm.client,
      rate: Number(editForm.rate),
      km_rate: Number(editForm.kmRate) || 0,
    };
    try {
      await client.update("riders", id, patch);
      setRiders((prev) => prev.map((r) => (r.id === id ? { ...r, riderId: patch.rider_id, name: patch.name, qid: patch.qid, phone: patch.phone, client: patch.client, rate: patch.rate, kmRate: patch.km_rate } : r)));
      setEditingId(null);
      setEditForm(null);
      showToast("Rider details updated");
    } catch (e) {
      showToast("Failed to update: " + e.message);
    }
  }

  async function addRider() {
    if (!form.name.trim() || !form.rate || Number(form.rate) <= 0) {
      setError("Enter a name and a rate above 0.");
      return;
    }
    setError("");
    const rider = {
      id: uid(),
      riderId: form.riderId.trim(),
      name: form.name.trim(),
      qid: form.qid.trim(),
      phone: form.phone,
      client: form.client,
      rate: Number(form.rate),
      kmRate: Number(form.kmRate) || 0,
      status: "active",
    };
    try {
      await client.insert("riders", riderToDb(rider));
      setRiders((prev) => [...prev, rider]);
      setForm({ riderId: "", name: "", qid: "", phone: "", client: CLIENTS[0], rate: "", kmRate: "" });
      showToast("Rider added");
    } catch (e) {
      showToast("Failed to add rider: " + e.message);
    }
  }

  async function toggleStatus(id) {
    const rider = riders.find((r) => r.id === id);
    const newStatus = rider.status === "active" ? "inactive" : "active";
    try {
      await client.update("riders", id, { status: newStatus });
      setRiders((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch (e) {
      showToast("Failed to update: " + e.message);
    }
  }

  async function removeRider(id) {
    try {
      await client.remove("riders", id);
      setRiders((prev) => prev.filter((r) => r.id !== id));
      showToast("Rider removed");
    } catch (e) {
      showToast("Failed to remove: " + e.message);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? riders.filter((r) =>
        [r.name, r.riderId, r.qid, r.phone, r.client].some((v) => (v || "").toLowerCase().includes(q))
      )
    : riders;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Add a rider</div>
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1fr", gap: 8, marginBottom: 8 }}>
          <Input placeholder="Rider ID" value={form.riderId} onChange={(e) => setForm({ ...form, riderId: e.target.value })} />
          <Input placeholder="Rider name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="QID number" value={form.qid} onChange={(e) => setForm({ ...form, qid: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr auto", gap: 8, alignItems: "start" }}>
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d8d5ca", fontSize: 13 }}>
            {CLIENTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input placeholder="Rate/order" type="number" step="0.05" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          <Input placeholder="Rate/extra km" type="number" step="0.05" value={form.kmRate} onChange={(e) => setForm({ ...form, kmRate: e.target.value })} />
          <Button variant="primary" onClick={addRider}>Add</Button>
        </div>
        {error && <div style={{ color: "#a32d2d", fontSize: 12, marginTop: 8 }}>{error}</div>}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Input placeholder="Search by name, rider ID, QID, phone, or client…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      <div style={{ fontSize: 13, color: "#6b6a63", marginBottom: 8 }}>
        {filtered.length} of {riders.length} riders shown
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((r) =>
          editingId === r.id ? (
            <Card key={r.id} style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Editing {r.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1fr", gap: 8, marginBottom: 8 }}>
                <Input placeholder="Rider ID" value={editForm.riderId} onChange={(e) => setEditForm({ ...editForm, riderId: e.target.value })} />
                <Input placeholder="Rider name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <Input placeholder="QID number" value={editForm.qid} onChange={(e) => setEditForm({ ...editForm, qid: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr auto auto", gap: 8 }}>
                <Input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                <select value={editForm.client} onChange={(e) => setEditForm({ ...editForm, client: e.target.value })} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d8d5ca", fontSize: 13 }}>
                  {CLIENTS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Input placeholder="Rate/order" type="number" step="0.05" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} />
                <Input placeholder="Rate/extra km" type="number" step="0.05" value={editForm.kmRate} onChange={(e) => setEditForm({ ...editForm, kmRate: e.target.value })} />
                <Button variant="primary" onClick={() => saveEdit(r.id)}>Save</Button>
                <Button onClick={cancelEdit}>Cancel</Button>
              </div>
            </Card>
          ) : (
          <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {r.name} {r.riderId && <span style={{ color: "#8a8880", fontWeight: 400 }}>· ID {r.riderId}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#6b6a63" }}>
                {r.client} · QR {fmt(r.rate)}/order{r.kmRate ? ` · QR ${fmt(r.kmRate)}/extra km` : ""} · {r.phone || "no phone"}{r.qid ? ` · QID ${r.qid}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 20, background: r.status === "active" ? "#eaf3de" : "#f1efe8", color: r.status === "active" ? "#3b6d11" : "#6b6a63" }}>
                {r.status}
              </span>
              <Button onClick={() => startEdit(r)}>Edit</Button>
              <Button onClick={() => toggleStatus(r.id)}>{r.status === "active" ? "Deactivate" : "Activate"}</Button>
              <Button onClick={() => removeRider(r.id)}>Remove</Button>
            </div>
          </Card>
          )
        )}
        {filtered.length === 0 && (
          <div style={{ color: "#8a8880", fontSize: 13, padding: 20, textAlign: "center" }}>
            {riders.length === 0 ? "No riders yet — add your first one above." : "No riders match that search."}
          </div>
        )}
      </div>
    </div>
  );
}

function RiderDetailsTab({ riders, deliveries, deductions }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? riders.filter((r) => [r.name, r.riderId, r.qid, r.phone, r.client].some((v) => (v || "").toLowerCase().includes(q)))
    : riders;

  const selected = riders.find((r) => r.id === selectedId);

  if (selected) {
    const allDeliveries = deliveries.filter((d) => d.riderId === selected.id);
    const totalOrders = allDeliveries.reduce((sum, d) => sum + (Number(d.count) || 0), 0);
    const totalKm = allDeliveries.reduce((sum, d) => sum + (Number(d.km) || 0), 0);
    const allDeductions = deductions.filter((x) => x.riderId === selected.id);
    const totalDed = allDeductions.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const grossToDate = totalOrders * selected.rate + totalKm * (selected.kmRate || 0);

    return (
      <div>
        <Button onClick={() => setSelectedId(null)} style={{ marginBottom: 12 }}>← Back to all riders</Button>
        <Card>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: "#6b6a63", marginBottom: 16 }}>
            <span style={{ padding: "3px 9px", borderRadius: 20, background: selected.status === "active" ? "#eaf3de" : "#f1efe8", color: selected.status === "active" ? "#3b6d11" : "#6b6a63", fontSize: 12, marginRight: 8 }}>
              {selected.status}
            </span>
            {selected.client}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13, marginBottom: 20 }}>
            <div><b>Rider ID:</b> {selected.riderId || "-"}</div>
            <div><b>QID Number:</b> {selected.qid || "-"}</div>
            <div><b>Phone:</b> {selected.phone || "-"}</div>
            <div><b>Client:</b> {selected.client}</div>
            <div><b>Rate per order:</b> QR {fmt(selected.rate)}</div>
            <div><b>Rate per extra km:</b> QR {fmt(selected.kmRate || 0)}</div>
          </div>

          <div style={{ borderTop: "1px solid #eeece4", paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>All-time summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
              <div><b>Total orders logged:</b> {totalOrders}</div>
              <div><b>Total extra km logged:</b> {totalKm}</div>
              <div><b>Total gross earned:</b> QR {fmt(grossToDate)}</div>
              <div><b>Total deductions:</b> QR {fmt(totalDed)}</div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Input placeholder="Search by name, rider ID, QID, phone, or client…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((r) => (
          <Card key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer" }} onClick={() => setSelectedId(r.id)}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {r.name} {r.riderId && <span style={{ color: "#8a8880", fontWeight: 400 }}>· ID {r.riderId}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#6b6a63" }}>{r.client} · {r.phone || "no phone"}</div>
            </div>
            <span style={{ fontSize: 12, color: "#8a8880" }}>View details →</span>
          </Card>
        ))}
        {filtered.length === 0 && <div style={{ color: "#8a8880", fontSize: 13, padding: 20, textAlign: "center" }}>No riders match that search.</div>}
      </div>
    </div>
  );
}

function EntryTab({ session, riders, deliveries, setDeliveries, showToast }) {
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const client = sb(session);
  const activeAll = riders.filter((r) => r.status === "active");
  const q = search.trim().toLowerCase();
  const active = q
    ? activeAll.filter((r) => [r.name, r.riderId, r.qid, r.phone, r.client].some((v) => (v || "").toLowerCase().includes(q)))
    : activeAll;

  const [drafts, setDrafts] = useState({});
  const [locked, setLocked] = useState({});

  useEffect(() => {
    const newDrafts = {};
    const newLocked = {};
    riders.forEach((r) => {
      const row = deliveries.find((d) => d.riderId === r.id && d.date === date);
      newDrafts[r.id] = { count: row && row.count !== "" ? row.count : "", km: row && row.km !== "" ? row.km : "" };
      newLocked[r.id] = !!row;
    });
    setDrafts(newDrafts);
    setLocked(newLocked);
  }, [date, deliveries, riders]);

  function updateDraft(riderId, field, value) {
    const num = value === "" ? "" : Math.max(0, Number(value));
    setDrafts((prev) => ({ ...prev, [riderId]: { ...prev[riderId], [field]: num } }));
  }

  async function saveRow(riderId) {
    const draft = drafts[riderId] || { count: "", km: "" };
    const existing = deliveries.find((d) => d.riderId === riderId && d.date === date);
    try {
      if (existing) {
        await client.update("deliveries", existing.id, {
          count: draft.count === "" ? null : draft.count,
          km: draft.km === "" ? null : draft.km,
        });
        setDeliveries((prev) => prev.map((d) => (d.id === existing.id ? { ...d, count: draft.count, km: draft.km } : d)));
      } else {
        const newId = uid();
        await client.insert("deliveries", {
          id: newId,
          rider_id: riderId,
          date,
          count: draft.count === "" ? null : draft.count,
          km: draft.km === "" ? null : draft.km,
        });
        setDeliveries((prev) => [...prev, { id: newId, riderId, date, count: draft.count, km: draft.km }]);
      }
      setLocked((prev) => ({ ...prev, [riderId]: true }));
      showToast("Entry saved");
    } catch (e) {
      showToast("Failed to save entry: " + e.message);
    }
  }

  function unlockRow(riderId) {
    setLocked((prev) => ({ ...prev, [riderId]: false }));
  }

  return (
    <div>
      <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#6b6a63" }}>Entry date</div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 180 }} />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Input placeholder="Search by name, rider ID, QID, phone, or client…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {CLIENTS.map((client_) => {
        const clientRiders = active.filter((r) => r.client === client_);
        if (clientRiders.length === 0) return null;
        return (
          <div key={client_} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#6b6a63", marginBottom: 6 }}>{client_}</div>
            <Card style={{ padding: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #eeece4", fontSize: 11, color: "#8a8880", textTransform: "uppercase", letterSpacing: 0.5 }}>
                <div>Rider</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 90, textAlign: "right" }}>Orders</div>
                  <div style={{ width: 90, textAlign: "right" }}>Extra km</div>
                  <div style={{ width: 70 }}></div>
                </div>
              </div>
              {clientRiders.map((r, i) => {
                const draft = drafts[r.id] || { count: "", km: "" };
                const isLocked = !!locked[r.id];
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #eeece4" }}>
                    <div style={{ fontSize: 14 }}>{r.name}</div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={draft.count}
                        disabled={isLocked}
                        onChange={(e) => updateDraft(r.id, "count", e.target.value)}
                        style={{ width: 90, textAlign: "right", background: isLocked ? "#f4f2ec" : "#fff", color: isLocked ? "#6b6a63" : "#1c1c1a" }}
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={draft.km}
                        disabled={isLocked}
                        onChange={(e) => updateDraft(r.id, "km", e.target.value)}
                        style={{ width: 90, textAlign: "right", background: isLocked ? "#f4f2ec" : "#fff", color: isLocked ? "#6b6a63" : "#1c1c1a" }}
                      />
                      <div style={{ width: 70 }}>
                        {isLocked ? (
                          <Button onClick={() => unlockRow(r.id)}>Edit</Button>
                        ) : (
                          <Button variant="primary" onClick={() => saveRow(r.id)}>Save</Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}
      {active.length === 0 && <div style={{ color: "#8a8880", fontSize: 13, padding: 20, textAlign: "center" }}>No active riders match.</div>}
    </div>
  );
}

function SalaryTab({ session, riders, deliveries, deductions, setDeductions, showToast }) {
  const client = sb(session);
  const months = Array.from(new Set(deliveries.map((d) => monthKey(d.date)))).sort().reverse();
  const currentMonth = monthKey(todayISO());
  const [month, setMonth] = useState(months[0] || currentMonth);
  const [dedForm, setDedForm] = useState({ riderId: "", amount: "", type: DEDUCTION_TYPES[0], note: "" });

  useEffect(() => {
    if (months.length && !months.includes(month)) setMonth(months[0]);
  }, [months]); // eslint-disable-line

  function riderSummary(riderId) {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider) return null;
    const monthDeliveries = deliveries.filter((d) => d.riderId === riderId && monthKey(d.date) === month);
    const totalOrders = monthDeliveries.reduce((sum, d) => sum + (Number(d.count) || 0), 0);
    const totalKm = monthDeliveries.reduce((sum, d) => sum + (Number(d.km) || 0), 0);
    const gross = totalOrders * rider.rate + totalKm * (rider.kmRate || 0);
    const monthDeductions = deductions.filter((x) => x.riderId === riderId && monthKey(x.date) === month);
    const totalDed = monthDeductions.reduce((sum, x) => sum + Number(x.amount || 0), 0);
    return { rider, totalOrders, totalKm, gross, totalDed, net: gross - totalDed, monthDeductions };
  }

  const summaries = riders.map((r) => riderSummary(r.id)).filter(Boolean);

  async function addDeduction() {
    if (!dedForm.riderId || !dedForm.amount) {
      showToast("Pick a rider and enter an amount");
      return;
    }
    const row = { id: uid(), riderId: dedForm.riderId, amount: Number(dedForm.amount), type: dedForm.type, note: dedForm.note, date: `${month}-15` };
    try {
      await client.insert("deductions", { id: row.id, rider_id: row.riderId, amount: row.amount, type: row.type, note: row.note, date: row.date });
      setDeductions((prev) => [...prev, row]);
      setDedForm({ riderId: "", amount: "", type: DEDUCTION_TYPES[0], note: "" });
      showToast("Deduction added");
    } catch (e) {
      showToast("Failed to add deduction: " + e.message);
    }
  }

  function exportIndividual(summary) {
    const dedByType = {};
    DEDUCTION_TYPES.forEach((t) => { dedByType[t] = 0; });
    summary.monthDeductions.forEach((d) => {
      const key = DEDUCTION_TYPES.includes(d.type) ? d.type : "Other";
      dedByType[key] += Number(d.amount || 0);
    });

    const td = (v, extra = "") => `<td style="border:1px solid #333;padding:6px 10px;font-size:13px;${extra}">${v}</td>`;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Salary Slip</title></head>
      <body style="font-family:Calibri, Arial, sans-serif;">
        <h2 style="text-align:center;color:#3d2a7a;text-decoration:underline;">NEW JAMUNA EXPRESS DELIVERY SERVICES</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
          <tr>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:10px;width:60%;">SALARY PAYSLIP</td>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:10px;">Rider Id No.: ${summary.rider.riderId || "-"}</td>
          </tr>
          <tr>
            <td style="border:1px solid #333;padding:8px;font-size:13px;">
              <b>Employee Name:</b> ${summary.rider.name}<br/>
              <b>Qid Number:</b> ${summary.rider.qid || "-"}<br/>
              <b>Contact Number:</b> ${summary.rider.phone || "-"}
            </td>
            <td style="border:1px solid #333;padding:8px;font-size:13px;">
              <b>Designation:</b> Rider<br/>
              <b>Month of:</b> ${monthLabel(month)}<br/>
              <b>Currency:</b> Qatari Riyal
            </td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:8px;">Description</td>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:8px;">Earnings</td>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:8px;">Particular</td>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:8px;">Deduction</td>
          </tr>
          <tr>${td("Rate Per Order")}${td(fmt(summary.rider.rate), "text-align:right;")}${td(DEDUCTION_TYPES[0])}${td(dedByType[DEDUCTION_TYPES[0]] ? fmt(dedByType[DEDUCTION_TYPES[0]]) : "-", "text-align:right;")}</tr>
          <tr>${td("Total Order")}${td(summary.totalOrders, "text-align:right;")}${td(DEDUCTION_TYPES[1])}${td(dedByType[DEDUCTION_TYPES[1]] ? fmt(dedByType[DEDUCTION_TYPES[1]]) : "-", "text-align:right;")}</tr>
          <tr>${td("Extra Kilo Meter")}${td(summary.totalKm, "text-align:right;")}${td(DEDUCTION_TYPES[2])}${td(dedByType[DEDUCTION_TYPES[2]] ? fmt(dedByType[DEDUCTION_TYPES[2]]) : "-", "text-align:right;")}</tr>
          <tr>${td("Rate Per Extra Km")}${td(fmt(summary.rider.kmRate || 0), "text-align:right;")}${td(DEDUCTION_TYPES[3])}${td(dedByType[DEDUCTION_TYPES[3]] ? fmt(dedByType[DEDUCTION_TYPES[3]]) : "-", "text-align:right;")}</tr>
          <tr>${td("")}${td("")}${td(DEDUCTION_TYPES[4])}${td(dedByType[DEDUCTION_TYPES[4]] ? fmt(dedByType[DEDUCTION_TYPES[4]]) : "-", "text-align:right;")}</tr>
          <tr>${td("")}${td("")}${td(DEDUCTION_TYPES[5])}${td(dedByType[DEDUCTION_TYPES[5]] ? fmt(dedByType[DEDUCTION_TYPES[5]]) : "-", "text-align:right;")}</tr>
          <tr>${td("")}${td("")}${td(DEDUCTION_TYPES[6])}${td(dedByType[DEDUCTION_TYPES[6]] ? fmt(dedByType[DEDUCTION_TYPES[6]]) : "-", "text-align:right;")}</tr>
          <tr>${td("")}${td("")}${td(DEDUCTION_TYPES[7])}${td(dedByType[DEDUCTION_TYPES[7]] ? fmt(dedByType[DEDUCTION_TYPES[7]]) : "-", "text-align:right;")}</tr>
          <tr>
            <td style="border:1px solid #333;font-weight:bold;padding:8px;text-align:center;">Total</td>
            <td style="border:1px solid #333;font-weight:bold;padding:8px;text-align:right;">QAR ${fmt(summary.gross)}</td>
            <td style="border:1px solid #333;"></td>
            <td style="border:1px solid #333;font-weight:bold;padding:8px;text-align:right;">QAR ${fmt(summary.totalDed)}</td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr>
            <td style="border:1px solid #333;padding:8px;font-size:13px;width:60%;">
              <b>Payment Date:</b> ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}<br/>
              <b>Name:</b> ${summary.rider.name}<br/>
              <b>Payment By:</b> Cash
            </td>
            <td style="border:1px solid #333;background:#29ABE2;color:#fff;text-align:center;font-weight:bold;padding:8px;vertical-align:middle;">
              Net Pay<br/><span style="font-size:16px;">QAR ${fmt(summary.net)}</span>
            </td>
          </tr>
        </table>

        <p style="color:#c0392b;font-size:12px;margin-top:14px;">
          Warning: We will give disciplinary action to the irresponsible rider who will not clean properly their motorbike. (Penalty 100 Qatari Riyal.)
        </p>

        <div style="margin-top:50px;display:flex;justify-content:space-between;font-size:13px;">
          <div style="border-top:1px solid #333;padding-top:4px;width:220px;">Manager / New Jamuna Express Delivery Services</div>
          <div style="border-top:1px solid #333;padding-top:4px;width:220px;text-align:center;">${summary.rider.name}<br/>Employee / Rider</div>
        </div>
      </body>
      </html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${summary.rider.name.replace(/\s+/g, "_")}_${month}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded salary slip");
  }

  function exportSummary() {
    const wb = XLSX.utils.book_new();
    const header = ["Rider ID", "Rider", "Client", "Orders", "Extra km", "Rate/order", "Rate/km", "Gross (QR)", "Deductions (QR)", "Net pay (QR)"];
    const rows = summaries.map((s) => [
      s.rider.riderId || "-",
      s.rider.name,
      s.rider.client,
      s.totalOrders,
      s.totalKm,
      s.rider.rate,
      s.rider.kmRate || 0,
      Number(s.gross.toFixed(2)),
      Number(s.totalDed.toFixed(2)),
      Number(s.net.toFixed(2)),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([[`Payroll summary — ${monthLabel(month)}`], [], header, ...rows]);
    ws["!cols"] = header.map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, ws, "Payroll summary");
    XLSX.writeFile(wb, `Payroll_summary_${month}.xlsx`);
    showToast("Downloaded payroll summary");
  }

  return (
    <div>
      <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "#6b6a63" }}>Month</div>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160 }} />
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" onClick={exportSummary}>Export payroll summary (.xlsx)</Button>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Add a deduction / advance</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 1fr 1.3fr auto", gap: 8 }}>
          <select value={dedForm.riderId} onChange={(e) => setDedForm({ ...dedForm, riderId: e.target.value })} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d8d5ca", fontSize: 13 }}>
            <option value="">Select rider</option>
            {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={dedForm.type} onChange={(e) => setDedForm({ ...dedForm, type: e.target.value })} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d8d5ca", fontSize: 13 }}>
            {DEDUCTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input type="number" placeholder="Amount (QR)" value={dedForm.amount} onChange={(e) => setDedForm({ ...dedForm, amount: e.target.value })} />
          <Input placeholder="Note (optional)" value={dedForm.note} onChange={(e) => setDedForm({ ...dedForm, note: e.target.value })} />
          <Button variant="primary" onClick={addDeduction}>Add</Button>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {summaries.map((s) => (
          <Card key={s.rider.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                {s.rider.name} {s.rider.riderId && <span style={{ color: "#8a8880", fontWeight: 400 }}>· ID {s.rider.riderId}</span>}
              </div>
              <div style={{ fontSize: 12, color: "#6b6a63" }}>
                {s.totalOrders} orders{s.totalKm ? ` · ${s.totalKm} extra km` : ""} · gross QR {fmt(s.gross)} · deductions QR {fmt(s.totalDed)}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>QR {fmt(s.net)}</div>
              <Button onClick={() => exportIndividual(s)}>Download slip</Button>
            </div>
          </Card>
        ))}
        {summaries.length === 0 && <div style={{ color: "#8a8880", fontSize: 13, padding: 20, textAlign: "center" }}>No riders to show.</div>}
      </div>
    </div>
  );
}
