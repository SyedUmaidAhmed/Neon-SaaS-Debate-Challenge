/// <reference types="vite/client" />
import posthog from 'posthog-js';

// Initialize PostHog using the user's provided configuration for session recordings
export const initPostHog = () => {
  posthog.init('phc_uEZXpfCLa5cgebxJFf2heHWFuUJ6DiB25i4VxGAawcrB', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: true, // Enable autocapture for better session recording context
    capture_pageview: true,
  });
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (posthog.__loaded) {
    posthog.capture(eventName, properties);
  } else {
    console.log(`[Analytics Mock] Event: ${eventName}`, properties);
  }
};
