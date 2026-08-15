/**
 * @file use-toast.ts
 * @description Framework-agnostic toast notification system inspired by the
 * shadcn/ui toast implementation.
 *
 * Architecture overview:
 * - State is held in a **module-level variable** (`memoryState`) rather than
 *   React component state. This allows `toast()` to be called from anywhere
 *   (event handlers, utilities, etc.) without access to a hook or component ref.
 * - All mounted `useToast` hooks subscribe to state changes via a shared
 *   `listeners` array. When `dispatch` mutates `memoryState`, it notifies every
 *   subscriber synchronously so all consumers stay in sync.
 * - Toasts are not immediately removed on dismiss — they linger for
 *   `TOAST_REMOVE_DELAY` ms (effectively ≈11.5 days) to allow exit animations to
 *   complete before the DOM node disappears. Adjust this value to match your CSS
 *   animation duration.
 *
 * Public API:
 * - `toast(props)` – Imperatively show a toast; returns `{ id, dismiss, update }`.
 * - `useToast()`   – React hook that returns current toast state plus `toast` and
 *                    `dismiss` helpers for use inside components.
 */

import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

/** Maximum number of toasts visible at any one time. */
const TOAST_LIMIT = 1;

/**
 * Delay in milliseconds before a dismissed toast is fully removed from state.
 * The large value (≈11.5 days) essentially means toasts stay in the DOM until
 * they are explicitly dismissed rather than auto-expiring.
 */
const TOAST_REMOVE_DELAY = 1000000;

/**
 * A fully-resolved toast record including a generated unique `id` and optional
 * React node slots for title, description, and an action button.
 */
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

/** Discriminated union of all dispatchable action types. */
const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

/** Monotonically increasing counter used to generate unique toast IDs. */
let count = 0;

/**
 * Generates a unique string ID for each new toast by incrementing a module-level
 * counter. Wraps at `Number.MAX_SAFE_INTEGER` to avoid integer overflow.
 *
 * @returns A unique numeric string ID.
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

/** Derived type from the `actionTypes` const object. */
type ActionType = typeof actionTypes;

/**
 * Discriminated union describing every action that can be dispatched to the
 * toast reducer.
 */
type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      /** When omitted, all toasts are dismissed simultaneously. */
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      /** When omitted, all toasts are removed from state. */
      toastId?: ToasterToast['id'];
    };

/** Shape of the toast store's state. */
interface State {
  toasts: ToasterToast[];
}

/**
 * Tracks pending removal timers keyed by toast ID. Prevents duplicate timers
 * being registered for the same toast (e.g. if dismiss is called multiple times).
 */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedules a toast for permanent removal from state after `TOAST_REMOVE_DELAY`
 * milliseconds. Safe to call multiple times for the same ID — only the first
 * call creates a timer.
 *
 * @param toastId - The ID of the toast to eventually remove.
 */
const addToRemoveQueue = (toastId: string) => {
  // Guard: do not register a second timer if one is already pending.
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

/**
 * Pure state reducer for the toast store. Handles all four action types:
 * ADD, UPDATE, DISMISS, and REMOVE.
 *
 * Note: DISMISS_TOAST triggers side effects (scheduling removal timers). This
 * violates strict reducer purity but is kept here for simplicity.
 *
 * @param state  - Current toast store state.
 * @param action - Action to apply.
 * @returns      New state after applying the action.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      // Prepend the new toast and trim to the configured limit.
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      // Merge partial updates into the matching toast record.
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        // Schedule removal for the targeted toast.
        addToRemoveQueue(toastId);
      } else {
        // No ID provided: dismiss all currently visible toasts.
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      // Mark matching toasts as closed (triggers exit animation in the UI).
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case 'REMOVE_TOAST':
      // Fully purge toast(s) from state after animation has played out.
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

/**
 * Ordered list of `setState` callbacks from every active `useToast` subscriber.
 * Each mounted instance registers itself here and removes itself on unmount.
 */
const listeners: Array<(state: State) => void> = [];

/** Module-level toast state shared across all consumers. */
let memoryState: State = { toasts: [] };

/**
 * Central dispatch function. Updates the shared `memoryState` via the reducer
 * and notifies all active `useToast` subscribers so their local React state
 * stays in sync.
 *
 * @param action - The action to dispatch.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/** Props accepted by the public `toast()` function (omits the generated `id`). */
type Toast = Omit<ToasterToast, 'id'>;

/**
 * Imperatively shows a toast notification. Can be called from anywhere —
 * components, event handlers, or utility functions — without needing a hook.
 *
 * @param props - Toast configuration: title, description, variant, action, etc.
 * @returns An object with the toast `id` and imperative `dismiss` / `update`
 *          helpers for controlling the toast after it has been shown.
 *
 * @example
 * toast({ title: 'Saved!', description: 'Your changes were saved.' });
 */
function toast({ ...props }: Toast) {
  const id = genId();

  // Returns a bound updater so callers can mutate the toast after creation.
  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    });

  // Convenience dismiss bound to this specific toast ID.
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      // Auto-dismiss when the Radix toast primitive closes itself (e.g. swipe).
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

/**
 * React hook that subscribes a component to the global toast store.
 *
 * Registers the component's `setState` in the `listeners` array on mount and
 * removes it on unmount, ensuring only live components receive state updates.
 *
 * @returns The current `toasts` array plus the `toast()` creator function and a
 *          `dismiss(toastId?)` helper (omitting `toastId` dismisses all).
 *
 * @example
 * const { toast } = useToast();
 * toast({ title: 'Done!' });
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Subscribe: push this component's setState into the global listeners array.
    listeners.push(setState);
    return () => {
      // Unsubscribe on unmount to avoid calling setState on an unmounted component.
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    // Expose a bound dismiss that delegates to the module-level dispatch.
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
