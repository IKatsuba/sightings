'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { reportPageview, type BeaconOptions } from 'sightings/beacon';

/**
 * The human half: one report per App Router navigation.
 *
 * ```tsx
 * // app/layout.tsx
 * <Sightings redact={{ dropPaths: ['/admin', '/invite'] }} />
 * ```
 *
 * `redact` must mirror the server's. The server pass is the one your privacy
 * page rests on, but this one is what keeps an identifier from leaving the
 * device at all — so a route you drop on the server should be dropped here too.
 */
function PageviewBeacon(options: BeaconOptions) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // One report per url. Guards against Strict Mode's double effect run in dev
  // and against re-renders that change neither path nor query.
  const reported = useRef<string | null>(null);

  const { basePath, redact } = options;

  useEffect(() => {
    const url = window.location.href;
    if (reported.current === url) return;
    reported.current = url;

    reportPageview({ basePath, redact });
    // `redact` is an options object, and depending on it would re-fire the
    // beacon on every render that rebuilds the literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, basePath]);

  return null;
}

/**
 * `useSearchParams` opts the tree into client-side rendering, so the beacon
 * sits behind its own Suspense boundary and the shell around it stays static.
 */
export function Sightings(options: BeaconOptions = {}) {
  return (
    <Suspense fallback={null}>
      <PageviewBeacon {...options} />
    </Suspense>
  );
}
