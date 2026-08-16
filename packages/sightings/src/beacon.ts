import { redactUrl, type RedactOptions } from './redact';

/**
 * The browser half, framework-free: one POST per navigation.
 *
 * Imported from `sightings/beacon` rather than the package root so a client
 * bundle never pulls in the crawler list or the storage layer. Nothing here
 * touches storage of any kind — no cookie, no `localStorage`, no fingerprint.
 * The visitor hash is derived on the server from the request itself, which is
 * what makes the whole thing cookieless without a consent banner standing in
 * front of it.
 */

export type BeaconOptions = {
  /** Where the handler is mounted. Defaults to `/api/pv`. */
  basePath?: string;
  /**
   * Must mirror the server's redaction. Running it here too is not belt and
   * braces: it is what keeps an identifier from ever leaving the device.
   */
  redact?: RedactOptions;
  /** Defaults to `window.location.href`. */
  url?: string;
  /** Defaults to `document.referrer`. */
  referrer?: string;
};

/**
 * The referrer is cut down to its host, and only when external: a foreign path
 * can carry tokens and ids that are not yours to keep, and an internal
 * referrer is just the previous pageview restated.
 */
function externalHost(referrer: string, currentHost: string): string | null {
  try {
    const source = new URL(referrer);

    return source.host === currentHost ? null : source.host;
  } catch {
    // No referrer — a direct visit.
    return null;
  }
}

/**
 * Report one pageview. Returns `false` when the url was redacted away or the
 * document is hidden from us — never throws, because analytics failing is not
 * a reason for a page to fail.
 */
export function reportPageview(options: BeaconOptions = {}): boolean {
  if (typeof window === 'undefined') return false;

  const redacted = redactUrl(
    options.url ?? window.location.href,
    options.redact
  );
  if (!redacted) return false;

  const body = JSON.stringify({
    url: redacted.toString(),
    referrer: externalHost(
      options.referrer ?? document.referrer,
      window.location.host
    )
  });

  const path = options.basePath ?? '/api/pv';

  try {
    if (
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(path, new Blob([body]))
    ) {
      return true;
    }

    // `keepalive` so a click that navigates away still delivers the view.
    void fetch(path, { method: 'POST', body, keepalive: true }).catch(() => {
      // A blocked or failed beacon is the visitor's prerogative.
    });

    return true;
  } catch {
    return false;
  }
}
