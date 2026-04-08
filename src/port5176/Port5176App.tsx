import { useState, useEffect, useRef, useCallback } from 'react';
import './port5176.css';
import { SEED_USERS, SEED_CASES } from './seedData';

// ============== TYPE DEFINITIONS ==============

type Role = 'writer' | 'lead_reviewer' | 'ceo';
type CaseStatus = 'drafting' | 'missing_ev' | 'ready_review' | 'returned' | 'completed';

type User = {
  email: string;
  role: Role;
  company: string;
  name: string;
};

type Notification = {
  id: string;
  message: string;
  caseId: string;
  timestamp: Date;
  read: boolean;
};

type DeclarantField =
  | 'hsCode'
  | 'originCountry'
  | 'destCountry'
  | 'invoiceAmount'
  | 'netWeight'
  | 'grossWeight'
  | 'exitCustoms'
  | 'iban'
  | 'others';

type DocumentType = 'invoice' | 'packageList' | 'atr' | 'insurance';

type EvidenceLink = {
  field: DeclarantField;
  docType: DocumentType;
  region: string;
  value: string;
  status: 'linked' | 'conflict' | 'stale';
};

type UploadedDoc = {
  name: string;
  docType: DocumentType;
  dataUrl: string;
};

type DocumentRegion = {
  id: string;
  docType: DocumentType;
  x: number;
  y: number;
};

type Case = {
  id: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  status: CaseStatus;
  fields: Record<DeclarantField, string>;
  docs: UploadedDoc[];
  links: EvidenceLink[];
  regions: DocumentRegion[];
  comments: Array<{ author: string; text: string; timestamp: Date }>;
};

type AppState = {
  user: User | null;
  cases: Case[];
  notifications: Notification[];
};

type View = 'login' | 'signup' | 'dashboard' | 'editor' | 'matrix';

// ============== MAIN APP COMPONENT ==============

export default function Port5176App() {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [matrixCaseId, setMatrixCaseId] = useState<string | null>(null);
  const [inspectingCell, setInspectingCell] = useState<{ field: DeclarantField; docType: DocumentType } | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Seed users and cases on first load
  useEffect(() => {
    const seeded = localStorage.getItem('seedApplied_v1');
    if (!seeded) {
      // Seed the 3 test users
      const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]') as Array<User & { password: string }>;
      const merged = [...existingUsers];
      for (const su of SEED_USERS) {
        if (!merged.some(u => u.email === su.email)) {
          merged.push(su);
        }
      }
      localStorage.setItem('registeredUsers', JSON.stringify(merged));
      // Seed cases (cast to correct types)
      setCases(SEED_CASES as unknown as Case[]);
      localStorage.setItem('seedApplied_v1', '1');
    }
  }, []);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('customsCaseManager');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState) as AppState;
        if (parsed.user) {
          setUser(parsed.user);
          setView('dashboard');
        }
        if (parsed.cases && parsed.cases.length > 0) {
          setCases(parsed.cases.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
            regions: c.regions || [],
            comments: c.comments.map(comment => ({
              ...comment,
              timestamp: new Date(comment.timestamp)
            }))
          })));
        }
        if (parsed.notifications) {
          setNotifications(parsed.notifications.map(n => ({
            ...n,
            timestamp: new Date(n.timestamp)
          })));
        }
      } catch {
        // Failed to parse saved state - start fresh
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state: AppState = { user, cases, notifications };
    localStorage.setItem('customsCaseManager', JSON.stringify(state));
  }, [user, cases, notifications]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setView('dashboard');
  };

  const handleSignup = (newUser: User) => {
    setUser(newUser);
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setView('login');
    setSelectedCaseId(null);
  };

  const handleOpenCase = (caseId: string) => {
    if (user?.role === 'writer') {
      setSelectedCaseId(caseId);
      setView('editor');
    } else {
      setMatrixCaseId(caseId);
      setView('matrix');
    }
  };

  const handleBackToDashboard = () => {
    setSelectedCaseId(null);
    setMatrixCaseId(null);
    setInspectingCell(null);
    setShowReturnModal(false);
    setView('dashboard');
  };

  const isFullscreen = view === 'dashboard' || view === 'editor' || view === 'matrix';

  return (
    <div className={`app-container${isFullscreen ? ' fullscreen' : ''}`}>
      {view === 'login' && (
        <LoginPage
          onLogin={handleLogin}
          onSwitchToSignup={() => setView('signup')}
        />
      )}
      {view === 'signup' && (
        <SignupPage
          onSignup={handleSignup}
          onSwitchToLogin={() => setView('login')}
        />
      )}
      {view === 'dashboard' && user && (
        <DashboardPage
          user={user}
          cases={cases}
          notifications={notifications}
          setCases={setCases}
          setNotifications={setNotifications}
          onLogout={handleLogout}
          onOpenCase={handleOpenCase}
        />
      )}
      {view === 'editor' && user && selectedCaseId && (
        <CaseEditorPage
          user={user}
          caseId={selectedCaseId}
          cases={cases}
          setCases={setCases}
          setNotifications={setNotifications}
          onBack={handleBackToDashboard}
        />
      )}
      {view === 'matrix' && user && matrixCaseId && (
        <ReviewMatrixPage
          user={user}
          caseId={matrixCaseId}
          cases={cases}
          setCases={setCases}
          setNotifications={setNotifications}
          inspectingCell={inspectingCell}
          setInspectingCell={setInspectingCell}
          showReturnModal={showReturnModal}
          setShowReturnModal={setShowReturnModal}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}

// ============== LOGIN PAGE ==============

interface LoginPageProps {
  onLogin: (user: User) => void;
  onSwitchToSignup: () => void;
}

function LoginPage({ onLogin, onSwitchToSignup }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    // Check registered users
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]') as Array<User & { password: string }>;
    const foundUser = registeredUsers.find(u => u.email === email && u.password === password);

    if (foundUser) {
      const { password: _, ...userWithoutPassword } = foundUser;
      onLogin(userWithoutPassword);
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-title">CUSTOMS CASE MANAGER</h1>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" className="btn btn-primary">
          Log In
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account?{' '}
        <button type="button" className="link-btn" onClick={onSwitchToSignup}>
          Sign up
        </button>
      </p>
    </div>
  );
}

// ============== SIGNUP PAGE ==============

interface SignupPageProps {
  onSignup: (user: User) => void;
  onSwitchToLogin: () => void;
}

function SignupPage({ onSignup, onSwitchToLogin }: SignupPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('writer');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !confirmPassword || !company || !name) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Check if email already exists
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]') as Array<User & { password: string }>;
    if (registeredUsers.some(u => u.email === email)) {
      setError('An account with this email already exists');
      return;
    }

    // Save user with password for auth
    const userWithPassword = { email, password, role, company, name };
    registeredUsers.push(userWithPassword);
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

    onSignup({ email, role, company, name });
  };

  return (
    <div className="auth-card">
      <h1 className="auth-title">CUSTOMS CASE MANAGER</h1>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="signup-email">Email</label>
          <input
            type="email"
            id="signup-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="signup-password">Password</label>
          <input
            type="password"
            id="signup-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="writer">Case Writer</option>
            <option value="lead_reviewer">Lead Reviewer</option>
            <option value="ceo">CEO</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="company">Company Name</label>
          <input
            type="text"
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Enter your company name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        <button type="submit" className="btn btn-success">
          Create Account
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="link-btn" onClick={onSwitchToLogin}>
          Log in
        </button>
      </p>
    </div>
  );
}

// ============== DASHBOARD PAGE ==============

interface DashboardPageProps {
  user: User;
  cases: Case[];
  notifications: Notification[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  onLogout: () => void;
  onOpenCase: (caseId: string) => void;
}

const STATUS_LANES: { status: CaseStatus; label: string; color: string }[] = [
  { status: 'drafting', label: 'DRAFTING', color: '#1e2d40' },
  { status: 'missing_ev', label: 'MISSING EV.', color: '#f59e0b' },
  { status: 'ready_review', label: 'READY FOR REVIEW', color: '#2f6fd4' },
  { status: 'returned', label: 'RETURNED (FIX)', color: '#ef4444' },
  { status: 'completed', label: 'COMPLETED', color: '#22c55e' },
];

function DashboardPage({
  user,
  cases,
  notifications,
  setCases,
  setNotifications,
  onLogout,
  onOpenCase
}: DashboardPageProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CaseStatus | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'filter'>('all');

  const createCase = () => {
    const newCase: Case = {
      id: `case-${Date.now()}`,
      title: `Case #${cases.length + 1}`,
      createdBy: user.name,
      createdAt: new Date(),
      status: 'drafting',
      fields: {
        hsCode: '',
        originCountry: '',
        destCountry: '',
        invoiceAmount: '',
        netWeight: '',
        grossWeight: '',
        exitCustoms: '',
        iban: '',
        others: '',
      },
      docs: [],
      links: [],
      regions: [],
      comments: [],
    };
    setCases(prev => [...prev, newCase]);
    onOpenCase(newCase.id);
  };

  const handleNotificationClick = () => {
    setShowNotifications(prev => !prev);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filterCases = (status: CaseStatus): Case[] => {
    return cases.filter(c => c.status === status);
  };

  const getFilledFieldsCount = (c: Case): number => {
    return Object.values(c.fields).filter(v => v.trim() !== '').length;
  };

  const getConflictsCount = (c: Case): number => {
    return c.links.filter(l => l.status === 'conflict').length;
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const displayedCases = activeFilter ? filterCases(activeFilter) : cases;
  
  // Count of flagged (returned) cases for the writer view
  const flaggedCount = cases.filter(c => c.status === 'returned').length;

  // Get status pill info
  const getStatusPill = (status: CaseStatus): { label: string; color: string } => {
    switch (status) {
      case 'drafting': return { label: 'Draft', color: '#64748b' };
      case 'missing_ev': return { label: 'Missing Ev.', color: '#f59e0b' };
      case 'ready_review': return { label: 'Ready', color: '#2f6fd4' };
      case 'returned': return { label: 'Returned', color: '#ef4444' };
      case 'completed': return { label: 'Completed', color: '#22c55e' };
      default: return { label: 'New', color: '#22c55e' };
    }
  };

  // Generate mock recent activity from cases
  const recentActivity = cases.slice(0, 5).map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    createdBy: c.createdBy,
    timestamp: c.createdAt,
  }));

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Writer Dashboard - Two Column Layout
  if (user.role === 'writer') {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <header className="dashboard-header">
            <h1 className="dashboard-title">DASHBOARD</h1>

            <div className="header-actions">
              <div className="notification-wrapper">
                <button
                  className="notification-btn"
                  onClick={handleNotificationClick}
                  aria-label="Notifications"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                  )}
                </button>

                {showNotifications && (
                  <div className="notification-popup">
                    <div className="notification-popup-header">
                      <span className="notification-tag">Notification!</span>
                      <button
                        className="notification-close"
                        onClick={() => setShowNotifications(false)}
                        aria-label="Close notifications"
                      >
                        &times;
                      </button>
                    </div>
                    <div className="notification-popup-body">
                      {notifications.length === 0 ? (
                        <p className="notification-empty">No notifications</p>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className="notification-item">
                            <p>{n.message}</p>
                            <button
                              className="notification-dismiss"
                              onClick={() => dismissNotification(n.id)}
                              aria-label="Dismiss notification"
                            >
                              &times;
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                className="btn btn-outline"
                onClick={() => setActiveFilter(activeFilter ? null : 'drafting')}
              >
                Filter +
              </button>

              <div className="user-avatar-wrapper">
                <button
                  className="user-avatar"
                  title={user.name}
                  onClick={() => setShowUserMenu(prev => !prev)}
                >
                  {userInitials}
                </button>
                {showUserMenu && (
                  <div className="user-menu">
                    <div className="user-menu-info">
                      <div className="user-menu-name">{user.name}</div>
                      <div className="user-menu-email">{user.email}</div>
                      <div className="user-menu-role">{user.role.replace('_', ' ')}</div>
                    </div>
                    <button
                      className="user-menu-item"
                      onClick={() => { setShowUserMenu(false); onLogout(); }}
                    >
                      🚪 Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="header-divider"></div>

          <main className="dashboard-main writer-dashboard">
            <div className="writer-two-column">
              {/* LEFT COLUMN */}
              <div className="writer-left-column">
                {/* Box 1: Open Cases */}
                <div className="writer-box">
                  <div className="writer-box-header">
                    <div className="writer-box-title-row">
                      <span className="writer-box-count">{cases.length}</span>
                      <span className="writer-box-label">Open Cases</span>
                      {flaggedCount > 0 && (
                        <span className="writer-flagged-badge">{flaggedCount} Flagged</span>
                      )}
                    </div>
                  </div>
                  <div className="writer-box-divider"></div>
                  <div className="writer-cases-list">
                    {cases.length === 0 ? (
                      <div className="writer-empty-state">
                        <p>No cases yet. Create your first case to get started.</p>
                      </div>
                    ) : (
                      cases.map(c => {
                        const statusPill = getStatusPill(c.status);
                        return (
                          <div
                            key={c.id}
                            className="writer-case-row"
                            onClick={() => onOpenCase(c.id)}
                          >
                            <div className="writer-case-icon">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                            <span className="writer-case-name">{c.title}</span>
                            <span
                              className="writer-status-pill"
                              style={{ backgroundColor: statusPill.color }}
                            >
                              {statusPill.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Box 2: File Upload */}
                <div className="writer-box">
                  <div className="writer-box-header">
                    <span className="writer-box-label">File Upload</span>
                  </div>
                  <div className="writer-box-divider"></div>
                  <div className="writer-file-upload-content">
                    <div className="writer-file-thumbnails">
                      <div className="writer-file-thumb">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>Invoice...</span>
                      </div>
                      <div className="writer-file-thumb">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>Folder</span>
                      </div>
                    </div>
                    <div className="writer-drop-zone" onClick={createCase}>
                      <div className="writer-drop-zone-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                      </div>
                      <p className="writer-drop-zone-text">Drag and drop to upload files,<br />Create a new case</p>
                      <button className="btn btn-primary writer-create-case-btn" onClick={(e) => { e.stopPropagation(); createCase(); }}>
                        Create Case
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="writer-right-column">
                {/* Box 1: Recent Activity */}
                <div className="writer-box writer-activity-box">
                  <div className="writer-box-header">
                    <span className="writer-box-label">Recent Activity</span>
                    <div className="writer-activity-filters">
                      <button
                        className={`writer-activity-filter-btn ${activityFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setActivityFilter('all')}
                      >
                        ALL
                      </button>
                      <button
                        className={`writer-activity-filter-btn ${activityFilter === 'filter' ? 'active' : ''}`}
                        onClick={() => setActivityFilter('filter')}
                      >
                        ▼ Filter
                      </button>
                    </div>
                  </div>
                  <div className="writer-box-divider"></div>
                  <div className="writer-activity-list">
                    {recentActivity.length === 0 ? (
                      <div className="writer-empty-state">
                        <p>No recent activity</p>
                      </div>
                    ) : (
                      recentActivity.map(activity => {
                        const statusPill = getStatusPill(activity.status);
                        return (
                          <div key={activity.id} className="writer-activity-item" onClick={() => onOpenCase(activity.id)}>
                            <div className="writer-case-icon">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                            <div className="writer-activity-info">
                              <div className="writer-activity-title-row">
                                <span className="writer-activity-title">{activity.title}</span>
                                <span
                                  className="writer-status-pill writer-status-pill-sm"
                                  style={{ backgroundColor: statusPill.color }}
                                >
                                  {statusPill.label}
                                </span>
                              </div>
                              <div className="writer-activity-meta">
                                <span>Cr: by {activity.createdBy === user.name ? 'you' : activity.createdBy}</span>
                                <span className="writer-activity-time">{formatTimestamp(activity.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Box 2: Create Case CTA */}
                <div className="writer-box writer-cta-box">
                  <button className="writer-big-create-btn" onClick={createCase}>
                    + Create Case
                  </button>
                  <p className="writer-cta-note">Note: A blank page will be opened for case</p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Lead Reviewer / CEO Dashboard - True Kanban Board
  const [showCompletedHistory, setShowCompletedHistory] = useState(true);

  // Get stale count for a case
  const getStaleCount = (c: Case): number => {
    return c.links.filter(l => l.status === 'stale').length;
  };

  // Check if case needs re-uploading (has comments mentioning re-upload or similar)
  const needsReUploading = (c: Case): boolean => {
    return c.comments.some(comment => 
      comment.text.toLowerCase().includes('re-upload') || 
      comment.text.toLowerCase().includes('reupload') ||
      comment.text.toLowerCase().includes('upload again')
    );
  };

  // Check for critical comments
  const getCriticalComments = (c: Case): number => {
    return c.comments.filter(comment => 
      comment.text.toLowerCase().includes('critical') ||
      comment.text.toLowerCase().includes('urgent') ||
      comment.text.toLowerCase().includes('important')
    ).length;
  };

  // Check if case has questions
  const getQuestionCount = (c: Case): number => {
    return c.comments.filter(comment => comment.text.includes('?')).length;
  };

  // Check if needs fixing (returned status has specific fix requirements)
  const getNeedsFixingCount = (c: Case): number => {
    if (c.status !== 'returned') return 0;
    return c.comments.filter(comment => 
      comment.text.toLowerCase().includes('[returned]') ||
      comment.text.toLowerCase().includes('fix') ||
      comment.text.toLowerCase().includes('correct')
    ).length || 1; // At least 1 if returned
  };

  // Render a kanban card
  const renderKanbanCard = (c: Case) => {
    const filledFields = getFilledFieldsCount(c);
    const conflicts = getConflictsCount(c);
    const staleCount = getStaleCount(c);
    const criticalComments = getCriticalComments(c);
    const questionCount = getQuestionCount(c);
    const needsFixing = getNeedsFixingCount(c);
    const needsReUpload = needsReUploading(c);
    const caseNumber = c.id.split('-')[1]?.slice(-2) || '0';

    return (
      <div
        key={c.id}
        className="kanban-card"
        onClick={() => onOpenCase(c.id)}
      >
        <div className="kanban-card-header">
          <span className="kanban-card-title">{c.title.length > 18 ? c.title.slice(0, 18) + '...' : c.title}</span>
          <span className="kanban-card-number">#{caseNumber}</span>
        </div>
        <div className="kanban-card-author">by {c.createdBy}</div>
        <div className="kanban-card-bullets">
          <div className="kanban-bullet">
            <span className="kanban-bullet-dot" style={{ backgroundColor: filledFields === 9 ? '#2f6fd4' : '#64748b' }}></span>
            <span>Fields {filledFields}/9</span>
          </div>
          {conflicts > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Conflicts: {conflicts}</span>
            </div>
          )}
          {staleCount > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Stale: {staleCount}</span>
            </div>
          )}
          {c.status === 'missing_ev' && (
            <div className="kanban-bullet kanban-bullet-amber">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#f59e0b' }}></span>
              <span>Due: Today</span>
            </div>
          )}
          {questionCount === 0 && (
            <div className="kanban-bullet">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#94a3b8' }}></span>
              <span>No questions</span>
            </div>
          )}
          {questionCount > 0 && (
            <div className="kanban-bullet">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#64748b' }}></span>
              <span>{questionCount} Question{questionCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {criticalComments > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>{criticalComments} critical comment{criticalComments > 1 ? 's' : ''}</span>
            </div>
          )}
          {needsFixing > 0 && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Needs fixing: {needsFixing}</span>
            </div>
          )}
          {needsReUpload && (
            <div className="kanban-bullet kanban-bullet-red">
              <span className="kanban-bullet-dot" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Needs re-uploading</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render completed column with submission history
  const renderCompletedColumn = () => {
    const completedCases = filterCases('completed');
    const totalDocs = completedCases.reduce((sum, c) => sum + c.docs.length, 0);

    return (
      <div className="kanban-column">
        <div className="kanban-col-header kanban-col-completed">COMPLETED</div>
        {completedCases.length > 0 && (
          <>
            {completedCases.slice(0, 1).map(c => {
              const filledFields = getFilledFieldsCount(c);
              const caseNumber = c.id.split('-')[1]?.slice(-2) || '0';
              return (
                <div
                  key={c.id}
                  className="kanban-card kanban-card-completed"
                  onClick={() => onOpenCase(c.id)}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title">{c.title.length > 15 ? c.title.slice(0, 15) + '...' : c.title}</span>
                    <span className="kanban-card-number">#{caseNumber}</span>
                  </div>
                  <div className="kanban-card-author">by {c.createdBy}</div>
                  <div className="kanban-card-bullets">
                    <div className="kanban-bullet">
                      <span className="kanban-bullet-dot" style={{ backgroundColor: '#f59e0b' }}></span>
                      <span>Fields {filledFields}/10</span>
                    </div>
                    <div className="kanban-bullet kanban-bullet-green">
                      <span className="kanban-bullet-dot" style={{ backgroundColor: '#22c55e' }}></span>
                      <span>Everything correct</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              className="kanban-submitted-btn"
              onClick={() => setShowCompletedHistory(!showCompletedHistory)}
            >
              {showCompletedHistory ? 'Hide' : 'Show'} submitted documents
              <br />
              <span className="kanban-submitted-count">({totalDocs > 0 ? `${totalDocs} documents` : 'to customs'})</span>
            </button>
            {showCompletedHistory && completedCases.length > 1 && (
              <div className="kanban-submission-history">
                {completedCases.slice(1).map(c => {
                  const caseNumber = c.id.split('-')[1]?.slice(-2) || '0';
                  const dateStr = new Date(c.createdAt).toLocaleDateString();
                  return (
                    <div key={c.id} className="kanban-history-item" onClick={() => onOpenCase(c.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                      <div className="kanban-history-info">
                        <span className="kanban-history-title">Case #{caseNumber}</span>
                        <span className="kanban-history-meta">by {c.createdBy} • {dateStr}</span>
                      </div>
                      <svg className="kanban-history-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {completedCases.length === 0 && (
          <div className="kanban-empty-col">No completed cases</div>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <h1 className="dashboard-title">DASHBOARD</h1>

          <div className="header-actions">
            <button
              className="btn btn-outline"
              onClick={() => setActiveFilter(activeFilter ? null : 'drafting')}
            >
              Filter +
            </button>

            <button className="btn btn-primary" onClick={createCase}>
              + Create Case
            </button>

            <div className="notification-wrapper">
              <button
                className="notification-btn"
                onClick={handleNotificationClick}
                aria-label="Notifications"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notification-popup">
                  <div className="notification-popup-header">
                    <span className="notification-tag">Notification!</span>
                    <button
                      className="notification-close"
                      onClick={() => setShowNotifications(false)}
                      aria-label="Close notifications"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="notification-popup-body">
                    {notifications.length === 0 ? (
                      <p className="notification-empty">No notifications</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="notification-item">
                          <p>{n.message}</p>
                          <button
                            className="notification-dismiss"
                            onClick={() => dismissNotification(n.id)}
                            aria-label="Dismiss notification"
                          >
                            &times;
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-avatar-wrapper">
              <button
                className="user-avatar"
                title={user.name}
                onClick={() => setShowUserMenu(prev => !prev)}
              >
                {userInitials}
              </button>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-info">
                    <div className="user-menu-name">{user.name}</div>
                    <div className="user-menu-email">{user.email}</div>
                    <div className="user-menu-role">{user.role.replace('_', ' ')}</div>
                  </div>
                  <button
                    className="user-menu-item"
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                  >
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="header-divider"></div>

        <main className="dashboard-main reviewer-dashboard">
          {cases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 className="empty-state-title">NO CASES YET</h3>
              <p className="empty-state-text">Get started by creating your first customs case.</p>
              <button className="btn btn-primary" onClick={createCase}>
                + Create Your First Case
              </button>
            </div>
          ) : (
            <div className="reviewer-kanban">
              {/* Column 1: DRAFTING */}
              <div className="kanban-column">
                <div className="kanban-col-header kanban-col-drafting">DRAFTING</div>
                {filterCases('drafting').map(c => renderKanbanCard(c))}
                {filterCases('drafting').length === 0 && (
                  <div className="kanban-empty-col">No drafts</div>
                )}
              </div>

              {/* Column 2: MISSING EV. */}
              <div className="kanban-column">
                <div className="kanban-col-header kanban-col-missing">MISSING EV.</div>
                {filterCases('missing_ev').map(c => renderKanbanCard(c))}
                {filterCases('missing_ev').length === 0 && (
                  <div className="kanban-empty-col">None missing</div>
                )}
              </div>

              {/* Column 3: READY FOR REVIEW */}
              <div className="kanban-column">
                <div className="kanban-col-header kanban-col-review">READY FOR REVIEW</div>
                {filterCases('ready_review').map(c => renderKanbanCard(c))}
                {filterCases('ready_review').length === 0 && (
                  <div className="kanban-empty-col">None ready</div>
                )}
              </div>

              {/* Column 4: RETURNED (FIX) */}
              <div className="kanban-column">
                <div className="kanban-col-header kanban-col-returned">RETURNED (FIX)</div>
                {filterCases('returned').map(c => renderKanbanCard(c))}
                {filterCases('returned').length === 0 && (
                  <div className="kanban-empty-col">None returned</div>
                )}
              </div>

              {/* Column 5: COMPLETED */}
              {renderCompletedColumn()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============== CASE EDITOR PAGE ==============

interface CaseEditorPageProps {
  user: User;
  caseId: string;
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  onBack: () => void;
}

const FIELD_LABELS: Record<DeclarantField, string> = {
  hsCode: 'HS Code',
  originCountry: 'Origin Country',
  destCountry: 'Destination Country',
  invoiceAmount: 'Invoice Amount',
  netWeight: 'Net Weight',
  grossWeight: 'Gross Weight',
  exitCustoms: 'Exit Customs',
  iban: 'IBAN',
  others: 'Others',
};

const DOC_TABS: { type: DocumentType; label: string }[] = [
  { type: 'invoice', label: 'Invoice' },
  { type: 'packageList', label: 'Package List' },
  { type: 'atr', label: 'ATR' },
  { type: 'insurance', label: 'Insurance' },
];

function CaseEditorPage({ user, caseId, cases, setCases, setNotifications, onBack }: CaseEditorPageProps) {
  const currentCase = cases.find(c => c.id === caseId);
  const [editingField, setEditingField] = useState<DeclarantField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [activeDocTab, setActiveDocTab] = useState<DocumentType>('invoice');

  // SVG Arrow System State
  const [draggingField, setDraggingField] = useState<DeclarantField | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Refs for arrow positioning
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<DeclarantField, HTMLDivElement | null>>({
    hsCode: null,
    originCountry: null,
    destCountry: null,
    invoiceAmount: null,
    netWeight: null,
    grossWeight: null,
    exitCustoms: null,
    iban: null,
    others: null,
  });
  const regionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const docViewerRef = useRef<HTMLDivElement>(null);

  // Get field position relative to editor container
  const getFieldPosition = useCallback((field: DeclarantField): { x: number; y: number } | null => {
    const fieldEl = fieldRefs.current[field];
    const editorEl = editorRef.current;
    if (!fieldEl || !editorEl) return null;

    const fieldRect = fieldEl.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    return {
      x: fieldRect.right - editorRect.left,
      y: fieldRect.top + fieldRect.height / 2 - editorRect.top,
    };
  }, []);

  // Get region position relative to editor container
  const getRegionPosition = useCallback((regionId: string): { x: number; y: number } | null => {
    const regionEl = regionRefs.current[regionId];
    const editorEl = editorRef.current;
    if (!regionEl || !editorEl) return null;

    const regionRect = regionEl.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();

    return {
      x: regionRect.left + regionRect.width / 2 - editorRect.left,
      y: regionRect.top + regionRect.height / 2 - editorRect.top,
    };
  }, []);

  // Generate curved bezier path between two points
  const generatePath = useCallback((start: { x: number; y: number }, end: { x: number; y: number }): string => {
    const midX = (start.x + end.x) / 2;
    const controlOffset = Math.min(80, Math.abs(end.x - start.x) / 3);
    return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${midX} ${(start.y + end.y) / 2}, ${end.x} ${end.y}`;
  }, []);

  // Start field drag
  const startFieldDrag = useCallback((field: DeclarantField, event: React.MouseEvent) => {
    event.preventDefault();
    const editorEl = editorRef.current;
    if (!editorEl) return;

    setDraggingField(field);
    const editorRect = editorEl.getBoundingClientRect();
    setDragPoint({
      x: event.clientX - editorRect.left,
      y: event.clientY - editorRect.top,
    });
  }, []);

  // Update drag position
  const updateDrag = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (!draggingField) return;
    const editorEl = editorRef.current;
    if (!editorEl) return;

    const editorRect = editorEl.getBoundingClientRect();
    setDragPoint({
      x: event.clientX - editorRect.left,
      y: event.clientY - editorRect.top,
    });
  }, [draggingField]);

  // Finish drag - check if over a region
  const finishDrag = useCallback((event: React.MouseEvent | MouseEvent) => {
    if (!draggingField || !currentCase) {
      setDraggingField(null);
      setDragPoint(null);
      return;
    }

    // Check if dropped over any region marker
    const regionIds = Object.keys(regionRefs.current);
    let targetRegion: DocumentRegion | null = null;

    for (const regionId of regionIds) {
      const regionEl = regionRefs.current[regionId];
      if (regionEl) {
        const rect = regionEl.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          targetRegion = currentCase.regions.find(r => r.id === regionId) || null;
          break;
        }
      }
    }

    if (targetRegion) {
      // Check if link already exists
      const existingLink = currentCase.links.find(
        l => l.field === draggingField && l.docType === targetRegion!.docType
      );

      if (!existingLink) {
        // Create new link
        const newLink: EvidenceLink = {
          field: draggingField,
          docType: targetRegion.docType,
          region: targetRegion.id,
          value: currentCase.fields[draggingField] || '',
          status: 'linked',
        };

        setCases(prev => prev.map(c => {
          if (c.id === caseId) {
            return { ...c, links: [...c.links, newLink] };
          }
          return c;
        }));
      }
    }

    setDraggingField(null);
    setDragPoint(null);
  }, [draggingField, currentCase, caseId, setCases]);

  // Add document region marker
  const addDocumentRegion = useCallback((docType: DocumentType, event: React.MouseEvent) => {
    const docViewerEl = docViewerRef.current;
    if (!docViewerEl) return;

    const rect = docViewerEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const newRegion: DocumentRegion = {
      id: `region-${Date.now()}`,
      docType,
      x,
      y,
    };

    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, regions: [...c.regions, newRegion] };
      }
      return c;
    }));

    setSelectedRegion(newRegion.id);
  }, [caseId, setCases]);

  // Remove link
  const removeLink = useCallback((field: DeclarantField, docType: DocumentType) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          links: c.links.filter(l => !(l.field === field && l.docType === docType)),
        };
      }
      return c;
    }));
  }, [caseId, setCases]);

  // Remove region
  const removeRegion = useCallback((regionId: string) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          regions: c.regions.filter(r => r.id !== regionId),
          links: c.links.filter(l => l.region !== regionId),
        };
      }
      return c;
    }));
    setSelectedRegion(null);
  }, [caseId, setCases]);

  // Mouse event handlers
  useEffect(() => {
    if (draggingField) {
      const handleMouseMove = (e: MouseEvent) => updateDrag(e);
      const handleMouseUp = (e: MouseEvent) => finishDrag(e);

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingField, updateDrag, finishDrag]);

  if (!currentCase) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="empty-state-title">CASE NOT FOUND</h3>
            <p className="empty-state-text">The requested case could not be located.</p>
            <button className="btn btn-primary" onClick={onBack}>Go Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleFieldEdit = (field: DeclarantField) => {
    setEditingField(field);
    setEditValue(currentCase.fields[field]);
  };

  const handleFieldSave = (field: DeclarantField, value: string) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          fields: { ...c.fields, [field]: value }
        };
      }
      return c;
    }));
    setEditingField(null);
    setEditValue('');
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newDoc: UploadedDoc = {
          name: file.name,
          docType: activeDocTab,
          dataUrl,
        };
        setCases(prev => prev.map(c => {
          if (c.id === caseId) {
            return { ...c, docs: [...c.docs, newDoc] };
          }
          return c;
        }));
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleAddComment = (text: string) => {
    if (!text.trim()) return;
    const newComment = {
      author: user.name,
      text: text.trim(),
      timestamp: new Date(),
    };
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, comments: [...c.comments, newComment] };
      }
      return c;
    }));
    setNewCommentText('');
  };

  const handleSubmitCase = () => {
    setShowSubmitModal(true);
  };

  const confirmSubmit = () => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, status: 'ready_review' };
      }
      return c;
    }));
    setNotifications(prev => [...prev, {
      id: `notif-${Date.now()}`,
      message: `${currentCase?.title || 'Case'} has been submitted for review`,
      caseId,
      timestamp: new Date(),
      read: false,
    }]);
    setShowSubmitModal(false);
    onBack();
  };

  const currentDocs = currentCase.docs.filter(d => d.docType === activeDocTab);
  const hasDocs = currentCase.docs.length > 0;

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <button className="btn-back" onClick={onBack} aria-label="Go back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h1 className="dashboard-title">{currentCase.title.toUpperCase()}</h1>
          <div className="user-avatar-wrapper">
            <button className="user-avatar" title={user.name} onClick={onBack}>
              {userInitials}
            </button>
          </div>
        </header>
        <div className="header-divider"></div>

        <main className="editor-main">
          <div className="editor-panels" ref={editorRef}>
            {/* SVG ARROW OVERLAY */}
            <svg className="editor-svg-overlay">
              <defs>
                {/* Blue arrowhead for established links */}
                <marker
                  id="arrowhead-blue"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#2f6fd4" />
                </marker>
                {/* Amber arrowhead for dragging */}
                <marker
                  id="arrowhead-amber"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                </marker>
              </defs>

              {/* Persistent link arrows */}
              {currentCase.links.map(link => {
                const fieldPos = getFieldPosition(link.field);
                const regionPos = getRegionPosition(link.region);
                if (!fieldPos || !regionPos) return null;

                const pathD = generatePath(fieldPos, regionPos);
                const midX = (fieldPos.x + regionPos.x) / 2;
                const midY = (fieldPos.y + regionPos.y) / 2;

                return (
                  <g key={`${link.field}-${link.docType}-${link.region}`}>
                    <path
                      d={pathD}
                      className={`link-line ${link.status === 'conflict' ? 'link-line-conflict' : ''}`}
                      markerEnd="url(#arrowhead-blue)"
                    />
                    {/* Pill label at midpoint */}
                    <g className="link-label-group" onClick={() => removeLink(link.field, link.docType)}>
                      <rect
                        x={midX - 40}
                        y={midY - 10}
                        width="80"
                        height="20"
                        rx="10"
                        className="link-label-bg"
                      />
                      <text
                        x={midX}
                        y={midY + 4}
                        textAnchor="middle"
                        className="link-label-text"
                      >
                        {FIELD_LABELS[link.field]}
                      </text>
                    </g>
                    {/* Conflict marker */}
                    {link.status === 'conflict' && (
                      <g transform={`translate(${midX + 50}, ${midY})`}>
                        <circle r="10" fill="#ef4444" />
                        <path
                          d="M-4 -4 L4 4 M-4 4 L4 -4"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Drag in progress arrow */}
              {draggingField && dragPoint && (() => {
                const fieldPos = getFieldPosition(draggingField);
                if (!fieldPos) return null;
                const pathD = generatePath(fieldPos, dragPoint);
                return (
                  <path
                    d={pathD}
                    className="link-line-dragging"
                    markerEnd="url(#arrowhead-amber)"
                  />
                );
              })()}
            </svg>

            {/* LEFT PANEL - DECLARANT */}
            <div className="editor-panel declarant-panel">
              <div className="panel-header">
                <h2 className="panel-title">DECLARANT</h2>
              </div>
              <div className="panel-divider"></div>
              <div className="declarant-fields">
                {(Object.keys(FIELD_LABELS) as DeclarantField[]).map((field, idx) => {
                  const hasLink = currentCase.links.some(l => l.field === field);
                  return (
                    <div key={field} className="declarant-row">
                      {editingField === field ? (
                        <div className="field-edit-mode">
                          <span className="field-label">{FIELD_LABELS[field]}</span>
                          <input
                            type="text"
                            className="field-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                          />
                          <div className="field-actions">
                            <button className="btn-icon btn-save" onClick={() => handleFieldSave(field, editValue)} aria-label="Save field">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5"></path>
                              </svg>
                            </button>
                            <button className="btn-icon btn-cancel" onClick={handleFieldCancel} aria-label="Cancel editing">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="field-view-mode"
                          ref={(el) => { fieldRefs.current[field] = el; }}
                        >
                          <span className="field-label">{FIELD_LABELS[field]}</span>
                          <span className="field-value">{currentCase.fields[field] || '—'}</span>
                          <button className="btn-icon btn-edit" onClick={() => handleFieldEdit(field)} aria-label={`Edit ${FIELD_LABELS[field]}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                          </button>
                          <div
                            className={`drag-handle ${hasLink ? 'has-link' : ''} ${draggingField === field ? 'dragging' : ''}`}
                            onMouseDown={(e) => startFieldDrag(field, e)}
                          >
                            <span className="drag-circle"></span>
                          </div>
                        </div>
                      )}
                      {idx < Object.keys(FIELD_LABELS).length - 1 && <div className="field-separator"></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL - DOCUMENTS */}
            <div className="editor-panel documents-panel">
              <div className="panel-header">
                <h2 className="panel-title">DOCUMENTS</h2>
              </div>
              <div className="panel-divider"></div>

              {!hasDocs ? (
                <div className="upload-zone">
                  <div className="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4z"></path>
                      <path d="M12 8v8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                  </div>
                  <p className="upload-text">Drag & Drop files here or click below</p>
                  <label className="btn btn-primary upload-btn">
                    Upload Files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              ) : (
                <div className="docs-content">
                  <div className="doc-tabs">
                    {DOC_TABS.map(tab => (
                      <button
                        key={tab.type}
                        className={`doc-tab ${activeDocTab === tab.type ? 'active' : ''}`}
                        onClick={() => setActiveDocTab(tab.type)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div
                    className="doc-viewer"
                    ref={docViewerRef}
                    onClick={(e) => {
                      // Only add region if clicking on the document area, not on existing regions
                      if (currentDocs.length > 0 && (e.target as HTMLElement).closest('.region-marker') === null) {
                        addDocumentRegion(activeDocTab, e);
                      }
                    }}
                  >
                    {currentDocs.length === 0 ? (
                      <div className="doc-empty">
                        <p>No {activeDocTab} uploaded</p>
                        <label className="btn btn-sm btn-primary">
                          Upload
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="doc-preview">
                        {currentDocs[0].dataUrl.startsWith('data:application/pdf') ? (
                          <iframe src={currentDocs[0].dataUrl} title="Document Preview" className="pdf-frame"></iframe>
                        ) : (
                          <img src={currentDocs[0].dataUrl} alt={currentDocs[0].name} className="doc-image" />
                        )}

                        {/* Document Region Markers */}
                        {currentCase.regions
                          .filter(r => r.docType === activeDocTab)
                          .map(region => {
                            const linkedField = currentCase.links.find(l => l.region === region.id);
                            return (
                              <div
                                key={region.id}
                                ref={(el) => { regionRefs.current[region.id] = el; }}
                                className={`region-marker ${selectedRegion === region.id ? 'selected' : ''} ${linkedField ? 'linked' : ''}`}
                                style={{
                                  left: `${region.x}%`,
                                  top: `${region.y}%`,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRegion(selectedRegion === region.id ? null : region.id);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  removeRegion(region.id);
                                }}
                                title={linkedField ? `Linked to: ${FIELD_LABELS[linkedField.field]}` : 'Click to select, double-click to remove'}
                              >
                                <span className="region-marker-inner"></span>
                                {linkedField && (
                                  <span className="region-marker-label">{FIELD_LABELS[linkedField.field]}</span>
                                )}
                              </div>
                            );
                          })}

                        {/* Instruction hint when doc is loaded */}
                        {currentDocs.length > 0 && currentCase.regions.filter(r => r.docType === activeDocTab).length === 0 && (
                          <div className="doc-hint">
                            Click anywhere on the document to place a region marker
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="comments-section">
                <div className="comments-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>Comments</span>
                </div>
                <div className="comments-list">
                  {currentCase.comments.length === 0 ? (
                    <p className="comments-empty">No comments...</p>
                  ) : (
                    currentCase.comments.map((comment, idx) => (
                      <div key={idx} className="comment-item">
                        <div className="comment-author">{comment.author}</div>
                        <div className="comment-text">{comment.text}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="comment-input-row">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(newCommentText)}
                  />
                  <button className="btn-send" onClick={() => handleAddComment(newCommentText)} aria-label="Send comment">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="submit-area">
                <button className="btn btn-success btn-submit" onClick={handleSubmitCase} aria-label="Submit case for review">
                  Submit Case
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">Send files</h3>
            <div className="modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <p className="modal-status">READY to send. Files verified.</p>
            <p className="modal-question">Proceed to send these files?</p>
            <div className="modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => setShowSubmitModal(false)}>
                Cancel
              </button>
              <button className="btn btn-modal-confirm" onClick={confirmSubmit}>
                Send Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== REVIEW MATRIX PAGE ==============

interface ReviewMatrixPageProps {
  user: User;
  caseId: string;
  cases: Case[];
  setCases: React.Dispatch<React.SetStateAction<Case[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  inspectingCell: { field: DeclarantField; docType: DocumentType } | null;
  setInspectingCell: React.Dispatch<React.SetStateAction<{ field: DeclarantField; docType: DocumentType } | null>>;
  showReturnModal: boolean;
  setShowReturnModal: React.Dispatch<React.SetStateAction<boolean>>;
  onBack: () => void;
}

const MATRIX_FIELDS: DeclarantField[] = [
  'hsCode', 'originCountry', 'destCountry', 'invoiceAmount', 'netWeight',
  'grossWeight', 'exitCustoms', 'iban', 'others'
];

const MATRIX_DOCS: { type: DocumentType; label: string }[] = [
  { type: 'invoice', label: 'Invoice' },
  { type: 'packageList', label: 'Package List' },
  { type: 'atr', label: 'ATR' },
  { type: 'insurance', label: 'Insurance' },
];

function ReviewMatrixPage({
  user,
  caseId,
  cases,
  setCases,
  setNotifications,
  inspectingCell,
  setInspectingCell,
  showReturnModal,
  setShowReturnModal,
  onBack
}: ReviewMatrixPageProps) {
  const currentCase = cases.find(c => c.id === caseId);
  const [returnComment, setReturnComment] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [editingFieldValue, setEditingFieldValue] = useState('');

  if (!currentCase) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className="empty-state-title">CASE NOT FOUND</h3>
            <p className="empty-state-text">The requested case could not be located.</p>
            <button className="btn btn-primary" onClick={onBack}>Go Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const userInitials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get cell status for a field/docType combination
  const getCellStatus = (field: DeclarantField, docType: DocumentType): 'linked' | 'conflict' | 'none' => {
    const link = currentCase.links.find(l => l.field === field && l.docType === docType);
    if (!link) return 'none';
    return link.status === 'conflict' ? 'conflict' : 'linked';
  };

  // Count stats for sidebar
  const linkedCount = currentCase.links.filter(l => l.status === 'linked').length;
  const conflictCount = currentCase.links.filter(l => l.status === 'conflict').length;
  const staleCount = currentCase.links.filter(l => l.status === 'stale').length;
  const editingCount = 0; // Placeholder - could track fields being edited

  const handleCellClick = (field: DeclarantField, docType: DocumentType) => {
    setEditingFieldValue(currentCase.fields[field] || '');
    setInspectingCell({ field, docType });
  };

  const handleAddComment = (text: string) => {
    if (!text.trim()) return;
    const newComment = {
      author: user.name,
      text: text.trim(),
      timestamp: new Date(),
    };
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, comments: [...c.comments, newComment] };
      }
      return c;
    }));
    setNewCommentText('');
  };

  const handleReturn = () => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        const returnCommentObj = returnComment.trim() ? {
          author: user.name,
          text: `[RETURNED] ${returnComment.trim()}`,
          timestamp: new Date(),
        } : null;
        return {
          ...c,
          status: 'returned' as CaseStatus,
          comments: returnCommentObj ? [...c.comments, returnCommentObj] : c.comments,
        };
      }
      return c;
    }));
    setNotifications(prev => [...prev, {
      id: `notif-${Date.now()}`,
      message: `${currentCase?.title || 'Case'} has been returned for corrections`,
      caseId,
      timestamp: new Date(),
      read: false,
    }]);
    setShowReturnModal(false);
    setReturnComment('');
    onBack();
  };

  const handleSubmit = () => {
    const newStatus = user.role === 'ceo' ? 'completed' : 'ready_review';
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return { ...c, status: newStatus as CaseStatus };
      }
      return c;
    }));
    setNotifications(prev => [...prev, {
      id: `notif-${Date.now()}`,
      message: user.role === 'ceo'
        ? `${currentCase?.title || 'Case'} has been submitted to customs`
        : `${currentCase?.title || 'Case'} has been sent to CEO for approval`,
      caseId,
      timestamp: new Date(),
      read: false,
    }]);
    onBack();
  };

  const handleSaveFieldValue = () => {
    if (!inspectingCell) return;
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          fields: { ...c.fields, [inspectingCell.field]: editingFieldValue }
        };
      }
      return c;
    }));
  };

  // Get linked region for the inspecting cell
  const getLinkedRegion = () => {
    if (!inspectingCell) return null;
    const link = currentCase.links.find(l => l.field === inspectingCell.field && l.docType === inspectingCell.docType);
    if (!link) return null;
    return currentCase.regions.find(r => r.id === link.region);
  };

  const linkedRegion = getLinkedRegion();

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <button className="btn-back" onClick={onBack} aria-label="Go back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h1 className="dashboard-title">CASE #{currentCase.id.split('-')[1]?.slice(-4) || '0000'} • {currentCase.title.toUpperCase()}</h1>
          <div className="user-avatar-wrapper">
            <button className="user-avatar" title={user.name} onClick={onBack}>
              {userInitials}
            </button>
          </div>
        </header>
        <div className="header-divider"></div>

        <main className="matrix-main">
          <div className="matrix-layout">
            {/* LEFT: Matrix Table */}
            <div className="matrix-panel">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-corner"></th>
                    {MATRIX_DOCS.map(doc => (
                      <th key={doc.type} className="matrix-col-header">{doc.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX_FIELDS.map(field => (
                    <tr key={field}>
                      <td className="matrix-row-header">{FIELD_LABELS[field]}</td>
                      {MATRIX_DOCS.map(doc => {
                        const status = getCellStatus(field, doc.type);
                        return (
                          <td
                            key={doc.type}
                            className={`matrix-cell matrix-cell-${status}`}
                            onClick={() => handleCellClick(field, doc.type)}
                          >
                            {status === 'none' && (
                              <span className="matrix-icon matrix-icon-none">✕</span>
                            )}
                            {status === 'linked' && (
                              <span className="matrix-icon matrix-icon-linked">✓</span>
                            )}
                            {status === 'conflict' && (
                              <span className="matrix-icon matrix-icon-conflict">!</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Sidebar */}
            <div className="matrix-sidebar">
              <div className="matrix-status-summary">
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-linked">✓</span>
                  <span className="status-stat-label">Linked</span>
                  <span className="status-stat-value">{linkedCount}</span>
                </div>
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-conflict">!</span>
                  <span className="status-stat-label">Conflict</span>
                  <span className="status-stat-value">{conflictCount}</span>
                </div>
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-stale">⟳</span>
                  <span className="status-stat-label">Stale</span>
                  <span className="status-stat-value">{staleCount}</span>
                </div>
                <div className="status-stat">
                  <span className="status-stat-icon status-stat-editing">✎</span>
                  <span className="status-stat-label">Editing</span>
                  <span className="status-stat-value">{editingCount}</span>
                </div>
              </div>

              <button className="btn btn-primary btn-add-files" aria-label="Add files to case">
                + Add Files
              </button>

              <div className="matrix-comments-box">
                <div className="comments-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>Comments</span>
                </div>
                <div className="comments-list">
                  {currentCase.comments.length === 0 ? (
                    <p className="comments-empty">No comments...</p>
                  ) : (
                    currentCase.comments.map((comment, idx) => (
                      <div key={idx} className="comment-item">
                        <div className="comment-author">{comment.author}</div>
                        <div className="comment-text">{comment.text}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="comment-input-row">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(newCommentText)}
                  />
                  <button className="btn-send" onClick={() => handleAddComment(newCommentText)} aria-label="Send comment">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="matrix-actions">
                <button className="btn btn-danger btn-return" onClick={() => setShowReturnModal(true)} aria-label="Return case for corrections">
                  Return
                </button>
                <button className="btn btn-success btn-submit-review" onClick={handleSubmit} aria-label={user.role === 'ceo' ? 'Submit case to customs' : 'Submit case to CEO'}>
                  {user.role === 'ceo' ? 'Submit to Customs' : 'Submit to CEO'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Field Inspection Popup */}
      {inspectingCell && (
        <div className="modal-overlay" onClick={() => setInspectingCell(null)}>
          <div className="inspection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspection-header">
              <h3 className="inspection-title">EDITING: {FIELD_LABELS[inspectingCell.field]}</h3>
              <button className="inspection-close" onClick={() => setInspectingCell(null)}>
                ✕
              </button>
            </div>
            <div className="inspection-content">
              <div className="inspection-field-row">
                <input
                  type="text"
                  className="inspection-input"
                  value={editingFieldValue}
                  onChange={(e) => setEditingFieldValue(e.target.value)}
                  placeholder="Enter value..."
                />
                <button className="btn btn-sm btn-primary" onClick={handleSaveFieldValue}>
                  Save
                </button>
              </div>
              <button className="btn btn-sm btn-outline inspection-evidence-btn">
                Evidence Linked
              </button>
              <div className="inspection-preview">
                {linkedRegion ? (
                  <div className="inspection-preview-content">
                    <div className="inspection-preview-placeholder">
                      <span>PDF Preview Area</span>
                    </div>
                    <div
                      className="inspection-region-marker"
                      style={{ left: `${linkedRegion.x}%`, top: `${linkedRegion.y}%` }}
                    >
                      <span className="region-marker-inner"></span>
                    </div>
                  </div>
                ) : (
                  <div className="inspection-preview-empty">
                    <p>No evidence linked for this field</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="return-modal" onClick={(e) => e.stopPropagation()}>
            <div className="return-modal-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3 className="return-modal-title">RETURN THE FILES</h3>
            </div>
            <textarea
              className="return-modal-textarea"
              placeholder="Add comments explaining why the case is being returned..."
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
            ></textarea>
            <div className="return-modal-actions">
              <button className="btn btn-modal-cancel" onClick={() => setShowReturnModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleReturn}>
                Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
