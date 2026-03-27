import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

type Role = 'Analyst' | 'Reviewer';
type CaseStatus = 'Draft' | 'Ready for Review' | 'Returned for Changes' | 'Ready to Submit' | 'Submitted';
type DashboardRole = 'Case Reviewer' | 'Lead Reviewer' | 'CEO';

type CaseItem = {
  id: string;
  status: CaseStatus;
  createdBy: Role;
};

type DeclarantFields = {
  companyName: string;
  grossWeight: string;
  invoiceNumber: string;
  itemDescription: string;
  quantity: string;
};

type EvidenceLink = {
  field: keyof DeclarantFields;
  documentName: string;
  region: string;
  evidenceValue: string;
  targetId?: string;
};

type EvidenceTarget = {
  id: string;
  docName: string;
  label: string;
  value: string;
  xPct: number;
  yPct: number;
  sizePct: number;
};

type VisualLink = {
  field: keyof DeclarantFields;
  targetId: string;
  docName: string;
};

type StoredDoc = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

type CaseProfile = {
  fields: DeclarantFields;
  uploadMode: 'separate' | 'combined';
  separateDocs: StoredDoc[];
  combinedDoc: StoredDoc | null;
  docTargets: Record<string, EvidenceTarget[]>;
  comments: string[];
  notifications: string[];
  evidenceLinks: EvidenceLink[];
  visualLinks: VisualLink[];
};

const reqTabs = [
  'Req 1', 'Req 2', 'Req 3', 'Req 4', 'Req 5', 'Req 6', 'Req 7', 'Req 8', 'Req 9', 'Req 10',
];
const CASE_REQUIRED_REQS = new Set(['Req 4', 'Req 5', 'Req 6', 'Req 7', 'Req 8', 'Req 9', 'Req 10']);

const reqMeta: Record<string, { title: string; hint: string }> = {
  'Req 1': { title: 'Hello world app', hint: 'Verify app boot on the target runtime and show the base screen.' },
  'Req 2': { title: 'Hello styles', hint: 'Show style tokens: typography, colors, icons, badges, and buttons.' },
  'Req 3': { title: 'Role dashboard', hint: 'Organize cases by status and switch role-specific actions.' },
  'Req 4': { title: 'Manual declarant entry', hint: 'Create/open a case and manually fill fixed declarant fields.' },
  'Req 5': { title: 'Multi-file upload', hint: 'Upload at least 3 PDFs and switch across document tabs.' },
  'Req 6': { title: 'Evidence linking', hint: 'Link one declarant field to a region/value from an active PDF.' },
  'Req 7': { title: 'Send-file validation', hint: 'Show missing value/link and mismatch checks before send.' },
  'Req 8': { title: 'Review matrix', hint: 'Display fields x document types and per-cell state.' },
  'Req 9': { title: 'Field inspection', hint: 'Open focused detail view with linked evidence context.' },
  'Req 10': { title: 'Routing and realtime', hint: 'Route cases between roles, comments, and notifications.' },
};

const fieldLabels: Record<keyof DeclarantFields, string> = {
  companyName: 'Company Name',
  grossWeight: 'Gross Weight',
  invoiceNumber: 'Invoice Number',
  itemDescription: 'Item Description',
  quantity: 'Quantity',
};

const defaultFields: DeclarantFields = {
  companyName: '',
  grossWeight: '',
  invoiceNumber: '',
  itemDescription: '',
  quantity: '',
};

function makeProfile(caseId: string): CaseProfile {
  return {
    fields: {
      ...defaultFields,
    },
    uploadMode: 'separate',
    separateDocs: [],
    combinedDoc: null,
    docTargets: {},
    comments: [],
    notifications: [`${caseId} created in Draft. Add declarant values and upload files.`],
    evidenceLinks: [],
    visualLinks: [],
  };
}

const APP_STORAGE_KEY = 'hw5_port5176_state_v1';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const declarantOrder: Array<keyof DeclarantFields> = ['companyName', 'invoiceNumber', 'itemDescription', 'quantity', 'grossWeight'];

export default function Port5176App() {
  const saved =
    typeof window !== 'undefined' ? (JSON.parse(window.localStorage.getItem(APP_STORAGE_KEY) ?? 'null') as null | {
      cases: CaseItem[];
      caseProfiles: Record<string, CaseProfile>;
      selectedCase: string;
    }) : null;
  const [activeReq, setActiveReq] = useState('Req 1');
  const [role] = useState<Role>('Analyst');
  const [dashboardRole, setDashboardRole] = useState<DashboardRole>('Case Reviewer');
  const defaultCases: CaseItem[] = [
    { id: 'CASE-101', status: 'Draft', createdBy: 'Analyst' },
    { id: 'CASE-102', status: 'Ready for Review', createdBy: 'Analyst' },
    { id: 'CASE-103', status: 'Returned for Changes', createdBy: 'Reviewer' },
  ];
  const defaultProfiles: Record<string, CaseProfile> = {
    'CASE-101': makeProfile('CASE-101'),
    'CASE-102': makeProfile('CASE-102'),
    'CASE-103': makeProfile('CASE-103'),
  };
  const [cases, setCases] = useState<CaseItem[]>(saved?.cases ?? defaultCases);
  const [caseProfiles, setCaseProfiles] = useState<Record<string, CaseProfile>>(saved?.caseProfiles ?? defaultProfiles);
  const [selectedCase, setSelectedCase] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<DeclarantFields>(defaultFields);
  const [uploadMode, setUploadMode] = useState<'separate' | 'combined'>('separate');
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [allowSendWithExplanation, setAllowSendWithExplanation] = useState(false);
  const [sendExplanation, setSendExplanation] = useState('');
  const [selectedField, setSelectedField] = useState<keyof DeclarantFields>('companyName');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [docTargets, setDocTargets] = useState<Record<string, EvidenceTarget[]>>({});
  const [isPlacingRegion, setIsPlacingRegion] = useState(false);
  const [regionSizePct, setRegionSizePct] = useState(8);
  const [placingPoint, setPlacingPoint] = useState<{ xPct: number; yPct: number } | null>(null);
  const [draggingField, setDraggingField] = useState<keyof DeclarantFields | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [linkRenderTick, setLinkRenderTick] = useState(0);
  const [visualLinks, setVisualLinks] = useState<VisualLink[]>([]);
  const [links, setLinks] = useState<EvidenceLink[]>([]);
  const [modalField, setModalField] = useState<keyof DeclarantFields | null>(null);
  const [comments, setComments] = useState<string[]>(['Reviewer: Please add supporting link for invoice number.']);
  const [newComment, setNewComment] = useState('');
  const [notifications, setNotifications] = useState<string[]>(['Case CASE-102 moved to Ready for Review.']);

  const selectedCaseObj = cases.find((c) => c.id === selectedCase);
  const selectedProfile = caseProfiles[selectedCase];
  const separateDocs = selectedProfile?.separateDocs ?? [];
  const combinedDoc = selectedProfile?.combinedDoc ?? null;
  const displayDocNames = uploadMode === 'separate' ? separateDocs.map((d) => d.name) : combinedDoc ? [combinedDoc.name] : [];
  const req6Docs = uploadMode === 'combined' ? (combinedDoc ? [combinedDoc] : []) : separateDocs;
  const req6DocNames = req6Docs.map((d) => d.name);
  const req6ActiveDoc = req6Docs[activeDocIndex] ?? null;
  const req6ActiveDocName = req6ActiveDoc?.name ?? req6DocNames[0] ?? '';
  const req6PdfUrl = req6ActiveDoc?.dataUrl ?? null;
  const modalActiveLink = modalField ? links.find((l) => l.field === modalField) : null;
  const modalPdfDoc = modalActiveLink ? [...separateDocs, ...(combinedDoc ? [combinedDoc] : [])].find((d) => d.name === modalActiveLink.documentName) : null;
  const modalPdfUrl = modalPdfDoc?.dataUrl ?? null;
  const modalTarget = modalActiveLink
    ? (docTargets[modalActiveLink.documentName] ?? []).find((t) =>
        modalActiveLink.targetId ? t.id === modalActiveLink.targetId : t.label === modalActiveLink.region,
      )
    : null;

  const matrixRows = (Object.keys(fieldLabels) as Array<keyof DeclarantFields>).map((field) => {
    return displayDocNames.slice(0, 3).map((docName) => {
      const linked = links.find((l) => l.field === field && l.documentName === docName);
      if (!linked) return 'not-linked';
      if (fields[field] && linked.evidenceValue && fields[field].trim() !== linked.evidenceValue.trim()) return 'conflict';
      return 'linked';
    });
  });

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    (Object.keys(fieldLabels) as Array<keyof DeclarantFields>).forEach((field) => {
      if (!fields[field].trim()) issues.push(`${fieldLabels[field]} is missing.`);
      if (!links.some((l) => l.field === field)) issues.push(`${fieldLabels[field]} has no evidence link.`);
      const mismatch = links.find((l) => l.field === field && fields[field].trim() && l.evidenceValue.trim() !== fields[field].trim());
      if (mismatch) issues.push(`${fieldLabels[field]} mismatches linked evidence in ${mismatch.documentName}.`);
    });
    return issues;
  }, [fields, links]);
  const completedFieldCount = (Object.keys(fieldLabels) as Array<keyof DeclarantFields>).filter(
    (field) => fields[field].trim().length > 0,
  ).length;
  const linkedFieldCount = (Object.keys(fieldLabels) as Array<keyof DeclarantFields>).filter((field) =>
    links.some((l) => l.field === field),
  ).length;
  const activeDocument = uploadMode === 'combined' ? combinedDoc : separateDocs[activeDocIndex];
  const activePdfUrl = activeDocument?.dataUrl ?? null;
  const visibleTargets = useMemo(() => (req6ActiveDocName ? docTargets[req6ActiveDocName] ?? [] : []), [req6ActiveDocName, docTargets]);
  const linkingCanvasRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedCaseRef = useRef<string>(selectedCase);

  useEffect(() => {
    if (activeDocIndex >= req6Docs.length) {
      setActiveDocIndex(0);
    }
  }, [activeDocIndex, req6Docs.length]);

  useLayoutEffect(() => {
    setLinkRenderTick((t) => t + 1);
  }, [req6ActiveDocName, visibleTargets.length, selectedCase]);

  function switchUploadMode(mode: 'separate' | 'combined') {
    setUploadMode(mode);
    setActiveDocIndex(0);
    setCaseProfiles((prev) => {
      const existing = prev[selectedCase] ?? makeProfile(selectedCase);
      if (mode === 'separate') {
        return { ...prev, [selectedCase]: { ...existing, uploadMode: mode, combinedDoc: null } };
      }
      return { ...prev, [selectedCase]: { ...existing, uploadMode: mode, separateDocs: [] } };
    });
  }

  async function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    const converted: StoredDoc[] = await Promise.all(
      chosen.map(async (file) => ({
        name: file.name,
        mimeType: file.type || 'application/pdf',
        dataUrl: await fileToDataUrl(file),
      })),
    );
    setCaseProfiles((prev) => {
      const existing = prev[selectedCase] ?? makeProfile(selectedCase);
      return { ...prev, [selectedCase]: { ...existing, uploadMode: 'separate', separateDocs: converted, combinedDoc: null } };
    });
    setUploadMode('separate');
    setActiveDocIndex(0);
  }

  async function handleCombinedFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (!chosen) return;
    const converted: StoredDoc = {
      name: chosen.name,
      mimeType: chosen.type || 'application/pdf',
      dataUrl: await fileToDataUrl(chosen),
    };
    setCaseProfiles((prev) => {
      const existing = prev[selectedCase] ?? makeProfile(selectedCase);
      return { ...prev, [selectedCase]: { ...existing, uploadMode: 'combined', combinedDoc: converted, separateDocs: [] } };
    });
    setUploadMode('combined');
    setActiveDocIndex(0);
  }

  function createLinkFromTarget(field: keyof DeclarantFields, targetId: string) {
    const target = visibleTargets.find((t) => t.id === targetId);
    if (!target || !target.docName) return;
    setVisualLinks((prev) => [...prev.filter((l) => l.field !== field), { field, targetId, docName: target.docName }]);
    setLinks((prev) => [
      ...prev.filter((l) => l.field !== field),
      { field, documentName: target.docName, region: target.label, evidenceValue: target.value, targetId: target.id },
    ]);
  }

  function addRegionMarkerAt(xPct: number, yPct: number) {
    if (!req6ActiveDocName || !Number.isFinite(xPct) || !Number.isFinite(yPct)) return;
    setDocTargets((prev) => {
      const existing = prev[req6ActiveDocName] ?? [];
      const next: EvidenceTarget = {
        id: `region-${Date.now()}`,
        docName: req6ActiveDocName,
        label: `Region ${existing.length + 1}`,
        value: 'Manual region selection',
        xPct,
        yPct,
        sizePct: regionSizePct,
      };
      setSelectedTargetId(next.id);
      return {
        ...prev,
        [req6ActiveDocName]: [...existing, next],
      };
    });
    setIsPlacingRegion(false);
    setPlacingPoint(null);
  }

  function updateSelectedRegionSize(sizePct: number) {
    if (!req6ActiveDocName || !selectedTargetId) return;
    setDocTargets((prev) => ({
      ...prev,
      [req6ActiveDocName]: (prev[req6ActiveDocName] ?? []).map((t) => (t.id === selectedTargetId ? { ...t, sizePct } : t)),
    }));
  }

  function deleteSelectedRegion() {
    if (!req6ActiveDocName || !selectedTargetId) return;
    const target = (docTargets[req6ActiveDocName] ?? []).find((t) => t.id === selectedTargetId);
    setDocTargets((prev) => ({
      ...prev,
      [req6ActiveDocName]: (prev[req6ActiveDocName] ?? []).filter((t) => t.id !== selectedTargetId),
    }));
    if (target) {
      setLinks((prev) =>
        prev.filter((l) => !(l.documentName === req6ActiveDocName && (l.targetId ? l.targetId === selectedTargetId : l.region === target.label))),
      );
    }
    setVisualLinks((prev) => prev.filter((v) => v.targetId !== selectedTargetId));
    setSelectedTargetId('');
  }

  function createCaseFromDashboard() {
    const id = `CASE-${100 + cases.length + 1}`;
    const next: CaseItem = { id, status: 'Draft', createdBy: role };
    setCases((prev) => [...prev, next]);
    setCaseProfiles((prev) => ({ ...prev, [id]: makeProfile(id) }));
    setSelectedCase(id);
    setToastMessage(`Active case changed to ${id}`);
  }

  function activateCase(caseId: string) {
    setSelectedCase(caseId);
    setToastMessage(`Active case changed to ${caseId}`);
  }

  function resetActiveCase() {
    if (!selectedCase) return;
    const caseId = selectedCase;
    // Deactivate current case first so no persisted case data is overwritten.
    setSelectedCase('');
    // Clear only in-memory tab state; stored case profile remains intact.
    setFields(defaultFields);
    setLinks([]);
    setVisualLinks([]);
    setDocTargets({});
    setComments([]);
    setNotifications([]);
    setUploadMode('separate');
    setActiveDocIndex(0);
    setToastMessage(`${caseId} deactivated. Case data is preserved.`);
  }

  function startFieldDrag(field: keyof DeclarantFields, event: React.MouseEvent) {
    if (!linkingCanvasRef.current) return;
    const bounds = linkingCanvasRef.current.getBoundingClientRect();
    setSelectedField(field);
    setDraggingField(field);
    setDragPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }

  function updateDrag(event: React.MouseEvent) {
    if (!draggingField || !linkingCanvasRef.current) return;
    const bounds = linkingCanvasRef.current.getBoundingClientRect();
    setDragPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }

  function finishDrag(event: React.MouseEvent) {
    if (!draggingField) return;
    const node = (event.target as HTMLElement).closest('[data-target-id]') as HTMLElement | null;
    if (node) {
      const targetId = node.dataset.targetId;
      if (targetId) createLinkFromTarget(draggingField, targetId);
    }
    setDraggingField(null);
    setDragPoint(null);
  }

  function routeCase(next: CaseStatus) {
    if (!selectedCaseObj) return;
    setCases((prev) => prev.map((c) => (c.id === selectedCaseObj.id ? { ...c, status: next } : c)));
    setNotifications((prev) => [`${selectedCaseObj.id} routed to ${next}.`, ...prev]);
    setToastMessage(`${selectedCaseObj.id} moved to ${next}`);
  }

  function sendComment() {
    if (!newComment.trim()) return;
    const entry = `${role}: ${newComment.trim()}`;
    setComments((prev) => [entry, ...prev]);
    setNotifications((prev) => [`New comment on ${selectedCase}.`, ...prev]);
    setCaseProfiles((prev) => {
      const existing = prev[selectedCase] ?? makeProfile(selectedCase);
      return {
        ...prev,
        [selectedCase]: {
          ...existing,
          comments: [entry, ...(existing.comments ?? [])],
          notifications: [`New comment on ${selectedCase}.`, ...(existing.notifications ?? [])],
        },
      };
    });
    setNewComment('');
  }

  function confirmSendFiles() {
    const hasIssues = validationIssues.length > 0;
    if (hasIssues) {
      if (!allowSendWithExplanation || !sendExplanation.trim()) return;
      setNotifications((prev) => [`Send override used for ${selectedCase}: ${sendExplanation.trim()}`, ...prev]);
    }
    if (selectedCaseObj) {
      setCases((prev) => prev.map((c) => (c.id === selectedCaseObj.id ? { ...c, status: 'Ready for Review' } : c)));
      setNotifications((prev) => [`${selectedCaseObj.id} submitted to Lead Reviewer (Ready for Review).`, ...prev]);
      setToastMessage(`${selectedCaseObj.id} submitted to Lead Reviewer`);
      setCaseProfiles((prev) => {
        const reset = makeProfile(selectedCaseObj.id);
        return {
          ...prev,
          [selectedCaseObj.id]: {
            ...reset,
            notifications: [`${selectedCaseObj.id} submitted to Lead Reviewer (Ready for Review).`],
          },
        };
      });
      setFields(defaultFields);
      setLinks([]);
      setVisualLinks([]);
      setDocTargets({});
      setComments([]);
    }
    setSendModalOpen(false);
    setAllowSendWithExplanation(false);
    setSendExplanation('');
  }

  useEffect(() => {
    if (!selectedProfile) return;
    setFields(selectedProfile.fields);
    setComments(selectedProfile.comments);
    setNotifications(selectedProfile.notifications);
    setLinks(selectedProfile.evidenceLinks ?? []);
    setVisualLinks(selectedProfile.visualLinks ?? []);
    setDocTargets(selectedProfile.docTargets ?? {});
    setUploadMode(selectedProfile.uploadMode ?? 'separate');
    setActiveDocIndex(0);
  }, [selectedCase]);

  useEffect(() => {
    if (!selectedCase) return;
    setCaseProfiles((prev) => {
      const existing = prev[selectedCase] ?? makeProfile(selectedCase);
      return {
        ...prev,
        [selectedCase]: { ...existing, fields, comments, notifications, uploadMode, evidenceLinks: links, visualLinks, docTargets },
      };
    });
  }, [selectedCase, fields, comments, notifications, uploadMode, links, visualLinks, docTargets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        cases,
        caseProfiles,
        selectedCase,
      }),
    );
  }, [cases, caseProfiles, selectedCase]);

  useEffect(() => {
    selectedCaseRef.current = selectedCase;
  }, [selectedCase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== APP_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          cases: CaseItem[];
          caseProfiles: Record<string, CaseProfile>;
          selectedCase: string;
        };
        setCases(parsed.cases);
        setCaseProfiles(parsed.caseProfiles);
        const currentCaseId = selectedCaseRef.current;
        const nextCaseId = parsed.caseProfiles[currentCaseId] ? currentCaseId : parsed.selectedCase;
        const nextProfile = parsed.caseProfiles[nextCaseId];
        setSelectedCase(nextCaseId);
        if (nextProfile) {
          setFields(nextProfile.fields);
          setComments(nextProfile.comments);
          setNotifications(nextProfile.notifications);
          setLinks(nextProfile.evidenceLinks ?? []);
          setVisualLinks(nextProfile.visualLinks ?? []);
          setDocTargets(nextProfile.docTargets ?? {});
          setUploadMode(nextProfile.uploadMode ?? 'separate');
          setActiveDocIndex(0);
        }
      } catch {
        // ignore invalid storage payloads
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (!selectedCase && CASE_REQUIRED_REQS.has(activeReq)) {
      setActiveReq('Req 1');
    }
  }, [selectedCase, activeReq]);

  return (
    <div className="p5176-page">
      <header className="p5176-header">
        <div className="p5176-headerLeft">
          <h1>Assignment 5 Implementation Prototypes</h1>
          <p>This 5176 workspace implements only the updated requirements, each as a separate testable prototype step.</p>
        </div>
        <div className="p5176-headerRight">
          <div className="p5176-badge">
            Active: <span>{activeReq}</span>
          </div>
          <div className="p5176-badge">
            Case: <span>{selectedCase || 'None'}</span>
          </div>
          <button className="p5176-headerResetBtn" onClick={resetActiveCase} disabled={!selectedCaseObj}>
            Reset Status
          </button>
        </div>
      </header>

      <div className="p5176-layout">
        <aside className="p5176-steps">
          <div className="p5176-stepsTitle">Requirement Steps</div>
          {reqTabs.map((tab, idx) => (
            <button
              key={tab}
              className={`p5176-step ${tab === activeReq ? 'active' : ''}`}
              onClick={() => setActiveReq(tab)}
              disabled={!selectedCase && CASE_REQUIRED_REQS.has(tab)}
              title={!selectedCase && CASE_REQUIRED_REQS.has(tab) ? 'Activate a case from Req 3 dashboard first.' : undefined}
            >
              <div className="p5176-stepReq">{tab}</div>
              <div className="p5176-stepRow">
                <div className="p5176-stepIndex">{idx + 1}</div>
                <div className="p5176-stepTitle">{reqMeta[tab].title}</div>
              </div>
              <div className="p5176-stepHint">{reqMeta[tab].hint}</div>
            </button>
          ))}
        </aside>

        <section className="p5176-content">
          <div className="p5176-currentHint">
            <strong>What to do now:</strong> {reqMeta[activeReq].hint}
          </div>

          {activeReq === 'Req 1' ? (
        <section className="p5176-card">
          <h2>Req 1 - Hello world app</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Objective</span>
            <span className="req-note">Confirm the app boots on the intended device/runtime.</span>
          </div>
          <div className="panel-grid">
            <div className="panel">
              <h3>Runtime Check</h3>
              <p>Hello world from the target web runtime on localhost:5176.</p>
            </div>
            <div className="panel">
              <h3>Evidence to Capture</h3>
              <ul className="clean-list">
                <li>Open app URL on target environment.</li>
                <li>Show initial render without errors.</li>
                <li>Capture short clip or screenshot.</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {activeReq === 'Req 2' ? (
        <section className="p5176-card">
          <h2>Req 2 - Hello styles</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Objective</span>
            <span className="req-note">Demonstrate style tokens used in the final UI system.</span>
          </div>
          <div className="style-row">
            <span className="swatch primary">Primary</span>
            <span className="swatch accent">Accent</span>
            <span className="swatch warn">Warning</span>
            <span className="badge">Status badge</span>
            <button className="btn-main">Primary button</button>
            <button className="btn-alt">Secondary button</button>
          </div>
          <p className="style-font-1">Typography level 1</p>
          <p className="style-font-2">Typography level 2</p>
          <p>Icon samples: 🧾 📎 ✅ ⚠️</p>
          <div className="metric-grid">
            <div className="metric-card"><strong>Colors</strong><span>3 swatches + badge</span></div>
            <div className="metric-card"><strong>Typography</strong><span>2 hierarchy levels</span></div>
            <div className="metric-card"><strong>Components</strong><span>Primary and secondary actions</span></div>
          </div>
        </section>
      ) : null}

      {activeReq === 'Req 3' ? (
        <section className="p5176-card">
          <h2>Req 3 - Role dashboards and case organization</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Dashboard Flow</span>
            <span className="req-note">
              Dashboard style and visible states change by role.
            </span>
          </div>
          <div className="toolbar">
            <div className="toolbar-left">
              <button className="btn-main" onClick={createCaseFromDashboard}>Create Case (Draft)</button>
              <button onClick={() => routeCase('Ready for Review')} disabled={dashboardRole !== 'Case Reviewer'}>
                Send to Lead Reviewer (Case Reviewer)
              </button>
              <button onClick={() => routeCase('Returned for Changes')} disabled={dashboardRole !== 'Lead Reviewer'}>
                Return to Case Reviewer (Lead Reviewer)
              </button>
              <button onClick={() => routeCase('Ready to Submit')} disabled={dashboardRole !== 'Lead Reviewer'}>
                Submit to CEO (Lead Reviewer)
              </button>
              <button onClick={() => routeCase('Submitted')} disabled={dashboardRole !== 'CEO'}>
                Submit to Customs (CEO only)
              </button>
            </div>
            <div className="toolbar-right">
              <label>
                Role View
                <select value={dashboardRole} onChange={(e) => setDashboardRole(e.target.value as DashboardRole)}>
                  <option>Case Reviewer</option>
                  <option>Lead Reviewer</option>
                  <option>CEO</option>
                </select>
              </label>
              <span className="inline-note">Active Case: {selectedCase}</span>
            </div>
          </div>
          {dashboardRole === 'Case Reviewer' ? (
            <div className="reviewer-dashboard">
              <div className="reviewer-left">
                <div className="reviewer-panel">
                  <h3>Open Cases</h3>
                  {cases
                    .filter((c) => c.status === 'Draft' || c.status === 'Returned for Changes')
                    .map((c) => (
                      <button key={c.id} className="queue-row queue-rowBtn" onClick={() => activateCase(c.id)}>
                        <strong>{c.id}</strong>
                        <span className={`status-pill ${c.status === 'Draft' ? 'pill-draft' : 'pill-returned'}`}>{c.status}</span>
                      </button>
                    ))}
                </div>
                <div className="reviewer-panel">
                  <h3>File Upload</h3>
                  <p className="inline-note">Create a case, then upload files in Req 5 for this active case.</p>
                  <button className="btn-main" onClick={createCaseFromDashboard}>+ Create Case</button>
                </div>
              </div>
              <div className="reviewer-right">
                <div className="reviewer-panel">
                  <h3>Recent Activity</h3>
                  <ul className="clean-list">
                    {notifications.slice(0, 5).map((n, idx) => (
                      <li key={`act-${idx}`}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="ceo-board">
              {[
                { title: 'Missing Ev.', status: 'Draft' as CaseStatus, tone: 'pill-returned' },
                { title: 'Drafting', status: 'Draft' as CaseStatus, tone: 'pill-draft' },
                { title: 'Ready For Review', status: 'Ready for Review' as CaseStatus, tone: 'pill-review' },
                { title: 'Returned (Fix)', status: 'Returned for Changes' as CaseStatus, tone: 'pill-returned' },
                { title: 'Completed', status: 'Ready to Submit' as CaseStatus, tone: 'pill-submit' },
              ]
                .filter((col) => !(dashboardRole === 'Lead Reviewer' && col.title === 'Completed'))
                .map((col) => (
                  <div key={col.title} className="ceo-col">
                    <div className="ceo-col-head">{col.title}</div>
                    {cases
                      .filter((c) => c.status === col.status)
                      .map((c) => (
                        <button key={`ceo-${c.id}`} className="ceo-card" onClick={() => activateCase(c.id)}>
                          <div className="ceo-card-top">
                            <strong>{c.id}</strong>
                            <span className={`status-pill ${col.tone}`}>{c.status}</span>
                          </div>
                          <div className="inline-note">
                            {caseProfiles[c.id]?.uploadMode === 'combined'
                              ? caseProfiles[c.id]?.combinedDoc?.name ?? 'No files'
                              : (caseProfiles[c.id]?.separateDocs ?? []).map((d) => d.name).join(', ') || 'No files'}
                          </div>
                        </button>
                      ))}
                  </div>
                ))}
            </div>
          )}
        </section>
      ) : null}

      {activeReq === 'Req 4' ? (
        <section className="p5176-card">
          <h2>Req 4 - Case creation and manual declarant entry</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Progress</span>
            <span className="req-note">
              {completedFieldCount}/5 declarant fields completed.
            </span>
          </div>
          <div className="form-grid">
            {(Object.keys(fieldLabels) as Array<keyof DeclarantFields>).map((field) => (
              <label key={field}>
                {fieldLabels[field]}
                <input
                  value={fields[field]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={`Enter ${fieldLabels[field]}`}
                />
              </label>
            ))}
          </div>
          <div className="metric-grid">
            <div className="metric-card"><strong>Case</strong><span>{selectedCase}</span></div>
            <div className="metric-card"><strong>Completion</strong><span>{Math.round((completedFieldCount / 5) * 100)}%</span></div>
            <div className="metric-card"><strong>Required Fields</strong><span>Company, Weight, Invoice, Item, Quantity</span></div>
          </div>
        </section>
      ) : null}

      {activeReq === 'Req 5' ? (
        <section className="p5176-card">
          <h2>Req 5 - Multi-file PDF upload and tabs</h2>
          <div className="req-kicker">
            <span
              className={`status-pill ${
                uploadMode === 'separate' ? (separateDocs.length >= 3 ? 'pill-submit' : 'pill-returned') : combinedDoc ? 'pill-submit' : 'pill-returned'
              }`}
            >
              {uploadMode === 'separate' ? (separateDocs.length >= 3 ? 'Ready' : 'Pending') : combinedDoc ? 'Ready' : 'Pending'}
            </span>
            <span className="req-note">
              Separate mode: upload at least 3 PDFs with tabs. Combined mode: upload one merged PDF.
            </span>
          </div>
          <div className="toolbar req5-mode-toggle">
            <label className="radio-inline">
              <input
                type="radio"
                name="uploadMode"
                checked={uploadMode === 'separate'}
                onChange={() => switchUploadMode('separate')}
              />
              Separate PDFs
            </label>
            <label className="radio-inline">
              <input
                type="radio"
                name="uploadMode"
                checked={uploadMode === 'combined'}
                onChange={() => switchUploadMode('combined')}
              />
              One combined PDF
            </label>
          </div>
          <div className="panel-grid">
            <div className="panel">
              <h3>Upload Controls</h3>
              {uploadMode === 'separate' ? (
                <>
                  <input type="file" accept="application/pdf" multiple onChange={handleFilesChange} />
                  <p className="inline-note">Uploaded documents: {separateDocs.length}</p>
                </>
              ) : (
                <>
                  <input type="file" accept="application/pdf" onChange={handleCombinedFileChange} />
                  <p className="inline-note">Combined document: {combinedDoc?.name ?? 'None'}</p>
                </>
              )}
            </div>
            <div className="panel">
              <h3>Active Document</h3>
              <p className="inline-note">{activeDocument?.name ?? 'No document selected yet.'}</p>
            </div>
          </div>
          {uploadMode === 'separate' ? (
            <div className="doc-tablist">
              {separateDocs.map((doc, idx) => (
                <button key={doc.name + idx} className={idx === activeDocIndex ? 'active-doc' : ''} onClick={() => setActiveDocIndex(idx)}>
                  {doc.name}
                </button>
              ))}
            </div>
          ) : null}
          <p>Active tab document: {activeDocument?.name ?? displayDocNames[activeDocIndex] ?? 'None'}</p>
          <div className="pdf-previewWrap">
            <h3>PDF Preview</h3>
            {activePdfUrl ? (
              <iframe title="Active PDF preview" src={activePdfUrl} className="pdf-previewFrame" />
            ) : (
              <p className="inline-note">Upload a PDF to preview it here.</p>
            )}
          </div>
        </section>
      ) : null}

      {activeReq === 'Req 6' ? (
        <section className="p5176-card">
          <h2>Req 6 - Manual evidence linking</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Linked Fields</span>
            <span className="req-note">{linkedFieldCount}/5 fields currently linked to evidence.</span>
          </div>
          {req6DocNames.length === 0 ? <p className="inline-note">Upload PDFs in Req 5 first. Req 6 tabs and preview come from uploaded files.</p> : null}
          <div className="linking-canvas" ref={linkingCanvasRef} onMouseMove={updateDrag} onMouseUp={finishDrag} onMouseLeave={finishDrag}>
            <svg className="linking-svg">
              {visualLinks
                .filter((link) => link.docName === req6ActiveDocName)
                .map((link) => {
                  void linkRenderTick;
                  const fieldEl = fieldRefs.current[link.field];
                  const targetEl = targetRefs.current[link.targetId];
                  const rootEl = linkingCanvasRef.current;
                  if (!fieldEl || !targetEl || !rootEl) return null;
                  const root = rootEl.getBoundingClientRect();
                  const f = fieldEl.getBoundingClientRect();
                  const t = targetEl.getBoundingClientRect();
                  const x1 = f.right - root.left;
                  const y1 = f.top + f.height / 2 - root.top;
                  const x2 = t.left - root.left;
                  const y2 = t.top + t.height / 2 - root.top;
                  return <line key={`${link.field}-${link.targetId}`} x1={x1} y1={y1} x2={x2} y2={y2} className="link-line" />;
                })}
              {draggingField && dragPoint && fieldRefs.current[draggingField] && linkingCanvasRef.current ? (
                (() => {
                  const root = linkingCanvasRef.current.getBoundingClientRect();
                  const f = fieldRefs.current[draggingField]!.getBoundingClientRect();
                  const x1 = f.right - root.left;
                  const y1 = f.top + f.height / 2 - root.top;
                  return <line x1={x1} y1={y1} x2={dragPoint.x} y2={dragPoint.y} className="link-line link-line-drag" />;
                })()
              ) : null}
            </svg>
            <div className="linking-left">
              <div className="linking-title">Declarant</div>
              {declarantOrder.map((field) => {
                const link = links.find((l) => l.field === field);
                return (
                  <div
                    key={field}
                    ref={(el) => {
                      fieldRefs.current[field] = el;
                    }}
                    className={`decl-row ${selectedField === field ? 'active' : ''}`}
                    onClick={() => setSelectedField(field)}
                  >
                    <div>
                      <div className="decl-label">{fieldLabels[field]}</div>
                      <div className="decl-value">{fields[field] || '(empty value)'}</div>
                    </div>
                    <button
                      type="button"
                      className={`decl-linkBtn ${link ? 'linked' : ''}`}
                      onMouseDown={(e) => startFieldDrag(field, e)}
                    >
                      {link ? 'Relink' : 'Drag'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="linking-right">
              <div className="doc-tabs">
                {req6DocNames.map((docName, idx) => (
                  <button key={docName} className={idx === activeDocIndex ? 'active' : ''} onClick={() => setActiveDocIndex(idx)}>
                    {docName}
                  </button>
                ))}
              </div>
              <div className="invoice-box">
                <div className="pdf-header">{req6ActiveDocName || 'No uploaded PDF selected'}</div>
                {req6PdfUrl ? (
                  <div
                    className={`req6-pdf-stage ${isPlacingRegion ? 'placing' : ''}`}
                    onClick={(e) => {
                      if (!isPlacingRegion) return;
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                      addRegionMarkerAt(Math.max(0, Math.min(100, xPct)), Math.max(0, Math.min(100, yPct)));
                    }}
                    onMouseMove={(e) => {
                      if (!isPlacingRegion) return;
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                      setPlacingPoint({ xPct: Math.max(0, Math.min(100, xPct)), yPct: Math.max(0, Math.min(100, yPct)) });
                    }}
                    onMouseLeave={() => {
                      if (isPlacingRegion) setPlacingPoint(null);
                    }}
                  >
                    <iframe title="Req6 active PDF" src={req6PdfUrl} className="req6-pdf-frame" />
                    <div className="req6-annotation-layer">
                      {visibleTargets.map((row) => (
                        <button
                          key={`mk-${row.id}`}
                          ref={(el) => {
                            targetRefs.current[row.id] = el as HTMLDivElement | null;
                          }}
                          data-target-id={row.id}
                          className={`req6-marker ${selectedTargetId === row.id ? 'active' : ''}`}
                          style={{ left: `${row.xPct}%`, top: `${row.yPct}%`, width: `${row.sizePct}%`, height: `${row.sizePct}%` }}
                          aria-label={row.label}
                          title={row.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTargetId(row.id);
                          }}
                        />
                      ))}
                      {isPlacingRegion && placingPoint ? (
                        <div
                          className="req6-marker req6-marker-ghost"
                          style={{ left: `${placingPoint.xPct}%`, top: `${placingPoint.yPct}%`, width: `${regionSizePct}%`, height: `${regionSizePct}%` }}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {!req6ActiveDocName ? (
                  <p className="inline-note">No file uploaded. Upload PDFs in Req 5 to start linking evidence.</p>
                ) : (
                  <>
                    <div className="row">
                      <button onClick={() => setIsPlacingRegion(true)}>Add Region Marker</button>
                      <label className="inline-slider">
                        Circle size
                        <input
                          type="range"
                          min={4}
                          max={20}
                          value={regionSizePct}
                          onChange={(e) => setRegionSizePct(Number(e.target.value))}
                        />
                        <span>{regionSizePct}%</span>
                      </label>
                      <span className="inline-note">
                        {isPlacingRegion ? 'Click on the PDF preview to place marker.' : 'No predetermined values are shown for uploaded PDFs.'}
                      </span>
                    </div>
                    {selectedTargetId ? (
                      <div className="row">
                        <label className="inline-slider">
                          Selected marker size
                          <input
                            type="range"
                            min={4}
                            max={20}
                            value={(visibleTargets.find((t) => t.id === selectedTargetId)?.sizePct ?? regionSizePct)}
                            onChange={(e) => updateSelectedRegionSize(Number(e.target.value))}
                          />
                          <span>{visibleTargets.find((t) => t.id === selectedTargetId)?.sizePct ?? regionSizePct}%</span>
                        </label>
                        <button onClick={deleteSelectedRegion}>Delete Selected Region</button>
                      </div>
                    ) : null}
                    {visibleTargets.length === 0 ? <p className="inline-note">No region markers yet.</p> : null}
                    {visibleTargets.map((row) => (
                      <div
                        key={row.id}
                        data-target-id={row.id}
                        className={`evidence-row ${selectedTargetId === row.id ? 'active' : ''}`}
                        onClick={() => setSelectedTargetId(row.id)}
                      >
                        <strong>{row.label}</strong>
                        <span>{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="row">
                <button
                  className="btn-main"
                  disabled={!req6ActiveDocName}
                  onClick={() => {
                    createLinkFromTarget(selectedField, selectedTargetId);
                  }}
                >
                  Link Selected Field to Highlighted Section
                </button>
                <span className="inline-note">Drag from left handle to a row on the right PDF content.</span>
              </div>
            </div>
          </div>
          <ul className="clean-list">
            {links.map((l, idx) => (
              <li key={`${l.field}-${l.documentName}-${idx}`}>
                {fieldLabels[l.field]} to {l.documentName} ({l.region}) = "{l.evidenceValue}"
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeReq === 'Req 7' ? (
        <section className="p5176-card">
          <h2>Req 7 - Send-file validation</h2>
          <div className="req-kicker">
            <span className={`status-pill ${validationIssues.length > 0 ? 'pill-returned' : 'pill-submit'}`}>
              {validationIssues.length > 0 ? 'Blocked' : 'Ready'}
            </span>
            <span className="req-note">Checks: missing values, missing links, and value/evidence mismatches.</span>
          </div>
          <button className="btn-main" onClick={() => setSendModalOpen(true)}>Send Files</button>
          {validationIssues.length > 0 ? (
            <ul className="errors clean-list">
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p className="ok">Ready to send: all checks passed.</p>
          )}
          {sendModalOpen ? (
            <div className="send-modal-overlay">
              <div className="send-modal">
                <div className="send-modal-head">
                  <h3>Send files</h3>
                  <button onClick={() => setSendModalOpen(false)}>x</button>
                </div>
                {validationIssues.length > 0 ? (
                  <>
                    <div className="send-warning">
                      <span className="status-pill pill-returned">Warning</span>
                      <strong>Issues found before sending</strong>
                    </div>
                    <ul className="clean-list errors">
                      {validationIssues.map((issue) => (
                        <li key={`send-${issue}`}>{issue}</li>
                      ))}
                    </ul>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={allowSendWithExplanation}
                        onChange={(e) => setAllowSendWithExplanation(e.target.checked)}
                      />
                      Add explanation and send with exceptions
                    </label>
                    {allowSendWithExplanation ? (
                      <textarea
                        className="send-explanation"
                        value={sendExplanation}
                        onChange={(e) => setSendExplanation(e.target.value)}
                        placeholder="Explain why this case should still be sent."
                      />
                    ) : null}
                  </>
                ) : (
                  <p className="ok">No blocking issues. This case is ready to move to Ready for Review.</p>
                )}
                <div className="send-modal-actions">
                  <button onClick={() => setSendModalOpen(false)}>Cancel</button>
                  <button
                    className="btn-main"
                    onClick={confirmSendFiles}
                    disabled={validationIssues.length > 0 && (!allowSendWithExplanation || !sendExplanation.trim())}
                  >
                    Send Files
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeReq === 'Req 8' ? (
        <section className="p5176-card">
          <h2>Req 8 - Review matrix</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Matrix</span>
            <span className="req-note">Rows are declarant fields, columns are supporting documents.</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  {displayDocNames.slice(0, 3).map((docName) => (
                    <th key={docName}>{docName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(fieldLabels) as Array<keyof DeclarantFields>).map((field, r) => (
                  <tr key={field}>
                    <td>{fieldLabels[field]}</td>
                    {matrixRows[r].map((state, c) => (
                      <td key={`${field}-${c}`} className={`cell-${state}`}>{state}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeReq === 'Req 9' ? (
        <section className="p5176-card">
          <h2>Req 9 - Field inspection modal</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Inspection</span>
            <span className="req-note">Open any field to inspect value, link status, and evidence region.</span>
          </div>
          <div className="row">
            {(Object.keys(fieldLabels) as Array<keyof DeclarantFields>).map((field) => (
              <button key={field} onClick={() => setModalField(field)}>
                Inspect {fieldLabels[field]}
              </button>
            ))}
          </div>
          {modalField ? (
            <div className="modal">
              <h3>{fieldLabels[modalField]}</h3>
              <p>Declared value: {fields[modalField] || '(empty)'}</p>
              <p>Link status: {links.some((l) => l.field === modalField) ? 'Linked' : 'Not linked'}</p>
              <ul>
                {links.filter((l) => l.field === modalField).map((l, idx) => (
                  <li key={`${l.documentName}-${idx}`}>
                    {l.documentName} | {l.region} | "{l.evidenceValue}"
                  </li>
                ))}
              </ul>
              {modalPdfUrl ? (
                <div className="modal-pdf-region">
                  <h4>Linked region with PDF view</h4>
                  <div className="modal-pdf-stage">
                    <iframe title="Req9 linked PDF preview" src={modalPdfUrl} className="req6-pdf-frame" />
                    {modalTarget ? (
                      <div
                        className="req6-marker active req9-marker"
                        style={{
                          left: `${modalTarget.xPct}%`,
                          top: `${modalTarget.yPct}%`,
                          width: `${modalTarget.sizePct}%`,
                          height: `${modalTarget.sizePct}%`,
                        }}
                        title={`Matched marker: ${modalTarget.label}`}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
              <button onClick={() => setModalField(null)}>Close</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeReq === 'Req 10' ? (
        <section className="p5176-card">
          <h2>Req 10 - Real-time comments, notifications, and routing</h2>
          <div className="req-kicker">
            <span className="status-pill pill-review">Realtime Simulation</span>
            <span className="req-note">Routing and chat update immediately without page refresh.</span>
          </div>
          <div className="row req10-actionsRow">
            <button onClick={() => routeCase('Ready for Review')} disabled={dashboardRole !== 'Case Reviewer'}>
              Send to Lead Reviewer (Case Reviewer)
            </button>
            <button onClick={() => routeCase('Returned for Changes')} disabled={dashboardRole !== 'Lead Reviewer'}>
              Return to Case Reviewer (Lead Reviewer)
            </button>
            <button onClick={() => routeCase('Ready to Submit')} disabled={dashboardRole !== 'Lead Reviewer'}>
              Submit to CEO (Lead Reviewer)
            </button>
            <button onClick={() => routeCase('Submitted')} disabled={dashboardRole !== 'CEO'}>
              Submit to Customs (CEO only)
            </button>
          </div>
          <div className="form-grid req10-commentRow">
            <label>
              New comment
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Type message..." />
            </label>
            <button onClick={sendComment}>Send Comment</button>
          </div>
          <div className="dash-grid req10-livePanels">
            <div>
              <h3>Live comments</h3>
              <ul>{comments.map((c, idx) => <li key={`${c}-${idx}`}>{c}</li>)}</ul>
            </div>
            <div>
              <h3>Live notifications</h3>
              <ul>{notifications.map((n, idx) => <li key={`${n}-${idx}`}>{n}</li>)}</ul>
            </div>
          </div>
        </section>
      ) : null}
        </section>
      </div>
      {toastMessage ? <div className="bottom-toast">{toastMessage}</div> : null}
    </div>
  );
}
