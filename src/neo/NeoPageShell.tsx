import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBackHub?: boolean;
  wide?: boolean;
  /** Reference-style header: uppercase title, profile chevron. */
  headerVariant?: 'default' | 'customs';
  shellClassName?: string;
  bodyClassName?: string;
  /** Lab /req pages: banner under header so graders know these are prototypes. */
  pageContext?: 'product' | 'lab';
};

export function NeoPageShell({
  title,
  subtitle,
  children,
  showBackHub = true,
  wide,
  headerVariant = 'default',
  shellClassName = '',
  bodyClassName = '',
  pageContext = 'product',
}: Props) {
  const customs = headerVariant === 'customs';
  const lab = pageContext === 'lab';
  const shellCls = ['neo-shell-card', shellClassName].filter(Boolean).join(' ');
  const bodyCls = ['neo-shell-body', bodyClassName].filter(Boolean).join(' ');
  return (
    <div className={`neo-frame ${wide ? 'neo-frame--wide' : ''}`.trim()}>
      <div className={shellCls}>
        <header className={`neo-shell-header${customs ? ' neo-shell-header--customs' : ''}`}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              {showBackHub ? (
                <Link to="/hub" className="neo-back">
                  ← Hub
                </Link>
              ) : null}
              <h1 className={`neo-shell-title${customs ? ' neo-shell-title--dash' : ''}`}>{customs ? title.toUpperCase() : title}</h1>
            </div>
            {subtitle ? <p className="neo-shell-sub">{subtitle}</p> : null}
          </div>
          <div className={`neo-profile${customs ? ' neo-profile--with-chevron' : ''}`} aria-hidden title="Profile" />
        </header>
        {lab ? <div className="neo-shell-lab-strip">Lab prototype · grading routes only</div> : null}
        <div className={bodyCls}>{children}</div>
      </div>
    </div>
  );
}
