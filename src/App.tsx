import React from 'react';
import { Navigate, Route, Routes, Link } from 'react-router-dom';
import Req1 from './pages/Req1HelloWorld';
import Req2 from './pages/Req2HelloStyles';
import Req3 from './pages/Req3SeparateUpload';
import Req4 from './pages/Req4CombinedSeparation';
import Req5 from './pages/Req5ExtractionParsing';
import Req6 from './pages/Req6DiscrepancyDetection';
import Req7 from './pages/Req7TolerantMatching';
import Req8 from './pages/Req8EvidenceLinked';
import Req9 from './pages/Req9SubmissionValidation';
import Req10 from './pages/Req10WorkflowComments';
import Req11 from './pages/Req11RoleDashboard';
import styles from './styles/app.module.css';

const routes = [
  { id: 1, label: '1 Hello world', path: '/req/1' },
  { id: 2, label: '2 Hello styles', path: '/req/2' },
  { id: 3, label: '3 Separate docs', path: '/req/3' },
  { id: 4, label: '4 Combined split', path: '/req/4' },
  { id: 5, label: '5 Extract fields', path: '/req/5' },
  { id: 6, label: '6 Discrepancies', path: '/req/6' },
  { id: 7, label: '7 Tolerant match', path: '/req/7' },
  { id: 8, label: '8 Evidence', path: '/req/8' },
  { id: 9, label: '9 Submission', path: '/req/9' },
  { id: 10, label: '10 Workflow', path: '/req/10' },
  { id: 11, label: '11 Role dash', path: '/req/11' },
];

export default function App() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>HW5 Prototypes (port 5173)</h1>
        <p className={styles.tagline}>
          CIS 4120 HW5: /req/1–/req/11 is one page per requirement (11 = role dashboard); port 5174 runs the same case in one stepper, with a single upload step for Req 3 and 4.
        </p>
        <nav className={styles.nav}>
          {routes.map((r) => (
            <Link key={r.id} className={styles.navLink} to={r.path}>
              {r.id}
            </Link>
          ))}
        </nav>
      </header>

      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/req/1" replace />} />
          <Route path="/req/1" element={<Req1 />} />
          <Route path="/req/2" element={<Req2 />} />
          <Route path="/req/3" element={<Req3 />} />
          <Route path="/req/4" element={<Req4 />} />
          <Route path="/req/5" element={<Req5 />} />
          <Route path="/req/6" element={<Req6 />} />
          <Route path="/req/7" element={<Req7 />} />
          <Route path="/req/8" element={<Req8 />} />
          <Route path="/req/9" element={<Req9 />} />
          <Route path="/req/10" element={<Req10 />} />
          <Route path="/req/11" element={<Req11 />} />
        </Routes>
      </main>
    </div>
  );
}

