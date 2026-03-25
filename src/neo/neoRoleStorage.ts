import type { UserRole } from '../lib/roleDashboardData';

const KEY = 'hw5_neo_role_v1';

const ROLES: UserRole[] = ['Case Analyst', 'Lead Reviewer', 'CEO'];

export function readStoredNeoRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const v = window.sessionStorage.getItem(KEY);
  if (!v) return null;
  return ROLES.includes(v as UserRole) ? (v as UserRole) : null;
}

export function writeStoredNeoRole(role: UserRole) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(KEY, role);
}
