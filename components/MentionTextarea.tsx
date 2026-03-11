'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

export interface MentionUser {
  id: string
  username: string
  displayName: string
}

interface MentionTextareaProps {
  value: string
  onChange: (val: string) => void
  users: MentionUser[]
  placeholder?: string
  rows?: number
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  autoResize?: boolean
}

const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(
    { value, onChange, users, placeholder, rows = 3, className, onKeyDown, onFocus, autoResize = false },
    ref,
  ) {
    const [mentionSearch, setMentionSearch] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)

    const internalRef = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

    // Filter users when mentionSearch is active
    const filteredUsers =
      mentionSearch !== null
        ? users
            .filter(
              (u) =>
                u.username.toLowerCase().startsWith(mentionSearch.toLowerCase()) ||
                u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()),
            )
            .slice(0, 8)
        : []

    // Auto-resize logic
    useEffect(() => {
      if (!autoResize || !internalRef.current) return
      const el = internalRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }, [value, autoResize])

    // Reset selected index when filtered list changes
    useEffect(() => {
      setSelectedIndex(0)
    }, [mentionSearch])

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      const newVal = e.target.value
      onChange(newVal)

      // Look backward from caret for /@(\w*)$/ pattern
      const caret = e.target.selectionStart ?? newVal.length
      const textBeforeCaret = newVal.slice(0, caret)
      const match = textBeforeCaret.match(/@(\w*)$/)
      if (match) {
        setMentionSearch(match[1])
      } else {
        setMentionSearch(null)
      }
    }

    function selectUser(user: MentionUser) {
      const el = internalRef.current
      if (!el) return

      const caret = el.selectionStart ?? value.length
      const textBeforeCaret = value.slice(0, caret)
      const match = textBeforeCaret.match(/@(\w*)$/)
      if (!match) return

      const startOfMention = caret - match[0].length
      const newVal = value.slice(0, startOfMention) + `@${user.username} ` + value.slice(caret)
      onChange(newVal)
      setMentionSearch(null)

      // Refocus and position caret after inserted text
      setTimeout(() => {
        if (!el) return
        const newCaret = startOfMention + user.username.length + 2 // '@' + username + ' '
        el.focus()
        el.setSelectionRange(newCaret, newCaret)
      }, 0)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (mentionSearch !== null && filteredUsers.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredUsers.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          selectUser(filteredUsers[selectedIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setMentionSearch(null)
          return
        }
      }

      // Pass through to parent handler when dropdown is closed or no match
      onKeyDown?.(e)
    }

    return (
      <div className="relative">
        <textarea
          ref={internalRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder={placeholder}
          rows={rows}
          className={className}
        />

        {filteredUsers.length > 0 && mentionSearch !== null && (
          <div className="absolute left-0 right-0 bottom-full mb-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredUsers.map((user, idx) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => {
                  // Use mousedown to prevent textarea blur before click registers
                  e.preventDefault()
                  selectUser(user)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-sm font-medium text-gray-800">{user.displayName}</span>
                <span className="text-xs text-gray-400">@{user.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  },
)

export default MentionTextarea
