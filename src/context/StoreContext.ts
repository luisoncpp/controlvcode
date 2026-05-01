import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { ExecutionStore } from '../store/ExecutionStore';

export const StoreContext = createContext<ExecutionStore | null>(null);

export function useStore(): ExecutionStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore debe ser usado dentro de un <StoreContext.Provider>");
  }
  return store;
}