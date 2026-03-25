import React from 'react';
import { Link } from 'react-router-dom';
import { NeoPageShell } from './NeoPageShell';

/**
 * Bookmarkable grading entry: same numbered routes as the hub Lab strip.
 * Not part of the main customs product path.
 */
export function NeoLabPage() {
  return (
    <NeoPageShell
      title="Grading lab"
      subtitle="Isolated requirement demos (1–11). Use the main app via Dashboard and Create case for the integrated customs flow."
      wide
      showBackHub
      shellClassName="neo-shell--lab-page"
    >
      <p className="neo-lab-intro">
        Each link opens a standalone prototype page. Behavior matches the course homework routes; titles use product-style names for clarity.
      </p>
      <nav className="neo-req-nav neo-req-nav--lab" aria-label="Requirement prototypes">
        {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
          <Link key={n} to={`/req/${n}`}>
            {n}
          </Link>
        ))}
      </nav>
    </NeoPageShell>
  );
}
