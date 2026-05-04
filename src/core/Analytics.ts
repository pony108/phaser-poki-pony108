export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    __sparkleWashAnalytics?: Array<{
      event: string
      payload: AnalyticsPayload
      timestamp: number
    }>
  }
}

export class Analytics {
  static track(event: string, payload: AnalyticsPayload = {}): void {
    const entry = {
      event,
      payload,
      timestamp: Date.now()
    }

    if (!window.__sparkleWashAnalytics) {
      window.__sparkleWashAnalytics = []
    }
    window.__sparkleWashAnalytics.push(entry)

    window.dispatchEvent(new CustomEvent('sparklewash:analytics', { detail: entry }))
  }
}
