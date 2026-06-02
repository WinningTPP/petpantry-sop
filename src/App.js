import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// REPLACE THIS with your Google Apps Script Web App URL after deployment
const SHEET_URL = process.env.REACT_APP_SHEET_URL || "YOUR_APPS_SCRIPT_URL_HERE";

const GREEN = "#004225";
const GOLD = "#C1A366";
const CREAM = "#FAF7F2";
const LIGHT = "#F0EBE1";
const RED = "#C0392B";

const todayIST = () => {
  return new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
};

const nowIST = () => {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const storageKey = (role) => `pp_sop_${role}_${todayIST()}`;
const leftoversKey = () => `pp_leftovers_${todayIST()}`;
const dispatchKey = () => `pp_dispatch_${todayIST()}`;

// ─── LOG TO GOOGLE SHEETS ─────────────────────────────────────────────────────
async function logToSheet(payload) {
  if (!SHEET_URL || SHEET_URL === "YOUR_APPS_SCRIPT_URL_HERE") return;
  try {
    await fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("Sheet log failed:", e);
  }
}

// ─── CHECKLIST DATA ───────────────────────────────────────────────────────────
const COOK_SECTIONS = [
  {
    id: "hygiene",
    time: "5:00 AM",
    title: "Personal Hygiene",
    titleHi: "व्यक्तिगत स्वच्छता",
    icon: "🧼",
    items: [
      { id: "h1", en: "Hands washed with soap for minimum 30 seconds", hi: "कम से कम 30 सेकंड के लिए साबुन से हाथ धोएं" },
      { id: "h2", en: "Clean clothes worn", hi: "साफ कपड़े पहने हैं" },
      { id: "h3", en: "Showered today?", hi: "आज नहाए?" },
      { id: "h4", en: "Nails trimmed and clean?", hi: "नाखून छोटे और साफ हैं?" },
    ],
  },
  {
    id: "kitchen_check",
    time: "5:05 AM",
    title: "Kitchen Readiness Check",
    titleHi: "किचन तैयारी जाँच",
    icon: "🔍",
    items: [
      { id: "k1", en: "Kitchen surfaces wiped and sanitised", hi: "किचन की सतहें पोंछी और सैनिटाइज़ की गई हैं" },
      { id: "k2", en: "Cooking utensils cleaned and rinsed", hi: "खाना पकाने के बर्तन साफ और धुले हैं" },
      { id: "k3", en: "Weighing scale zeroed and clean", hi: "तराजू शून्य और साफ है" },
      { id: "k4", en: "AC room set to 16°C for cooling post-cook", hi: "कूलिंग के लिए AC रूम 16°C पर सेट किया गया" },
      { id: "k5", en: "Order list / packing list received and reviewed", hi: "ऑर्डर लिस्ट / पैकिंग लिस्ट मिली और समीक्षा की गई" },
    ],
  },
  {
    id: "cooking",
    time: "5:20 AM",
    title: "Cooking",
    titleHi: "खाना पकाना",
    icon: "🍳",
    items: [
      { id: "c1", en: "Vegetables boiled and mashed", hi: "सब्जियाँ उबाली और मैश की गईं" },
      { id: "c2", en: "Chicken, Mutton, Fish, Kaala piece (organs) pulled from freezer/fridge — check smell and colour (discard if off)", hi: "चिकन, मटन, मछली, काला पीस (अंग) फ्रीजर/फ्रिज से निकालें — गंध और रंग जाँचें (खराब हो तो फेंकें)" },
      { id: "c3", en: "Chicken dog recipe, mutton dog recipe and chicken cat recipe cooked first — fully cooked through (no pink)", hi: "चिकन डॉग रेसिपी, मटन डॉग रेसिपी और चिकन कैट रेसिपी पहले पकाएं — पूरी तरह पका हो (गुलाबी न हो)" },
      { id: "c4", en: "Boil separately: chicken, mutton, fish, kaala piece, egg — discard the water", hi: "अलग-अलग उबालें: चिकन, मटन, मछली, काला पीस, अंडा — पानी फेंक दें" },
    ],
  },
  {
    id: "portioning",
    time: "6:00 AM",
    title: "Portioning & Cooling",
    titleHi: "हिस्से बाँटना और ठंडा करना",
    icon: "⚖️",
    items: [
      { id: "p1", en: "Start cooling the recipes before adding supplements", hi: "सप्लीमेंट डालने से पहले रेसिपी ठंडी करना शुरू करें" },
      { id: "p2", en: "Once cooled, weigh and add supplements as per batch", hi: "ठंडा होने पर बैच के अनुसार तौलें और सप्लीमेंट मिलाएं" },
      { id: "p3", en: "Minimum 20 minutes cooling before packing", hi: "पैकिंग से पहले कम से कम 20 मिनट ठंडा करें" },
      { id: "p4", en: "Food touched to check — should feel cold to touch before packing", hi: "छूकर जाँचें — पैकिंग से पहले ठंडा महसूस होना चाहिए" },
    ],
  },
  {
    id: "kitchen_close",
    time: "7:45 AM",
    title: "Kitchen Cleaning",
    titleHi: "किचन सफाई",
    icon: "🔒",
    items: [
      { id: "kc1", en: "Vegetable, fish and meat check — all unused raw ingredients sealed and stored in freezer", hi: "सब्जी, मछली और मांस जाँच — सभी अप्रयुक्त कच्ची सामग्री सील करके फ्रीजर में रखें" },
      { id: "kc2", en: "Leftover ingredient log filled (name, quantity, date, freezer/discard)", hi: "बची सामग्री का लॉग भरें (नाम, मात्रा, तारीख, फ्रीजर/फेंकें)" },
      { id: "kc3", en: "Cooking utensils washed and air-dried", hi: "खाना पकाने के बर्तन धोएं और हवा में सुखाएं" },
      { id: "kc4", en: "All surfaces wiped down and sanitised", hi: "सभी सतहें पोंछें और सैनिटाइज़ करें" },
      { id: "kc5", en: "Gas / burners turned off and checked", hi: "गैस / बर्नर बंद किए और जाँचे" },
      { id: "kc6", en: "Leftover food set aside for strays", hi: "बचा हुआ खाना आवारा जानवरों के लिए अलग रखें" },
    ],
  },
];

const PACKER_SECTIONS = [
  {
    id: "packing_prep",
    time: "5:00 AM",
    title: "Packing Station Setup",
    titleHi: "पैकिंग स्टेशन की तैयारी",
    icon: "📦",
    items: [
      { id: "pp1", en: "Order list / packing list reviewed carefully", hi: "ऑर्डर लिस्ट / पैकिंग लिस्ट ध्यान से पढ़ें" },
      { id: "pp2", en: "Correct number of plastic / SS containers counted out", hi: "सही संख्या में प्लास्टिक / SS के डिब्बे गिनें" },
      { id: "pp3", en: "Containers wiped clean before use", hi: "उपयोग से पहले डिब्बे पोंछें" },
      { id: "pp4", en: "Complete labelling of containers (full building name and recipe name)", hi: "डिब्बों पर पूरा लेबल लगाएं (पूरा बिल्डिंग नाम और रेसिपी नाम)" },
      { id: "pp5", en: "Trial stickers put on containers for trial orders", hi: "ट्रायल ऑर्डर के डिब्बों पर ट्रायल स्टिकर लगाएं" },
      { id: "pp6", en: "Insulated bags to be pre-chilled in AC room", hi: "इंसुलेटेड बैग AC रूम में पहले से ठंडे करें" },
      { id: "pp7", en: "Stainless steel containers checked for matching order", hi: "स्टेनलेस स्टील के डिब्बे ऑर्डर से मिलान करके जाँचें" },
      { id: "pp8", en: "Containers sealed properly — no loose lids", hi: "डिब्बे ठीक से बंद हैं — कोई ढीला ढक्कन नहीं" },
      { id: "pp9", en: "All containers for one order grouped together", hi: "एक ऑर्डर के सभी डिब्बे एक साथ रखें" },
    ],
  },
  {
    id: "bag_packing",
    time: "6:30 AM",
    title: "Insulated Bag Packing & Dispatch",
    titleHi: "इंसुलेटेड बैग पैकिंग और डिस्पैच",
    icon: "🧊",
    items: [
      { id: "b1", en: "Ice cartridges placed at bottom of bag", hi: "बैग के नीचे बर्फ कारतूस रखें" },
      { id: "b2", en: "Bag sealed tightly — no gap at zip or flap", hi: "बैग कसकर बंद करें — ज़िप या फ्लैप में कोई गैप नहीं" },
      { id: "b3", en: "Rider name / route written on bag for correct handoff", hi: "सही डिलीवरी के लिए बैग पर राइडर का नाम / रूट लिखें" },
      { id: "b4", en: "Porter / Dunzo orders booked and tracking shared", hi: "पोर्टर / डंज़ो ऑर्डर बुक किए और ट्रैकिंग शेयर की" },
      { id: "b5", en: "Rider departure time noted for each delivery route", hi: "प्रत्येक डिलीवरी रूट के लिए राइडर के प्रस्थान का समय नोट करें" },
      { id: "b6", en: "Any missing or incorrect order flagged to supervisor immediately", hi: "कोई भी गुम या गलत ऑर्डर तुरंत सुपरवाइज़र को बताएं" },
    ],
  },
  {
    id: "packer_close",
    time: "7:55 AM",
    title: "Packing Station Close",
    titleHi: "पैकिंग स्टेशन बंद करना",
    icon: "✅",
    items: [
      { id: "pc1", en: "All containers accounted for — none left unassigned", hi: "सभी डिब्बों का हिसाब — कोई भी बिना असाइन किए नहीं" },
      { id: "pc2", en: "Packing area cleaned and wiped down", hi: "पैकिंग क्षेत्र साफ और पोंछा गया" },
      { id: "pc3", en: "Empty insulated bags / ice cartridges stored properly", hi: "खाली इंसुलेटेड बैग / बर्फ कारतूस ठीक से रखें" },
      { id: "pc4", en: "Dispatch log filled — all orders confirmed out", hi: "डिस्पैच लॉग भरें — सभी ऑर्डर की पुष्टि बाहर भेजी" },
    ],
  },
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function CheckItem({ item, checked, onToggle, bilingual }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "10px 14px", borderRadius: 8, marginBottom: 6, cursor: "pointer",
        background: checked ? `${GREEN}12` : "white",
        border: `1.5px solid ${checked ? GREEN : "#E0D8CC"}`,
        transition: "all 0.2s ease",
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        border: `2px solid ${checked ? GREEN : "#BFBFBF"}`,
        background: checked ? GREEN : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 1, transition: "all 0.2s ease",
      }}>
        {checked && <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>✓</span>}
      </div>
      <div>
        <div style={{
          fontSize: 13.5, color: checked ? GREEN : "#2C2C2C",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          textDecoration: checked ? "line-through" : "none",
          opacity: checked ? 0.7 : 1,
        }}>{item.en}</div>
        {bilingual && (
          <div style={{ fontSize: 12, color: "#888", fontFamily: "'Noto Sans Devanagari', sans-serif", marginTop: 2 }}>
            {item.hi}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ section, checks, onToggle, bilingual }) {
  const total = section.items.length;
  const done = section.items.filter(i => checks[i.id]).length;
  const allDone = done === total;

  return (
    <div style={{
      marginBottom: 20, borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${allDone ? GREEN : "#E0D8CC"}`, background: CREAM,
    }}>
      <div style={{
        background: allDone ? GREEN : "#F5F0E8", padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{section.icon}</span>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, fontWeight: 600, color: allDone ? "white" : GREEN }}>
              {section.title}
            </div>
            {bilingual && (
              <div style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 11, color: allDone ? "rgba(255,255,255,0.8)" : GOLD }}>
                {section.titleHi}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: allDone ? "rgba(255,255,255,0.9)" : "#888", fontFamily: "'DM Sans', sans-serif" }}>
            {section.time}
          </span>
          <span style={{
            background: allDone ? "rgba(255,255,255,0.2)" : GREEN,
            color: "white", borderRadius: 20, padding: "2px 10px",
            fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
          }}>{done}/{total}</span>
        </div>
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        {section.items.map(item => (
          <CheckItem key={item.id} item={item} checked={!!checks[item.id]} onToggle={() => onToggle(item.id, section.title)} bilingual={bilingual} />
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ sections, checks }) {
  const total = sections.reduce((s, sec) => s + sec.items.length, 0);
  const done = sections.reduce((s, sec) => s + sec.items.filter(i => checks[i.id]).length, 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#555" }}>{done} of {total} tasks complete</span>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14, color: GREEN, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: "#E0D8CC", borderRadius: 10, height: 8, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: pct === 100 ? GREEN : GOLD,
          borderRadius: 10, transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function LeftoverLog({ bilingual, role }) {
  const key = leftoversKey();
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState({ type: "ingredient", name: "", qty: "", unit: "g", disposition: "freezer", notes: "" });

  const save = (updated) => {
    setEntries(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const add = async () => {
    if (!form.name || !form.qty) return;
    const entry = { ...form, id: Date.now(), time: nowIST(), date: todayIST() };
    save([...entries, entry]);
    setForm({ type: "ingredient", name: "", qty: "", unit: "g", disposition: "freezer", notes: "" });
    await logToSheet({
      sheet: "Leftover Log",
      date: entry.date,
      time: entry.time,
      role,
      type: entry.type,
      name: entry.name,
      qty: entry.qty,
      unit: entry.unit,
      disposition: entry.disposition,
      notes: entry.notes,
    });
  };

  const remove = (id) => save(entries.filter(e => e.id !== id));

  const inputStyle = {
    border: `1.5px solid #D0C8BC`, borderRadius: 7, padding: "7px 10px",
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, background: "white", color: "#2C2C2C", outline: "none",
  };

  return (
    <div style={{ padding: "0 0 20px" }}>
      <div style={{ background: GREEN, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "white" }}>📋 Leftover Log — {todayIST()}</div>
        {bilingual && <div style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 11, color: GOLD, marginTop: 2 }}>बचे हुए का लॉग</div>}
      </div>
      <div style={{ background: CREAM, borderRadius: 12, border: `1.5px solid #E0D8CC`, padding: 14, marginBottom: 14 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: GREEN, marginBottom: 10 }}>+ Add Entry</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, disposition: e.target.value === "ingredient" ? "freezer" : "strays" })} style={inputStyle}>
            <option value="ingredient">Raw Ingredient / कच्ची सामग्री</option>
            <option value="cooked">Cooked Food / पका खाना</option>
          </select>
          <select value={form.disposition} onChange={e => setForm({ ...form, disposition: e.target.value })} style={inputStyle}>
            {form.type === "ingredient"
              ? <><option value="freezer">Freezer / फ्रीजर</option><option value="discard">Discard / फेंकें</option></>
              : <><option value="strays">Fed to Strays / आवारा को</option><option value="discard">Discard / फेंकें</option></>
            }
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input placeholder="Name / नाम" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input placeholder="Qty" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} style={inputStyle} type="number" />
          <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={inputStyle}>
            <option value="g">g</option><option value="kg">kg</option><option value="pieces">pcs</option><option value="ml">ml</option>
          </select>
        </div>
        <input placeholder="Notes / नोट्स (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        <button onClick={add} style={{ background: GREEN, color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", width: "100%" }}>
          Add to Log / लॉग में जोड़ें
        </button>
      </div>
      {entries.length === 0
        ? <div style={{ textAlign: "center", color: "#AAA", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: 20 }}>No entries yet</div>
        : entries.map(e => (
          <div key={e.id} style={{ background: "white", border: `1.5px solid #E0D8CC`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ background: e.type === "ingredient" ? GOLD : RED, color: "white", borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginRight: 8, textTransform: "uppercase" }}>
                {e.type === "ingredient" ? "Ingredient" : "Cooked"}
              </span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#2C2C2C" }}>{e.name}</span>
              <span style={{ color: "#777", fontSize: 13, marginLeft: 6 }}>{e.qty} {e.unit}</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: e.disposition === "strays" ? GREEN : e.disposition === "freezer" ? "#2471A3" : RED, fontWeight: 600 }}>
                → {e.disposition === "strays" ? "Fed to strays" : e.disposition === "freezer" ? "Freezer" : "Discarded"}
              </span>
              {e.notes && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{e.notes}</div>}
              <div style={{ fontSize: 10, color: "#BBB", marginTop: 1 }}>{e.time}</div>
            </div>
            <button onClick={() => remove(e.id)} style={{ background: "none", border: "none", color: "#CCC", fontSize: 16, cursor: "pointer", padding: 4 }}>✕</button>
          </div>
        ))
      }
    </div>
  );
}

function DispatchLog({ bilingual, role }) {
  const key = dispatchKey();
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState({ customer: "", rider: "inhouse", orderId: "", dispatchTime: "", status: "dispatched", notes: "" });

  const save = (updated) => {
    setEntries(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const add = async () => {
    if (!form.customer) return;
    const entry = { ...form, id: Date.now(), loggedAt: nowIST(), date: todayIST() };
    save([...entries, entry]);
    setForm({ customer: "", rider: "inhouse", orderId: "", dispatchTime: "", status: "dispatched", notes: "" });
    await logToSheet({
      sheet: "Dispatch Log",
      date: entry.date,
      time: entry.loggedAt,
      role,
      customer: entry.customer,
      orderId: entry.orderId,
      rider: entry.rider,
      dispatchTime: entry.dispatchTime,
      status: entry.status,
      notes: entry.notes,
    });
  };

  const updateStatus = async (id, status) => {
    const updated = entries.map(e => e.id === id ? { ...e, status } : e);
    save(updated);
    const entry = updated.find(e => e.id === id);
    await logToSheet({
      sheet: "Dispatch Log",
      date: entry.date,
      time: nowIST(),
      role,
      customer: entry.customer,
      orderId: entry.orderId,
      rider: entry.rider,
      dispatchTime: entry.dispatchTime,
      status: `Updated → ${status}`,
      notes: entry.notes,
    });
  };

  const remove = (id) => save(entries.filter(e => e.id !== id));

  const inputStyle = {
    border: `1.5px solid #D0C8BC`, borderRadius: 7, padding: "7px 10px",
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, background: "white", color: "#2C2C2C", outline: "none",
  };

  return (
    <div style={{ padding: "0 0 20px" }}>
      <div style={{ background: GREEN, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "white" }}>🚴 Dispatch Log — {todayIST()}</div>
        {bilingual && <div style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 11, color: GOLD, marginTop: 2 }}>डिस्पैच लॉग</div>}
      </div>
      <div style={{ background: CREAM, borderRadius: 12, border: `1.5px solid #E0D8CC`, padding: 14, marginBottom: 14 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: GREEN, marginBottom: 10 }}>+ Add Dispatch</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input placeholder="Customer Name" value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} style={inputStyle} />
          <input placeholder="Order ID / Pet Name" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <select value={form.rider} onChange={e => setForm({ ...form, rider: e.target.value })} style={inputStyle}>
            <option value="inhouse">In-House Rider</option>
            <option value="porter">Porter</option>
            <option value="dunzo">Dunzo</option>
          </select>
          <input type="time" value={form.dispatchTime} onChange={e => setForm({ ...form, dispatchTime: e.target.value })} style={inputStyle} />
        </div>
        <input placeholder="Notes / नोट्स" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        <button onClick={add} style={{ background: GREEN, color: "white", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", width: "100%" }}>
          Log Dispatch / डिस्पैच लॉग करें
        </button>
      </div>
      {entries.length === 0
        ? <div style={{ textAlign: "center", color: "#AAA", fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: 20 }}>No dispatches logged yet</div>
        : entries.map(e => (
          <div key={e.id} style={{ background: "white", border: `1.5px solid #E0D8CC`, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#2C2C2C" }}>{e.customer}</span>
                {e.orderId && <span style={{ color: "#999", fontSize: 12, marginLeft: 6 }}>({e.orderId})</span>}
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: e.rider === "inhouse" ? GREEN : e.rider === "porter" ? "#884EA0" : "#E67E22" }}>
                  {e.rider === "inhouse" ? "In-House" : e.rider === "porter" ? "Porter" : "Dunzo"}
                </span>
                {e.dispatchTime && <span style={{ color: "#AAA", fontSize: 11, marginLeft: 8 }}>@ {e.dispatchTime}</span>}
                {e.notes && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{e.notes}</div>}
                <div style={{ fontSize: 10, color: "#BBB", marginTop: 1 }}>Logged {e.loggedAt}</div>
              </div>
              <button onClick={() => remove(e.id)} style={{ background: "none", border: "none", color: "#CCC", fontSize: 16, cursor: "pointer", padding: 4 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {["dispatched", "delivered", "issue"].map(s => (
                <button key={s} onClick={() => updateStatus(e.id, s)} style={{
                  flex: 1, border: "none", borderRadius: 6, padding: "5px 0", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  background: e.status === s ? (s === "delivered" ? GREEN : s === "issue" ? RED : GOLD) : "#F0EBE1",
                  color: e.status === s ? "white" : "#888",
                }}>
                  {s === "dispatched" ? "→ Out" : s === "delivered" ? "✓ Delivered" : "⚠ Issue"}
                </button>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Detect role from URL: /cook or /packer
  const pathRole = window.location.pathname.replace("/", "").toLowerCase();
  const initialRole = (pathRole === "cook" || pathRole === "packer") ? pathRole : null;

  const [role, setRole] = useState(initialRole);
  const [bilingual, setBilingual] = useState(true);
  const [activeTab, setActiveTab] = useState("checklist");

  const [cookChecks, setCookChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey("cook")) || "{}"); } catch { return {}; }
  });
  const [packerChecks, setPackerChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey("packer")) || "{}"); } catch { return {}; }
  });

  const checks = role === "cook" ? cookChecks : packerChecks;
  const setChecks = role === "cook" ? setCookChecks : setPackerChecks;
  const sections = role === "cook" ? COOK_SECTIONS : PACKER_SECTIONS;

  const toggle = useCallback(async (id, sectionTitle) => {
    const newVal = !checks[id];
    const updated = { ...checks, [id]: newVal };
    setChecks(updated);
    localStorage.setItem(storageKey(role), JSON.stringify(updated));

    // Find item label
    const allItems = [...COOK_SECTIONS, ...PACKER_SECTIONS].flatMap(s => s.items);
    const item = allItems.find(i => i.id === id);

    await logToSheet({
      sheet: role === "cook" ? "Cook Log" : "Packer Log",
      date: todayIST(),
      time: nowIST(),
      role,
      section: sectionTitle,
      itemId: id,
      item: item ? item.en : id,
      status: newVal ? "CHECKED" : "UNCHECKED",
    });
  }, [checks, role, setChecks]);

  const resetDay = () => {
    if (!window.confirm("Reset all checkboxes for today?")) return;
    setChecks({});
    localStorage.removeItem(storageKey(role));
  };

  const totalDone = sections.reduce((s, sec) => s + sec.items.filter(i => checks[i.id]).length, 0);
  const totalAll = sections.reduce((s, sec) => s + sec.items.length, 0);
  const allComplete = totalDone === totalAll;

  // ── Role selector ──
  if (!role) {
    return (
      <div style={{ minHeight: "100vh", background: GREEN, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🐾</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, color: "white", marginBottom: 4 }}>The Pet Pantry</div>
          <div style={{ color: GOLD, fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>Kitchen SOP — {todayIST()}</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 20 }}>Who are you today? / आज आप कौन हैं?</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {[{ key: "cook", label: "Cook", labelHi: "कुक", icon: "🍳" }, { key: "packer", label: "Packer", labelHi: "पैकर", icon: "📦" }].map(r => (
            <button key={r.key} onClick={() => setRole(r.key)} style={{ background: "white", border: "none", borderRadius: 16, padding: "24px 40px", cursor: "pointer", textAlign: "center", minWidth: 140, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{r.icon}</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: GREEN }}>{r.label}</div>
              <div style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 13, color: GOLD }}>{r.labelHi}</div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 32, color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Data saves automatically per day · IST</div>
      </div>
    );
  }

  const tabs = [
    { key: "checklist", label: role === "cook" ? "Cook Checklist" : "Packer Checklist", icon: "✅" },
    { key: "leftovers", label: "Leftover Log", icon: "📋" },
    { key: "dispatch", label: "Dispatch Log", icon: "🚴" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: LIGHT, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: GREEN, padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!initialRole && (
              <button onClick={() => setRole(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
            )}
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: "white" }}>
                {role === "cook" ? "🍳 Cook" : "📦 Packer"} — The Pet Pantry
              </div>
              <div style={{ fontSize: 11, color: GOLD }}>{todayIST()} · 5:00–8:00 AM IST</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setBilingual(!bilingual)} style={{ background: bilingual ? GOLD : "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "4px 10px", color: bilingual ? GREEN : "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>हिं</button>
            {activeTab === "checklist" && (
              <button onClick={resetDay} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "4px 10px", color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer" }}>Reset</button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, background: activeTab === tab.key ? CREAM : "transparent", border: "none", borderRadius: "8px 8px 0 0", padding: "8px 4px", color: activeTab === tab.key ? GREEN : "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
        {activeTab === "checklist" && (
          <>
            <div style={{ paddingTop: 8 }}>
              <ProgressBar sections={sections} checks={checks} />
            </div>
            {allComplete && (
              <div style={{ background: GREEN, borderRadius: 12, padding: "14px 16px", marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🎉</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "white" }}>All done for today!</div>
                {bilingual && <div style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 12, color: GOLD, marginTop: 2 }}>आज का काम पूरा हो गया!</div>}
              </div>
            )}
            {sections.map(section => (
              <Section key={section.id} section={section} checks={checks} onToggle={toggle} bilingual={bilingual} />
            ))}
          </>
        )}
        {activeTab === "leftovers" && <LeftoverLog bilingual={bilingual} role={role} />}
        {activeTab === "dispatch" && <DispatchLog bilingual={bilingual} role={role} />}
      </div>
    </div>
  );
}
