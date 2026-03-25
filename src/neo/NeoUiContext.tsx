import React, { createContext, useContext } from 'react';

const NeoUiContext = createContext(false);

export function NeoUiProvider({ children }: { children: React.ReactNode }) {
  return <NeoUiContext.Provider value={true}>{children}</NeoUiContext.Provider>;
}

export function useNeoUi() {
  return useContext(NeoUiContext);
}
