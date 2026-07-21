// ============================================================
// Contexts — separated from App.jsx for Fast Refresh compatibility
// ============================================================

import { createContext, useContext } from 'react';

export const LangContext = createContext({ lang: 'en', switchLang: () => {} });
export const ToastContext = createContext(null);
export const ModelStatusContext = createContext({ anyLoading: false, embeddingModelReady: false });

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangContext.Provider');
  return ctx;
}

export function useToast() {
  return useContext(ToastContext);
}

export function useModelStatus() {
  const ctx = useContext(ModelStatusContext);
  if (!ctx) throw new Error('useModelStatus must be used within ModelStatusContext.Provider');
  return ctx;
}
