/**
 * @file EntityContext.tsx
 * @description React context that tracks which business entity is currently
 * selected in the sidebar switcher (e.g. "gopuff", "bevmo", "liquorbarn").
 *
 * Every page that needs to scope its API requests to the active entity reads
 * `activeEntity` from {@link useEntity} and passes it as the `entityCode`
 * parameter to the relevant React Query hooks.
 *
 * Usage:
 *   - Wrap the app in `<EntityProvider>` (done in App.tsx).
 *   - Call `useEntity()` anywhere inside to read or change the selection.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Shape of the value provided by {@link EntityContext}.
 */
type EntityContextType = {
  /** The `code` of the currently active business entity (e.g. `"gopuff"`). */
  activeEntity: string;
  /** Callback to change the active entity; triggers re-fetches across all pages. */
  setActiveEntity: (entityCode: string) => void;
};

/**
 * The React context object. Starts as `undefined` so that `useEntity` can
 * detect when it is consumed outside a provider.
 */
const EntityContext = createContext<EntityContextType | undefined>(undefined);

/**
 * Context provider component. Must wrap any part of the tree that calls
 * `useEntity()`.
 *
 * @param children - Child components that will have access to entity state.
 */
export const EntityProvider = ({ children }: { children: ReactNode }) => {
  // Default to Gopuff as per instructions
  const [activeEntity, setActiveEntity] = useState('gopuff');

  return (
    <EntityContext.Provider value={{ activeEntity, setActiveEntity }}>
      {children}
    </EntityContext.Provider>
  );
};

/**
 * Hook to access the current entity selection and its setter.
 *
 * @throws {Error} When called outside of an `<EntityProvider>` tree.
 * @returns The `activeEntity` code string and `setActiveEntity` updater.
 *
 * @example
 * const { activeEntity } = useEntity();
 * const { data } = useListControls({ entityCode: activeEntity });
 */
export const useEntity = () => {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
};
