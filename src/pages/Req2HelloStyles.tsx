import React from 'react';
import '../styles/theme.css';

function ColorSwatch({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 46,
            height: 22,
            borderRadius: 8,
            background: value,
            border: '1px solid rgba(15,23,42,0.15)',
          }}
          aria-label={`${label} swatch`}
        />
        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12, color: '#334155' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Icon({
  kind,
}: {
  kind: 'check' | 'x' | 'warning' | 'info' | 'mismatch';
}) {
  const common = { className: 'icon', viewBox: '0 0 16 16', role: 'img', 'aria-label': kind };

  if (kind === 'check') {
    return (
      <svg {...common}>
        <path
          d="M6.6 11.2 2.9 7.5l1-1 2.7 2.7 5.5-5.5 1 1-6.5 6.5Z"
          fill="#0f2f52"
        />
      </svg>
    );
  }
  if (kind === 'x') {
    return (
      <svg {...common}>
        <path
          d="M4 4l8 8M12 4 4 12"
          stroke="#991b1b"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg {...common}>
        <path
          d="M8 2.5 14 13H2L8 2.5Z"
          fill="#92400e"
          opacity="0.9"
        />
        <rect x="7.2" y="6" width="1.6" height="4.2" rx="0.8" fill="#fff" />
        <rect x="7.2" y="11.1" width="1.6" height="1.2" rx="0.6" fill="#fff" />
      </svg>
    );
  }
  if (kind === 'info') {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6" fill="#0f2f52" opacity="0.12" />
        <circle cx="8" cy="8" r="5" stroke="#0f2f52" strokeOpacity="0.5" />
        <rect x="7.3" y="7.2" width="1.4" height="4.4" rx="0.7" fill="#0f2f52" />
        <circle cx="8" cy="5.2" r="0.9" fill="#0f2f52" />
      </svg>
    );
  }

  // mismatch
  return (
    <svg {...common}>
      <path d="M2.8 8a5.2 5.2 0 1 0 10.4 0 5.2 5.2 0 0 0-10.4 0Z" fill="#0f2f52" opacity="0.08" />
      <path d="M5 11 11 5" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 5l6 6" stroke="#92400e" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export default function Req2HelloStyles({ hideTitle = false }: { hideTitle?: boolean } = {}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cfd7e3',
        borderRadius: 18,
        padding: 16,
        maxWidth: 980,
      }}
    >
      {hideTitle ? null : (
        <>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Requirement 2: Hello styles</h2>
          <p style={{ marginTop: 8, marginBottom: 16, color: '#334155', fontWeight: 700 }}>
            Rendering the token colors, typography hierarchy, icon family examples, and status/warning badges.
          </p>
        </>
      )}

      <section style={{ marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>Colors</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <ColorSwatch label="--navy" value="#163a63" />
          <ColorSwatch label="--navy-2" value="#0f2f52" />
          <ColorSwatch label="--bg" value="#f4f6f9" />
          <ColorSwatch label="--paper" value="#ffffff" />
          <ColorSwatch label="--line" value="#cfd7e3" />
          <ColorSwatch label="--muted" value="#6b7280" />
          <ColorSwatch label="--yellow" value="#f7e7b1" />
          <ColorSwatch label="--orange" value="#f6d2a7" />
          <ColorSwatch label="--blue" value="#d7e7fb" />
          <ColorSwatch label="--green" value="#cfe9d4" />
          <ColorSwatch label="--beige" value="#eadfc8" />
          <ColorSwatch label="--chip-bg" value="#eef2f7" />
          <ColorSwatch label="--chip-border" value="#d1dbe8" />
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>Typography</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="type-h1">Type H1 (36px)</div>
          <div className="type-h2">Type H2 (28px)</div>
          <div className="type-body">Body text (18px) showing line-height and weight.</div>
          <div className="type-meta">Meta / label text (12px, bold)</div>
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>Icon families</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {(['check', 'x', 'warning', 'info', 'mismatch'] as const).map((k) => (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #d1dbe8',
                borderRadius: 14,
                padding: '10px 12px',
              }}
            >
              <Icon kind={k} />
              <div style={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>Status & warning badges</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div className="badge">
            <Icon kind="check" />
            Match
          </div>
          <div className="badge badge-warning">
            <Icon kind="warning" />
            Mismatch
          </div>
          <div className="badge badge-danger">
            <Icon kind="x" />
            Not Found
          </div>
          <div className="badge badge-neutral">
            <Icon kind="info" />
            Needs review
          </div>
        </div>
      </section>
    </div>
  );
}

