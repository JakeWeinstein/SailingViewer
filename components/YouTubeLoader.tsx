'use client'

import { useEffect } from 'react'
import { loadYouTubeAPI } from '@/lib/youtube-api'

/**
 * Injected once in the root layout. Calls loadYouTubeAPI() so the YouTube
 * IFrame API script is loaded globally on first client render. Subsequent
 * calls to onYouTubeReady() will fire immediately if the API is already ready.
 */
export default function YouTubeLoader() {
  useEffect(() => {
    loadYouTubeAPI()
  }, [])
  return null
}
