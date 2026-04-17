import { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import UploadPanel    from '../components/UploadPanel';
import AnalysisPanel  from '../components/AnalysisPanel';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const SIGNAL_SERIES = [
  { t: 'W01', primary: 42, secondary: 28 },
  { t: 'W02', primary: 51, secondary: 33 },
  { t: 'W03', primary: 46, secondary: 41 },
  { t: 'W04', primary: 68, secondary: 39 },
  { t: 'W05', primary: 74, secondary: 52 },
  { t: 'W06', primary: 63, secondary: 60 },
  { t: 'W07', primary: 88, secondary: 57 },
  { t: 'W08', primary: 95, secondary: 71 },
];

const DISTRIBUTION = [
  { category: 'Comms',   count: 34 },
  { category: 'Data',    count: 58 },
  { category: 'Systems', count: 27 },
  { category: 'Policy',  count: 19 },
  { category: 'Infra',   count: 43 },
];

const SPARKS = {
  records:   [12, 18, 16, 22, 19, 27, 31, 38],
  signalA:   [42, 51, 46, 68, 74, 63, 88, 95],
  signalB:   [28, 33, 41, 39, 52, 60, 57, 71],
  variance:  [14, 11, 17, 13,  9, 12,  8,  6],
};

function Sparkline({ data, color = 'var(--accent)', width = 88, height = 22 }) {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const r = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / r) * (height - 3) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lx = width;
  const ly = height - ((data[data.length - 1] - min) / r) * (height - 3) - 1;
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

function Panel({ idx, title, meta, right, children, accent = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      boxShadow: 'var(--shadow-card)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '11px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel-header)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: accent,
          fontWeight: 700,
          letterSpacing: '0.08em',
          background: `${accent}18`,
          border: `1px solid ${accent}30`,
          padding: '2px 6px',
          borderRadius: 3,
        }}>
          {idx}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-primary)',
        }}>
          {title}
        </span>
        {meta && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {meta}
          </span>
        )}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function StatCard({ idx, label, value, unit, delta, spark, sparkColor = 'var(--accent)' }) {
  const pos = delta > 0, neg = delta < 0;
  const col = pos ? 'var(--green)' : neg ? 'var(--red)' : 'var(--text-muted)';
  const arrow = pos ? '▲' : neg ? '▼' : '◆';
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      borderTop: `3px solid ${sparkColor}`,
      padding: '16px 18px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      boxShadow: 'var(--shadow-card)',
      transition: 'box-shadow 200ms, transform 200ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: sparkColor,
          fontWeight: 700,
          background: `${sparkColor}14`,
          padding: '1px 5px',
          borderRadius: 2,
        }}>{idx}</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {value ?? '—'}
          </span>
          {unit && (
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>{unit}</span>
          )}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: col,
      }}>
        <span>{arrow}</span>
        <span style={{ fontWeight: 700 }}>{delta != null ? `${delta > 0 ? '+' : ''}${delta}%` : '—'}</span>
        <span style={{ color: 'var(--text-dim)' }}>· 8W TRAIL</span>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      minWidth: 130,
      boxShadow: 'var(--shadow-card-hover)',
    }}>
      <div style={{
        color: 'var(--text-muted)',
        fontSize: 9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 8,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 6,
      }}>
        PERIOD · {label}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 14,
          color: p.color,
          marginBottom: 3,
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function SortIcon({ active, dir }) {
  return (
    <span style={{ marginLeft: 4, color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 9 }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
}

export default function Dashboard() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [datasets, setDatasets] = useState([]);
  const [filter, setFilter]     = useState('');
  const [sortKey, setSortKey]   = useState('created_at');
  const [sortDir, setSortDir]   = useState('desc');
  const [period, setPeriod]     = useState('8W');

  useEffect(() => {
    api.get('/items')
      .then(data => setItems(data ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    api.get('/upload').then(data => setDatasets(data ?? [])).catch(() => {});
  }, []);

  const displayedItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? items.filter(it =>
          it.title?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q)
        )
      : items;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, filter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const COLS = [
    { key: 'id',          label: 'ID',          align: 'left',  sortable: false },
    { key: 'title',       label: 'Title',       align: 'left',  sortable: true  },
    { key: 'description', label: 'Description', align: 'left',  sortable: false },
    { key: 'created_at',  label: 'Created',     align: 'right', sortable: true  },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1480, margin: '0 auto' }}>

      {/* Command bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        marginBottom: 22,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>❯</span>
        <span style={{ color: 'var(--text-secondary)' }}>workspace</span>
        <span style={{ color: 'var(--text-dim)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>overview</span>
        <span style={{ color: 'var(--text-dim)' }}>—</span>
        <span style={{ color: 'var(--text-muted)' }}>
          analyze --source=items --window={period.toLowerCase()} --agg=weekly
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 10,
          color: 'var(--green)',
          background: 'rgba(62,123,39,0.10)',
          border: '1px solid rgba(62,123,39,0.25)',
          padding: '3px 10px',
          borderRadius: 20,
          letterSpacing: '0.1em',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          <span style={{
            width: 5,
            height: 5,
            background: 'var(--green)',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'pulse 1.8s ease-in-out infinite',
          }} />
          SYNCED
        </span>
      </div>

      {/* Page header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 22,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}>
            Intelligence · Overview
          </div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
          }}>
            Cross-domain signal synthesis
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Real-time view across communications, data science, and systems cohorts.
          </p>
        </div>
        <div style={{
          display: 'flex',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {['1W', '4W', '8W', '6M', '1Y'].map((p, i, arr) => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '7px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: period === p ? '#123524' : 'var(--text-muted)',
              background: period === p ? 'var(--accent)' : 'transparent',
              borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              transition: 'background 150ms, color 150ms',
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <StatCard idx="01" label="Data Records"      value={items.length} unit="rows" delta={null}   spark={SPARKS.records}  sparkColor="var(--chart-1)" />
        <StatCard idx="02" label="Signal · Primary"  value="95"           unit="idx"  delta={7.9}   spark={SPARKS.signalA}  sparkColor="var(--chart-2)" />
        <StatCard idx="03" label="Signal · Secondary" value="71"          unit="idx"  delta={-1.4}  spark={SPARKS.signalB}  sparkColor="var(--chart-1)" />
        <StatCard idx="04" label="Variance · σ"      value="6.0"          unit="pp"   delta={-25.0} spark={SPARKS.variance} sparkColor="var(--chart-3)" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <Panel idx="05" title="Signal Trends" meta={`${period} · weekly aggregation`}
          right={
            <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {[['PRIMARY', 'var(--chart-2)'], ['SECONDARY', 'var(--chart-1)']].map(([n, c]) => (
                <span key={n} style={{ color: c, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 2, background: c, display: 'inline-block', borderRadius: 1 }} />
                  {n}
                </span>
              ))}
            </div>
          }
        >
          <div style={{ padding: '16px 8px 10px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={SIGNAL_SERIES} margin={{ top: 4, right: 20, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#3E7B27" stopOpacity={0.20} />
                    <stop offset="100%" stopColor="#3E7B27" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#85A947" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#85A947" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <ReferenceLine y={50} stroke="var(--border-strong)" strokeDasharray="4 4" strokeWidth={1} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="primary"   name="Primary"   stroke="#3E7B27" strokeWidth={2} fill="url(#gP)" dot={false} activeDot={{ r: 3, fill: '#3E7B27', stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="secondary" name="Secondary" stroke="#85A947" strokeWidth={2} fill="url(#gS)" dot={false} activeDot={{ r: 3, fill: '#85A947', stroke: 'var(--bg-surface)', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel idx="06" title="Distribution" meta="by category" accent="var(--accent-2)">
          <div style={{ padding: '16px 8px 10px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={DISTRIBUTION} margin={{ top: 4, right: 12, left: -18, bottom: 0 }} barSize={18}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(133,169,71,0.08)' }} />
                <Bar dataKey="count" name="Count" fill="#85A947" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Records table */}
      <Panel
        idx="07"
        title="Records"
        meta={`${displayedItems.length} / ${items.length} entries · live`}
        right={
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '2px 8px',
            borderRadius: 3,
          }}>
            GET /api/items
          </span>
        }
      >
        {/* Filter bar */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--bg-input)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>⌕</span>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by title or description…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
            }}
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              ✕ clear
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            ◌ Loading records...
          </div>
        ) : error ? (
          <div style={{ padding: 20, color: 'var(--red)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>✗ {error}</div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 10, color: 'var(--text-dim)' }}>∅</div>
            No records ingested.
            <div style={{ marginTop: 8, fontSize: 10 }}>
              POST <span style={{ color: 'var(--accent)' }}>/api/items</span> to populate.
            </div>
          </div>
        ) : displayedItems.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No records match "{filter}"
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-panel-header)', borderBottom: '1px solid var(--border)' }}>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && toggleSort(col.key)}
                    style={{
                      padding: '9px 16px',
                      textAlign: col.align,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: sortKey === col.key ? 'var(--accent-hot)' : 'var(--text-muted)',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      transition: 'color 150ms',
                    }}
                    onMouseEnter={e => { if (col.sortable) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = sortKey === col.key ? 'var(--accent-hot)' : 'var(--text-muted)'; }}
                  >
                    {col.label}
                    {col.sortable && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item, i) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: i % 2 === 1 ? 'rgba(133,169,71,0.04)' : 'transparent',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(133,169,71,0.04)' : 'transparent'}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.id.slice(0, 8)}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.title}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.description || <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(item.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Upload + datasets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <UploadPanel onSuccess={ds => setDatasets(prev => [ds, ...prev])} />
        <AnalysisPanel datasets={datasets} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginTop: 14 }}>
        <Panel idx="09" title="Ingested Datasets" meta={`${datasets.length} total`} accent="var(--accent-2)">
          {datasets.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 10, color: 'var(--text-dim)' }}>∅</div>
              No datasets yet. Upload a CSV or JSON to begin.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-panel-header)', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Rows', 'Columns', 'Ingested'].map((h, i) => (
                    <th key={h} style={{
                      padding: '9px 14px',
                      textAlign: i >= 1 ? 'right' : 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds, i) => (
                  <tr
                    key={ds.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: i % 2 === 1 ? 'rgba(133,169,71,0.04)' : 'transparent',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(133,169,71,0.04)' : 'transparent'}
                  >
                    <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{ds.name}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-2)', fontWeight: 600 }}>
                      {ds.row_count?.toLocaleString()}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {ds.columns?.length ?? '—'}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(ds.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
