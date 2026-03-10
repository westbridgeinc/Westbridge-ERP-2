/**
 * Server-side PostHog client.
 * Used in API routes and server components to pipe key events to PostHog.
 *
 * The client is lazy-initialised so it has no cost in environments where
 * POSTHOG_API_KEY is not set (local dev without analytics).
 */
import { PostHog } from "posthog-node";

let _posthog: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) return null;
  if (!_posthog) {
    _posthog = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST ?? "https://app.posthog.com",
      flushAt: 20,
      flushInterval: 10_000,
    });
  }
  return _posthog;
}

export interface PostHogEventProps {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Capture a server-side event. Fire-and-forget — never throws.
 */
export function capture(distinctId: string, event: string, properties?: PostHogEventProps): void {
  try {
    getPostHog()?.capture({ distinctId, event, properties });
  } catch {
    // PostHog errors must not break the request
  }
}

/**
 * Identify a user after login. Associates properties to the PostHog person profile.
 */
export function identify(
  distinctId: string,
  properties: { email?: string; plan?: string; companyName?: string; role?: string }
): void {
  try {
    getPostHog()?.identify({ distinctId, properties });
  } catch {
    // no-op
  }
}

/**
 * Flush buffered events before the process shuts down.
 * Call this from your shutdown handler.
 */
export async function shutdownPostHog(): Promise<void> {
  await _posthog?.shutdown();
}
