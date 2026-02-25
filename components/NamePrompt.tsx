'use client'

import { useState } from 'react'
import { Anchor } from 'lucide-react'

export default function NamePrompt({ onSet }: { onSet: (name: string) => void }) {
  const [value, setValue] = useState('')

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-600 rounded-xl mb-3">
            <Anchor className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Welcome to TheoryForm</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your name to leave comments and save favorites</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSet(value.trim()) }} className="space-y-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Get started
          </button>
        </form>
      </div>
    </div>
  )
}
