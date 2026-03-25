import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { UserRole } from '../lib/roleDashboardData';
import { readStoredNeoRole, writeStoredNeoRole } from './neoRoleStorage';

type NeoRoleContextValue = {
  role: UserRole;
  setRole: (r: UserRole) => void;
};

const NeoRoleContext = createContext<NeoRoleContextValue | null>(null);

export function NeoRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => readStoredNeoRole() ?? 'Case Analyst');

  const setRole = useCallback((r: UserRole) => {
    writeStoredNeoRole(r);
    setRoleState(r);
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return <NeoRoleContext.Provider value={value}>{children}</NeoRoleContext.Provider>;
}

export function useNeoRole() {
  const ctx = useContext(NeoRoleContext);
  if (!ctx) throw new Error('useNeoRole must be used within NeoRoleProvider');
  return ctx;
}
