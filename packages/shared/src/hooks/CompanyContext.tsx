import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { companiesService } from '../api/companiesService';
import { getStoredActiveCompanyId, setStoredActiveCompanyId } from '../utils/storage';
import type { Company } from '../models';
import { useAuthContext } from './AuthContext';

export interface CompanyContextValue {
  companies: Company[];
  activeCompanyId: string | null;
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => Promise<void>;
  loading: boolean;
  /** Prefix React Query keys so caches are scoped when switching company (optional). */
  scopeKey: readonly ['company', string];
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();
  const [activeCompanyId, setActiveState] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void companiesService
      .getAll()
      .then((list) => {
        if (!cancelled) setCompanies(list);
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const companyIdsKey = useMemo(
    () =>
      companies
        .map((c) => c.id)
        .sort()
        .join(','),
    [companies]
  );

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setActiveState(null);
      void setStoredActiveCompanyId(null);
      return;
    }
    if (!companies.length) return;

    void (async () => {
      const stored = await getStoredActiveCompanyId();
      const valid =
        stored && companies.some((c) => c.id === stored)
          ? stored
          : companies.some((c) => c.id === user.company_id)
            ? user.company_id
            : companies[0].id;
      setActiveState((prev) => (prev === valid ? prev : valid));
      if (valid) await setStoredActiveCompanyId(valid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- companies read when companyIdsKey (membership set) changes
  }, [isAuthenticated, user?.id, user?.company_id, companyIdsKey]);

  const setActiveCompanyId = useCallback(
    async (id: string) => {
      setActiveState(id);
      await setStoredActiveCompanyId(id);
    },
    []
  );

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const scopeKey = useMemo(
    () => ['company', activeCompanyId ?? 'none'] as const,
    [activeCompanyId]
  );

  const value = useMemo(
    (): CompanyContextValue => ({
      companies,
      activeCompanyId,
      activeCompany,
      setActiveCompanyId,
      loading,
      scopeKey,
    }),
    [companies, activeCompanyId, activeCompany, setActiveCompanyId, loading, scopeKey]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompanyContext(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompanyContext must be used within CompanyProvider');
  return ctx;
}
