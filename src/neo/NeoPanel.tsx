import React from 'react';

type Props = { title?: string; children: React.ReactNode; className?: string };

export function NeoPanel({ title, children, className = '' }: Props) {
  return (
    <div className={`neo-panel ${className}`.trim()}>
      {title ? <h3 className="neo-panel__title">{title}</h3> : null}
      {children}
    </div>
  );
}
