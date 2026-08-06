import { createContext, useContext, type ReactNode } from 'react';
import type { HapRepository } from '@hap/core';
import { httpRepository } from '../lib/httpRepository';

/**
 * Which driver backs the screens. The hosted app uses HTTP; the local-first shells
 * will pass a SQLite-backed driver here instead, without any screen knowing.
 */
const RepositoryContext = createContext<HapRepository>(httpRepository);

export function RepositoryProvider({
  children,
  repository = httpRepository,
}: {
  children: ReactNode;
  repository?: HapRepository;
}) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): HapRepository {
  return useContext(RepositoryContext);
}
