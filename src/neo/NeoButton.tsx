import React from 'react';

type Variant = 'primary' | 'secondary' | 'green' | 'red' | 'gold';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
};

export function NeoButton({ variant = 'primary', size = 'md', className = '', ...rest }: Props) {
  const v = `neo-btn--${variant}`;
  const s = size === 'sm' ? 'neo-btn--sm' : '';
  return <button type="button" className={`neo-btn ${v} ${s} ${className}`.trim()} {...rest} />;
}
