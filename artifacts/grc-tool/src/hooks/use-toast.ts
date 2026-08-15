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
 * - The system supports a maximum of `TOAST_LIMIT` simultaneously visible toasts.
 *   New toasts prepend to the list and excess old toasts are dropped via `slice`.
 *
 * Public API:
 * - `toast(props)` – Imperatively show a toast; returns `{ id, dismiss, update }`.
 * - `useToast()`   – React hook that returns current toast state plus `toast` and
 *                    `dismiss` helpers for use inside components.
 *
 * Data flow:
 *   toast(props)          → dispatch(ADD_TOAST)
 *   dismiss(id)           → dispatch(DISMISS_TOAST) → addToRemoveQueue(id)
 *   setTimeout fires      → dispatch(REMOVE_TOAST)
 *   dispatch updates      → memoryState + notifies listeners
 *   listeners call        → setState in each mounted useToast component
 */

import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

/**
 * Maximum number of toasts visible at any one time.
 * When a new toast is added beyond this limit, the oldest toast is silently
 * dropped from the list by slicing the array to `TOAST_LIMIT` entries.
 */
const TOAST_LIMIT = 1;

/**
 * Delay in milliseconds before a dismissed toast is fully removed from state.
 * The large value (≈11.5 days) essentially means toasts stay in the DOM until
 * they are explicitly dismissed rather than auto-expiring after a short timeout.
 * This design choice lets exit animations play naturally without a timer race.
 * Reduce this value (e.g. to 300ms) if you want toasts to be purged immediately
 * after their close animation completes.
 */
const TOAST_REMOVE_DELAY = 1000000;

/**
 * A fully-resolved toast record including a generated unique `id` and optional
 * React node slots for title, description, and an action button.
 * Extends `ToastProps` from the Radix UI toast primitive so all Radix props
 * (open, onOpenChange, variant, etc.) are available in addition to these fields.
 */
type ToasterToast = ToastProps & {
  /** Auto-generated unique identifier (numeric string from {@link genId}). */
  id: string;
  /** Optional heading rendered at the top of the toast. */
  title?: React.ReactNode;
  /** Optional body text rendered below the title. */
  description?: React.ReactNode;
  /** Optional action button (e.g. "Undo") rendered inside the toast. */
  action?: ToastActionElement;
};

/**
 * Discriminated union of all dispatchable action types.
 * Stored as a `const` object so TypeScript can narrow action payloads precisely
 * in the reducer's switch-case without string literal widening.
 */
const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

/**
 * Monotonically increasing counter used to generate unique toast IDs.
 * Module-level so it persists across all calls within the same browser session.
 * Wraps at `Number.MAX_SAFE_INTEGER` to avoid integer overflow in very long
 * sessions (though practically this limit will never be reached).
 */
let count = 0;

/**
 * Generates a unique string ID for each new toast by incrementing a module-level
 * counter. Wraps at `Number.MAX_SAFE_INTEGER` to avoid integer overflow.
 *
 * Using a simple integer counter rather than `crypto.randomUUID()` keeps IDs
 * short and predictable, which simplifies debugging in the React DevTools.
 *
 * @returns A unique numeric string ID (e.g. `"1"`, `"2"`, `"3"`, …).
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

/** Derived type from the `actionTypes` const object. */
type ActionType = typeof actionTypes;

/**
 * Discriminated union describing every action that can be dispatched to the
 * toast reducer. Each variant carries only the payload it needs.
 */
type Action =
  | {
      /** Creates a new toast record, prepending it to the list. */
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      /** Merges partial updates into an existing toast by matching `id`. */
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      /** Sets `open: false` on the toast (triggers exit animation) and schedules removal. */
      type: ActionType['DISMISS_TOAST'];
      /** When omitted, all toasts are dismissed simultaneously. */
      toastId?: ToasterToast['id'];
    }
  | {
      /** Permanently removes the toast from state after its exit animation. */
      type: ActionType['REMOVE_TOAST'];
      /** When omitted, all toasts are removed from state. */
      toastId?: ToasterToast['id'];
    };

/** Shape of the toast store's state. */
interface State {
  /** Ordered list of active toast records (newest first). */
  toasts: ToasterToast[];
}

/**
 * Tracks pending removal timers keyed by toast ID. Prevents duplicate timers
 * being registered for the same toast (e.g. if dismiss is called multiple times
 * before the `TOAST_REMOVE_DELAY` fires). Using a `Map` allows O(1) existence
 * checks and timer handle storage.
 */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedules a toast for permanent removal from state after `TOAST_REMOVE_DELAY`
 * milliseconds. Safe to call multiple times for the same ID — only the first
 * call creates a timer; subsequent calls return immediately without creating a
 * second `setTimeout`.
 *
 * When the timer fires it dispatches `REMOVE_TOAST` which filters the toast out
 * of `memoryState`, causing subscribed components to re-render without it.
 *
 * @param toastId - The unique ID of the toast to eventually remove.
 */
const addToRemoveQueue = (toastId: string) => {
  // Guard: do not register a second timer if one is already pending.
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    // Clean up the timeout reference so the Map does not grow unbounded.
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
 * Note: the DISMISS_TOAST case triggers side effects (scheduling removal timers
 * via `addToRemoveQueue`). This violates strict reducer purity but is kept here
 * for simplicity, following the original shadcn/ui design.
 *
 * @param state  - The current toast store state before the action is applied.
 * @param action - The action object describing the state transition.
 * @returns A new state object after applying the action (never mutates `state`).
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      // Prepend the new toast so it appears at the top, then trim to the limit.
      // `slice(0, TOAST_LIMIT)` silently discards older toasts when the list is full.
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      // Merge partial updates into the matching toast record while leaving all
      // other toasts (and non-specified fields on the target toast) intact.
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
        // Schedule removal for the targeted toast after the animation delay.
        addToRemoveQueue(toastId);
      } else {
        // No ID provided: dismiss all currently visible toasts.
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      // Mark matching toasts as closed (triggers Radix UI's exit animation).
      // A toast with `open: false` will animate out; REMOVE_TOAST fully purges it.
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
      // Fully purge toast(s) from state after the exit animation has played out.
      // This prevents stale DOM nodes from accumulating in the Toaster.
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
 * Each mounted `useToast` instance pushes its local `setState` here on mount and
 * splices it out on unmount. When `dispatch` runs, it calls every function in
 * this array so all components receive the updated state synchronously.
 */
const listeners: Array<(state: State) => void> = [];

/**
 * Module-level toast state shared across all `useToast` consumers.
 * Initialised to an empty toasts array. Updated exclusively via {@link dispatch}.
 */
let memoryState: State = { toasts: [] };

/**
 * Central dispatch function. Applies the action to the current `memoryState`
 * via the pure {@link reducer} and synchronously notifies all active
 * `useToast` subscribers so their local React state stays in sync.
 *
 * Because `memoryState` is module-level, `dispatch` can be called from anywhere
 * in the application (e.g. from the imperative `toast()` function) without
 * needing access to a React component or hook.
 *
 * @param action - The action to apply to the shared toast store.
 */
function dispatch(action: Action) {
  // Apply the action immutably via the reducer.
  memoryState = reducer(memoryState, action);
  // Notify all mounted useToast subscribers so they re-render with the new state.
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/**
 * Props accepted by the public `toast()` function.
 * Omits the auto-generated `id` field because callers should not supply it;
 * {@link genId} assigns the ID internally.
 */
type Toast = Omit<ToasterToast, 'id'>;

/**
 * Imperatively shows a toast notification. Can be called from anywhere —
 * components, event handlers, API response handlers, or utility functions —
 * without needing a hook or a component reference.
 *
 * Internally calls {@link dispatch} with `ADD_TOAST` to add the toast to the
 * shared state. All mounted `useToast` components receive the update
 * synchronously via the `listeners` array.
 *
 * The returned `dismiss` function is bound to the specific toast's `id` so
 * callers can dismiss their toast without knowing the internal ID. The `update`
 * function allows mutating the toast (e.g. changing the title or description)
 * after it has already been shown — useful for "loading → success" patterns.
 *
 * @param props - Toast configuration: `title`, `description`, `variant`,
 *                `action`, and any other `ToastProps`. All fields are optional
 *                except those required by the Radix UI toast primitive.
 * @returns An object with:
 *   - `id` {string}       – The auto-generated unique toast ID.
 *   - `dismiss` {() => void} – Closes this specific toast.
 *   - `update` {(props: ToasterToast) => void} – Replaces this toast's props.
 *
 * @example
 * toast({ title: 'Saved!', description: 'Your changes were saved.' });
 *
 * @example
 * // Loading → success pattern:
 * const { update } = toast({ title: 'Saving…' });
 * await saveData();
 * update({ id, title: 'Saved!' });
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
      // Start in the open state so the Radix primitive renders it immediately.
      open: true,
      // Auto-dismiss when the Radix toast primitive closes itself (e.g. the user
      // swipes to dismiss or the close button is clicked). Keeps `open` state
      // in sync with the primitive's internal state.
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
 * On mount, registers the component's local `setState` in the module-level
 * `listeners` array. On unmount, splices it back out. Whenever `dispatch` is
 * called (from `toast()`, `dismiss()`, or internally), every listener is
 * called with the new `memoryState`, causing each subscribed component to
 * re-render with the latest toast list.
 *
 * The hook is typically consumed by the `<Toaster>` component in the UI layer
 * to render the actual toast DOM nodes, but it can also be used in any page
 * component to fire toasts in response to user actions.
 *
 * @returns An object containing:
 *   - `toasts` {ToasterToast[]} – The current ordered list of active toasts.
 *   - `toast`  {(props: Toast) => { id, dismiss, update }} – Creates a new toast.
 *   - `dismiss` {(toastId?: string) => void} – Dismisses a specific toast, or all
 *     toasts when called without an argument.
 *
 * @example
 * const { toast } = useToast();
 * toast({ title: 'Done!' });
 *
 * @example
 * const { dismiss } = useToast();
 * dismiss(); // Dismiss all visible toasts
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Subscribe: push this component's setState into the global listeners array.
    // All future dispatch calls will invoke setState with the updated memoryState.
    listeners.push(setState);
    return () => {
      // Unsubscribe on unmount to avoid calling setState on an unmounted component
      // and to prevent the listeners array from growing indefinitely.
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
    // Calling without a toastId dismisses all currently active toasts.
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
