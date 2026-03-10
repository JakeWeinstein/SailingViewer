import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}))

// Mock global fetch
global.fetch = vi.fn()

// Mock window.YT (YouTube IFrame Player API) — only available in browser-like environments
if (typeof window !== 'undefined') {
  const mockPlayer = {
    getCurrentTime: vi.fn(() => 0),
    seekTo: vi.fn(),
    loadVideoById: vi.fn(),
    destroy: vi.fn(),
    getPlayerState: vi.fn(() => 1),
  }

  window.YT = {
    Player: vi.fn(() => mockPlayer),
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  } as any
}
