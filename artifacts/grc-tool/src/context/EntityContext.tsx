/**
 * @file EntityContext.tsx
 * @description React context that tracks which business entity is currently
 * selected in the sidebar switcher (e.g. "gopuff", "bevmo", "liquorbarn").
 *
 * Every page that needs to scope its API requests to the active entity reads
 * `activeEntity` from {@link useEntity} and passes it as the `entityCode`
 * parameter to the relevant React Query hooks.
 *
 * Architecture notes:
 * - State lives in a React `useState` hook inside `EntityProvider` so it is
 *   properly tied to the component lifecycle and React's reconciler.
 * - When `setActiveEntity` is called (e.g. from the sidebar dropdown), every
 *   component subscribed to this context re-renders. Because all page-level
 *   query keys include `entityCode`, React Query will automatically start fresh
 *   fetches for the new entity (or serve from cache if already fetched).
 * - The default entity is "gopuff" as specified by product requirements.
 *
 * Usage:
 *   - Wrap the app in `<EntityProvider>` (done in App.tsx).
 *   - Call `useEntity()` anywhere inside to read or change the selection.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Shape of the value provided by {@link EntityContext}.
 *
 * Both properties are always present; there is no "loading" state because the
 * initial entity is set synchronously from `useState`.
 */
type EntityContextType = {
  /** The `code` of the currently active business entity (e.g. `"gopuff"`). */
  activeEntity: string;
  /** Callback to change the active entity; triggers re-fetches across all pages. */
  setActiveEntity: (entityCode: string) => void;
};

/**
 * The React context object. Starts as `undefined` so that `useEntity` can
 * detect when it is consumed outside a provider and throw a helpful error,
 * rather than silently using a null/empty value that could cause subtle bugs.
 */
const EntityContext = createContext<EntityContextType | undefined>(undefined);

/**
 * Context provider component. Must wrap any part of the tree that calls
 * `useEntity()`. In this application it is mounted at the root in `App.tsx`
 * so the entire component tree has access.
 *
 * Initialises `activeEntity` to `"gopuff"` — the primary business entity.
 * This matches the seed data in the API server which defaults all compliance
 * data to the Gopuff entity when no entityCode filter is applied.
 *
 * @param children - Child components that will have access to entity state.
 *                   Should be the entire application subtree that needs entity
 *                   scoping (i.e. all page components).
 * @returns A context provider wrapping `children` with entity state.
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
 * Throws immediately if called outside of an `<EntityProvider>` tree, making
 * misconfiguration easy to diagnose during development.
 *
 * Typical usage in a page component:
 * ```tsx
 * const { activeEntity } = useEntity();
 * // Pass activeEntity to a React Query hook so the query is entity-scoped:
 * const { data } = useListControls({ entityCode: activeEntity });
 * ```
 *
 * Typical usage in the Shell's entity switcher:
 * ```tsx
 * const { activeEntity, setActiveEntity } = useEntity();
 * // Called when the user picks a different entity from the dropdown:
 * setActiveEntity(entity.code);
 * ```
 *
 * @throws {Error} When called outside of an `<EntityProvider>` tree.
 * @returns An object containing:
 *   - `activeEntity` {string} – The `code` of the currently selected entity.
 *   - `setActiveEntity` {(code: string) => void} – Updater that changes the
 *     active entity and causes all subscribed components to re-render.
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
