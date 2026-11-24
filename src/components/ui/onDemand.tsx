import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

/**
 * A component whose code downloads the first time it renders, with its own Suspense boundary so only its spot waits
 * (a page-level boundary would swap the whole page for a loader). For dialogs and screens that open on a click.
 */
export function onDemand<P extends object>(load: () => Promise<ComponentType<P>>, fallback: ReactNode = null) {
  const Lazy = lazy(() => load().then(component => ({ default: component })));
  return function OnDemand(props: P) {
    return <Suspense fallback={fallback}><Lazy {...props} /></Suspense>;
  };
}
