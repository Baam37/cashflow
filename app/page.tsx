'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";

const EINNAHMEN_KATEGORIEN: string[] = ["Freelance", "Gehalt", "Bonus", "Erstattung", "Sonstiges"];
const AUSGABEN_KATEGORIEN: string[] = ["Lebensmittel", "Miete", "Transport", "Reise", "Abonnements", "Geschäft", "Gesundheit", "Einkaufen", "Sonstiges"];
const MONATS_NAMEN: string[] = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const KATEGORIE_ICONS: Record<string, string> = {
  Freelance: "◈", Gehalt: "◎", Bonus: "◉", Erstattung: "↩", Sonstiges: "·",
  Lebensmittel: "⬡", Miete: "⬢", Transport: "⬣", Reise: "◇", Abonnements: "⊙",
  Geschäft: "◆", Gesundheit: "✦", Einkaufen: "◈",
};

interface Transaction {
  id: string;
  type: string;
  amount: number;
  category: string;
  date: string;
  note: string;
  createdAt: number;
}

const beispielDaten = (): Transaction[] => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const data: Transaction[] = [];
  const push = (type: string, amount: number, category: string, daysAgo: number, note: string) => {
    const d = new Date(y, m, now.getDate() - daysAgo);
    data.push({ id: crypto.randomUUID(), type, amount, category, date: d.toISOString().slice(0, 10), note, createdAt: d.getTime() });
  };
  push("einnahme", 4200, "Freelance", 2, "Webprojekt #12");
  push("einnahme", 800, "Bonus", 5, "Kundenzuschlag");
  push("ausgabe", 1200, "Miete", 1, "Monatliche Miete");
  push("ausgabe", 320, "Lebensmittel", 3, "Supermarkt & Restaurant");
  push("ausgabe", 89, "Abonnements", 4, "SaaS Tools");
  push("ausgabe", 240, "Transport", 6, "Monatsticket");
  push("einnahme", 1800, "Freelance", 8, "Design Sprint");
  push("ausgabe", 150, "Gesundheit", 9, "Fitnessstudio");
  push("ausgabe", 420, "Einkaufen", 10, "Neue Ausrüstung");
  push("einnahme", 500, "Erstattung", 12, "Steuerrückerstattung");
  push("ausgabe", 75, "Reise", 14, "Wochenendausflug");
  push("ausgabe", 198, "Geschäft", 15, "Hosting & Domains");
  return data;
};

const fmt = (n: number): string => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const useTransactions = () => {
  const [txs, setTxs] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem("cashflow_txs_de");
      return stored ? JSON.parse(stored) : beispielDaten();
    } catch { return beispielDaten(); }
  });
  useEffect(() => { localStorage.setItem("cashflow_txs_de", JSON.stringify(txs)); }, [txs]);
  const add = (tx: Omit<Transaction, 'id' | 'createdAt'>) => setTxs(prev => [{ ...tx, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
  const remove = (id: string) => setTxs(prev => prev.filter(t => t.id !== id));
  return { txs, add, remove };
};

const getStreak = (txs: Transaction[]): number => {
  const days = new Set(txs.map(t => t.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) { streak++; d.setDate(d.getDate() - 1); } else break;
  }
  return streak;
};

const FloatingParticle = ({ type }: { type: string }) => {
  const symbols = type === "einnahme" ? ["€", "+", "↑"] : ["€", "−", "↓"];
  return (
    <div className="particles-container">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={`particle particle-${type}`}
          style={{ left: `${10 + i * 15}%`, animationDelay: `${i * 0.15}s`, animationDuration: `${0.8 + i * 0.1}s` }}>
          {symbols[i % symbols.length]}
        </span>
      ))}
    </div>
  );
};

const GuthabenKarte = ({ einnahmen, ausgaben, guthaben }: { einnahmen: number; ausgaben: number; guthaben: number }) => {
  const [flash, setFlash] = useState<string | null>(null);
  const prev = useRef(guthaben);
  useEffect(() => {
    if (prev.current !== guthaben) {
      setFlash(guthaben > prev.current ? "up" : "down");
      setTimeout(() => setFlash(null), 700);
      prev.current = guthaben;
    }
  }, [guthaben]);
  return (
    <div className={`balance-card ${flash ? `flash-${flash}` : ""}`}>
      <div className="balance-label">AKTUELLES GUTHABEN</div>
      <div className="balance-amount">€ {fmt(guthaben)}</div>
      <div className="balance-sub-row">
        <div className="balance-sub">
          <span className="sub-label">↑ EINNAHMEN</span>
          <span className="sub-val green">€ {fmt(einnahmen)}</span>
        </div>
        <div className="balance-divider" />
        <div className="balance-sub">
          <span className="sub-label">↓ AUSGABEN</span>
          <span className="sub-val red">€ {fmt(ausgaben)}</span>
        </div>
      </div>
      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: einnahmen > 0 ? `${Math.min(100, (ausgaben / einnahmen) * 100)}%` : "0%" }} />
      </div>
      <div className="progress-label">{einnahmen > 0 ? `${Math.round((ausgaben / einnahmen) * 100)}% ausgegeben` : "—"}</div>
    </div>
  );
};

const BalkenDiagramm = ({ txs }: { txs: Transaction[] }) => {
  const monate = useMemo(() => {
    const map: Record<string, { einnahmen: number; ausgaben: number }> = {};
    txs.forEach(t => {
      const key = t.date.slice(0, 7);
      if (!map[key]) map[key] = { einnahmen: 0, ausgaben: 0 };
      if (t.type === "einnahme") map[key].einnahmen += t.amount;
      else map[key].ausgaben += t.amount;
    });
    return Object.entries(map).sort().slice(-6).map(([k, v]) => ({
      label: MONATS_NAMEN[parseInt(k.slice(5, 7)) - 1],
      einnahmen: v.einnahmen,
      ausgaben: v.ausgaben,
    }));
  }, [txs]);
  const max = Math.max(...monate.flatMap(m => [m.einnahmen, m.ausgaben]), 1);
  return (
    <div className="chart-card">
      <div className="chart-title">MONATLICHER CASHFLOW</div>
      <div className="bar-chart">
        {monate.map((m, i) => (
          <div key={i} className="bar-group">
            <div className="bar-pair">
              <div className="bar income-bar" style={{ height: `${(m.einnahmen / max) * 100}%` }} />
              <div className="bar expense-bar" style={{ height: `${(m.ausgaben / max) * 100}%` }} />
            </div>
            <div className="bar-label">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span className="legend-dot green-dot" /> Einnahmen &nbsp;
        <span className="legend-dot red-dot" /> Ausgaben
      </div>
    </div>
  );
};

const KreisDiagramm = ({ txs }: { txs: Transaction[] }) => {
  const { map, total } = useMemo(() => {
    const now = new Date();
    const m: Record<string, number> = {};
    txs.filter(t => {
      const d = new Date(t.date);
      return t.type === "ausgabe" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    const total = Object.values(m).reduce((a: number, b: number) => a + b, 0);
    return { map: m, total };
  }, [txs]);

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899", "#f43f5e", "#84cc16"];
  const entries: [string, number][] = Object.entries(map).sort((a, b) => b[1] - a[1]);
  let offset = 0;
  const segments = entries.map(([cat, val], i) => {
    const pct = total > 0 ? (val / total) * 100 : 0;
    const seg = { cat, val, pct, color: colors[i % colors.length], offset };
    offset += pct; return seg;
  });
  const r = 40, cx = 50, cy = 50;
  const arc = (pct: number, off: number): string => {
    if (pct >= 99.9) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    const a1 = (off / 100) * 2 * Math.PI - Math.PI / 2;
    const a2 = ((off + pct) / 100) * 2 * Math.PI - Math.PI / 2;
    return `M ${cx} ${cy} L ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} A ${r} ${r} 0 ${pct > 50 ? 1 : 0} 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)} Z`;
  };
  return (
    <div className="chart-card">
      <div className="chart-title">AUSGABEN NACH KATEGORIE</div>
      <div className="donut-layout">
        <svg viewBox="0 0 100 100" className="donut-svg">
          {segments.map((s, i) => <path key={i} d={arc(s.pct, s.offset)} fill={s.color} opacity="0.85" />)}
          <circle cx={cx} cy={cy} r={25} fill="#0f0f0f" />
          <text x={cx} y={cy - 3} textAnchor="middle" fill="#888" fontSize="5" fontFamily="monospace">GESAMT</text>
          <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize="7" fontFamily="monospace" fontWeight="bold">
            {`€${total > 999 ? (total / 1000).toFixed(1) + "k" : fmt(total)}`}
          </text>
        </svg>
        <div className="donut-legend">
          {segments.slice(0, 5).map((s, i) => (
            <div key={i} className="donut-item">
              <span className="donut-dot" style={{ background: s.color }} />
              <span className="donut-cat">{s.cat}</span>
              <span className="donut-pct">{s.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StreakBadge = ({ streak }: { streak: number }) => (
  <div className="streak-badge">
    <span className="streak-fire">◉</span>
    <div>
      <div className="streak-num">{streak} {streak === 1 ? "Tag" : "Tage"}</div>
      <div className="streak-label">TRACKING-SERIE</div>
    </div>
  </div>
);

const TransaktionItem = ({ tx, onDelete }: { tx: Transaction; onDelete: (id: string) => void; animate: boolean }) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  const handleDelete = () => { setLeaving(true); setTimeout(() => onDelete(tx.id), 350); };
  return (
    <div className={`tx-item ${tx.type} ${visible ? "tx-visible" : "tx-hidden"} ${leaving ? "tx-leaving" : ""}`}>
      <div className="tx-icon">{KATEGORIE_ICONS[tx.category] || "·"}</div>
      <div className="tx-info">
        <div className="tx-cat">{tx.category}</div>
        <div className="tx-note">{tx.note || "—"}</div>
      </div>
      <div className="tx-right">
        <div className={`tx-amount ${tx.type}`}>{tx.type === "einnahme" ? "+" : "−"}€{fmt(tx.amount)}</div>
        <div className="tx-date">{tx.date}</div>
      </div>
      <button className="tx-delete" onClick={handleDelete}>×</button>
    </div>
  );
};

const HinzufuegenPanel = ({ onAdd, onClose }: { onAdd: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void; onClose: () => void }) => {
  const [type, setType] = useState("ausgabe");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(AUSGABEN_KATEGORIEN[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState(false);
  const [particles, setParticles] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCategory(type === "einnahme" ? EINNAHMEN_KATEGORIEN[0] : AUSGABEN_KATEGORIEN[0]);
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [type]);

  const submit = () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    setParticles(true); setFlash(true);
    onAdd({ type, amount: parseFloat(amount), category, date, note });
    setTimeout(() => { setFlash(false); setParticles(false); }, 800);
    setAmount(""); setNote("");
    amountRef.current?.focus();
  };

  const cats = type === "einnahme" ? EINNAHMEN_KATEGORIEN : AUSGABEN_KATEGORIEN;

  return (
    <div className="panel-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`add-panel ${flash ? "panel-flash" : ""}`}>
        {particles && <FloatingParticle type={type} />}
        <div className="panel-header">
          <div className="panel-title">NEUE TRANSAKTION</div>
          <button className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="type-toggle">
          {["ausgabe", "einnahme"].map(t => (
            <button key={t} className={`type-btn ${type === t ? `active-${t}` : ""}`} onClick={() => setType(t)}>
              {t === "einnahme" ? "↑ EINNAHME" : "↓ AUSGABE"}
            </button>
          ))}
        </div>
        <div className="amount-field-wrap">
          <span className="amount-prefix">€</span>
          <input ref={amountRef} className="amount-input" type="number" placeholder="0,00"
            value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <div className="cat-grid">
          {cats.map(c => (
            <button key={c} className={`cat-btn ${category === c ? "cat-active" : ""}`} onClick={() => setCategory(c)}>
              <span className="cat-icon">{KATEGORIE_ICONS[c] || "·"}</span>{c}
            </button>
          ))}
        </div>
        <div className="field-row">
          <input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input className="field-input" placeholder="Notiz (optional)" value={note}
            onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <button className={`submit-btn submit-${type}`} onClick={submit}>
          {type === "einnahme" ? "EINNAHME SPEICHERN ↑" : "AUSGABE SPEICHERN ↓"}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const { txs, add, remove } = useTransactions();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState("uebersicht");

  const now = new Date();
  const dieserMonat = txs.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const einnahmen = dieserMonat.filter(t => t.type === "einnahme").reduce((s, t) => s + t.amount, 0);
  const ausgaben = dieserMonat.filter(t => t.type === "ausgabe").reduce((s, t) => s + t.amount, 0);
  const guthaben = einnahmen - ausgaben;
  const streak = getStreak(txs);
  const recent = [...txs].sort((a, b) => b.createdAt - a.createdAt);

  const tabs = [
    { key: "uebersicht", label: "ÜBERSICHT" },
    { key: "transaktionen", label: "TRANSAKTIONEN" },
    { key: "diagramme", label: "DIAGRAMME" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="app-header">
          <div className="app-logo">CASHFLOW</div>
          <StreakBadge streak={streak} />
        </header>
        <nav className="app-nav">
          {tabs.map(t => (
            <button key={t.key} className={`nav-btn ${tab === t.key ? "nav-active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <main className="app-main">
          {tab === "uebersicht" && (
            <div className="screen">
              <GuthabenKarte einnahmen={einnahmen} ausgaben={ausgaben} guthaben={guthaben} />
              <BalkenDiagramm txs={txs} />
              <div className="section-header">ZULETZT</div>
              {recent.slice(0, 5).map(tx => <TransaktionItem key={tx.id} tx={tx} onDelete={remove} animate={false} />)}
              {txs.length > 5 && (
                <button className="see-all" onClick={() => setTab("transaktionen")}>
                  ALLE {txs.length} TRANSAKTIONEN ANZEIGEN →
                </button>
              )}
            </div>
          )}
          {tab === "transaktionen" && (
            <div className="screen">
              <div className="section-header">{txs.length} TRANSAKTIONEN</div>
              {recent.map(tx => <TransaktionItem key={tx.id} tx={tx} onDelete={remove} animate={false} />)}
            </div>
          )}
          {tab === "diagramme" && (
            <div className="screen">
              <BalkenDiagramm txs={txs} />
              <KreisDiagramm txs={txs} />
            </div>
          )}
        </main>
        <button className="fab" onClick={() => setShowAdd(true)}>＋</button>
        {showAdd && <HinzufuegenPanel onAdd={add} onClose={() => setShowAdd(false)} />}
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a0a; --surface: #111111; --surface2: #181818;
    --border: rgba(255,255,255,0.07);
    --green: #22c55e; --green-dim: rgba(34,197,94,0.15);
    --red: #ef4444; --red-dim: rgba(239,68,68,0.15);
    --text: #f0f0f0; --muted: #555; --accent: #e8e8e8;
    --mono: 'DM Mono', monospace; --sans: 'Syne', sans-serif;
  }
  body { background: var(--bg); color: var(--text); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .app { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; }
  .app-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 20px 12px; }
  .app-logo { font-family: var(--sans); font-weight: 800; font-size: 15px; letter-spacing: 0.2em; color: var(--accent); }
  .streak-badge { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 100px; padding: 6px 14px 6px 10px; }
  .streak-fire { font-size: 16px; color: #f97316; }
  .streak-num { font-family: var(--mono); font-size: 13px; font-weight: 500; color: var(--text); line-height: 1; }
  .streak-label { font-size: 8px; letter-spacing: 0.12em; color: var(--muted); line-height: 1; margin-top: 2px; }
  .app-nav { display: flex; padding: 0 20px; gap: 4px; border-bottom: 1px solid var(--border); }
  .nav-btn { flex: 1; background: none; border: none; color: var(--muted); font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; padding: 12px 0; cursor: pointer; transition: color 0.2s; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .nav-btn:hover { color: var(--text); }
  .nav-active { color: var(--text) !important; border-bottom-color: var(--accent) !important; }
  .app-main { flex: 1; overflow-y: auto; padding: 20px; padding-bottom: 100px; }
  .screen { display: flex; flex-direction: column; gap: 12px; }
  .balance-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px 24px 20px; position: relative; overflow: hidden; transition: box-shadow 0.4s; }
  .balance-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); }
  .balance-label { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; color: var(--muted); margin-bottom: 8px; }
  .balance-amount { font-family: var(--mono); font-size: 40px; font-weight: 500; color: var(--text); letter-spacing: -0.02em; line-height: 1; margin-bottom: 24px; }
  .balance-sub-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .balance-sub { flex: 1; }
  .balance-divider { width: 1px; height: 32px; background: var(--border); }
  .sub-label { display: block; font-family: var(--mono); font-size: 8px; letter-spacing: 0.15em; color: var(--muted); margin-bottom: 4px; }
  .sub-val { font-family: var(--mono); font-size: 16px; font-weight: 500; }
  .green { color: var(--green); } .red { color: var(--red); }
  .progress-bar-bg { height: 3px; background: rgba(255,255,255,0.06); border-radius: 100px; overflow: hidden; margin-bottom: 6px; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--red), #ff6b6b); border-radius: 100px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
  .progress-label { font-family: var(--mono); font-size: 9px; color: var(--muted); text-align: right; }
  .flash-up { box-shadow: 0 0 0 1px var(--green), 0 0 40px rgba(34,197,94,0.1) !important; }
  .flash-down { box-shadow: 0 0 0 1px var(--red), 0 0 40px rgba(239,68,68,0.1) !important; }
  .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 20px; }
  .chart-title { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; color: var(--muted); margin-bottom: 16px; }
  .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 100px; gap: 4px; }
  .bar-group { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; }
  .bar-pair { display: flex; align-items: flex-end; gap: 2px; flex: 1; width: 100%; justify-content: center; }
  .bar { width: 10px; border-radius: 3px 3px 0 0; transition: height 0.5s cubic-bezier(0.4,0,0.2,1); min-height: 2px; }
  .income-bar { background: var(--green); opacity: 0.7; }
  .expense-bar { background: var(--red); opacity: 0.7; }
  .bar-label { font-family: var(--mono); font-size: 8px; color: var(--muted); margin-top: 6px; }
  .chart-legend { display: flex; gap: 16px; margin-top: 12px; font-family: var(--mono); font-size: 9px; color: var(--muted); align-items: center; }
  .legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
  .green-dot { background: var(--green); } .red-dot { background: var(--red); }
  .donut-layout { display: flex; gap: 20px; align-items: center; }
  .donut-svg { width: 120px; height: 120px; flex-shrink: 0; }
  .donut-legend { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .donut-item { display: flex; align-items: center; gap: 6px; }
  .donut-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .donut-cat { font-family: var(--mono); font-size: 10px; color: var(--text); flex: 1; }
  .donut-pct { font-family: var(--mono); font-size: 10px; color: var(--muted); }
  .section-header { font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em; color: var(--muted); padding: 4px 0; }
  .tx-item { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; position: relative; overflow: hidden; transition: opacity 0.35s, transform 0.35s; }
  .tx-item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
  .tx-item.einnahme::before { background: var(--green); }
  .tx-item.ausgabe::before { background: var(--red); }
  .tx-hidden { opacity: 0; transform: translateX(20px); }
  .tx-visible { opacity: 1; transform: translateX(0); }
  .tx-leaving { opacity: 0; transform: translateX(-20px) scale(0.97); }
  .tx-icon { font-size: 18px; color: var(--muted); min-width: 24px; text-align: center; }
  .tx-info { flex: 1; }
  .tx-cat { font-family: var(--sans); font-size: 13px; font-weight: 600; color: var(--text); line-height: 1; }
  .tx-note { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-top: 3px; }
  .tx-right { text-align: right; }
  .tx-amount { font-family: var(--mono); font-size: 14px; font-weight: 500; }
  .tx-amount.einnahme { color: var(--green); }
  .tx-amount.ausgabe { color: var(--red); }
  .tx-date { font-family: var(--mono); font-size: 9px; color: var(--muted); margin-top: 3px; }
  .tx-delete { position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--muted); font-size: 14px; cursor: pointer; opacity: 0; transition: opacity 0.2s; padding: 4px; line-height: 1; }
  .tx-item:hover .tx-delete { opacity: 1; }
  .see-all { background: none; border: 1px solid var(--border); color: var(--muted); font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; padding: 12px; border-radius: 12px; cursor: pointer; width: 100%; transition: color 0.2s, border-color 0.2s; }
  .see-all:hover { color: var(--text); border-color: rgba(255,255,255,0.15); }
  .fab { position: fixed; bottom: 28px; right: 50%; transform: translateX(50%); width: 60px; height: 60px; border-radius: 50%; background: var(--text); color: var(--bg); border: none; font-size: 28px; cursor: pointer; box-shadow: 0 8px 32px rgba(0,0,0,0.5); transition: transform 0.2s, box-shadow 0.2s; display: flex; align-items: center; justify-content: center; font-weight: 300; line-height: 1; }
  .fab:hover { transform: translateX(50%) scale(1.08); box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
  .fab:active { transform: translateX(50%) scale(0.95); }
  .panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: flex-end; justify-content: center; z-index: 100; animation: fade-in 0.2s ease; }
  .add-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 24px 24px 0 0; width: 100%; max-width: 480px; padding: 24px 20px 40px; position: relative; overflow: hidden; animation: slide-up 0.3s cubic-bezier(0.4,0,0.2,1); }
  .panel-flash { animation: panel-pop 0.4s ease !important; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .panel-title { font-family: var(--mono); font-size: 11px; letter-spacing: 0.2em; color: var(--muted); }
  .panel-close { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; transition: color 0.2s; }
  .panel-close:hover { color: var(--text); }
  .type-toggle { display: flex; gap: 8px; margin-bottom: 20px; }
  .type-btn { flex: 1; background: var(--surface2); border: 1px solid var(--border); color: var(--muted); font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; padding: 12px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
  .active-einnahme { background: var(--green-dim) !important; border-color: var(--green) !important; color: var(--green) !important; }
  .active-ausgabe { background: var(--red-dim) !important; border-color: var(--red) !important; color: var(--red) !important; }
  .amount-field-wrap { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; padding: 4px 16px; margin-bottom: 16px; }
  .amount-prefix { font-family: var(--mono); font-size: 28px; color: var(--muted); }
  .amount-input { flex: 1; background: none; border: none; outline: none; font-family: var(--mono); font-size: 36px; color: var(--text); padding: 8px 0; }
  .amount-input::placeholder { color: var(--muted); }
  .amount-input::-webkit-inner-spin-button, .amount-input::-webkit-outer-spin-button { -webkit-appearance: none; }
  .cat-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
  .cat-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--muted); font-family: var(--sans); font-size: 11px; padding: 6px 12px; border-radius: 100px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 4px; }
  .cat-btn:hover { border-color: rgba(255,255,255,0.15); color: var(--text); }
  .cat-active { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.25) !important; color: var(--text) !important; }
  .cat-icon { font-size: 12px; }
  .field-row { display: flex; gap: 8px; margin-bottom: 16px; }
  .field-input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; color: var(--text); font-family: var(--mono); font-size: 12px; outline: none; transition: border-color 0.2s; }
  .field-input:focus { border-color: rgba(255,255,255,0.2); }
  .field-input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
  .submit-btn { width: 100%; padding: 16px; border: none; border-radius: 16px; font-family: var(--mono); font-size: 13px; letter-spacing: 0.12em; cursor: pointer; transition: all 0.2s; }
  .submit-einnahme { background: var(--green); color: #000; }
  .submit-ausgabe { background: var(--red); color: #fff; }
  .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .submit-btn:active { transform: translateY(0); }
  .particles-container { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .particle { position: absolute; bottom: -20px; font-family: var(--mono); font-size: 18px; opacity: 0; animation: fly-particle 0.9s ease-out forwards; }
  .particle-einnahme { color: var(--green); }
  .particle-ausgabe { color: var(--red); }
  @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
  @keyframes panel-pop { 0%,100% { transform: scale(1) } 50% { transform: scale(1.015) } }
  @keyframes fly-particle { 0% { opacity: 0.9; transform: translateY(0) rotate(0deg); } 100% { opacity: 0; transform: translateY(-120px) rotate(20deg); } }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 100px; }
`;
