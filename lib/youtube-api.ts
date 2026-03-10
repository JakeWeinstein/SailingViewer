// Centralized YouTube IFrame API loader with callback queue.
//
// Problem this solves: multiple components calling YT.Player() before the
// IFrame API script has finished loading cause a race condition. This module
// provides a single shared queue — every caller registers via onYouTubeReady()
// and the global window.onYouTubeIframeAPIReady callback fires all of them once
// the script loads. The script is only injected once regardless of how many
// times loadYouTubeAPI() is called.

declare global {
  interface Window {
    // YT is declared in components/VideoWatchView.tsx with its full type.
    // Declaring it here would cause a conflict, so we reference it only at
    // call sites where the full YT type is already in scope.
    onYouTubeIframeAPIReady: () => void
  }
}

// Module-level state — persists for the lifetime of the page.
const pendingCallbacks: (() => void)[] = []
let apiReady = false

// Register the global callback exactly once when the module is first imported
// on the client side. Subsequent imports share the same module singleton.
if (typeof window !== 'undefined') {
  window.onYouTubeIframeAPIReady = () => {
    apiReady = true
    pendingCallbacks.forEach(cb => cb())
    pendingCallbacks.length = 0
  }
}

/**
 * Register a callback to run when the YouTube IFrame API is ready.
 * If the API is already loaded the callback fires synchronously.
 * Call loadYouTubeAPI() before or alongside this to trigger the load.
 */
export function onYouTubeReady(cb: () => void): void {
  if (apiReady) {
    cb()
  } else {
    pendingCallbacks.push(cb)
  }
}

/**
 * Inject the YouTube IFrame API script into the document head.
 * Safe to call multiple times — the script tag is only created once.
 * No-op on the server.
 */
export function loadYouTubeAPI(): void {
  if (typeof window === 'undefined') return
  if (document.getElementById('yt-iframe-api')) return
  const tag = document.createElement('script')
  tag.id = 'yt-iframe-api'
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
}
