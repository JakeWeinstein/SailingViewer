'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Shield, MessageSquare, ChevronDown, ChevronUp, Loader2, Reply } from 'lucide-react'
import { timeAgo, initials, avatarColor } from '@/lib/comment-utils'
import type { Comment } from '@/lib/supabase'
import clsx from 'clsx'

interface QATabProps {
  userName: string
}

export default function QATab({ userName }: QATabProps) {
  const [posts, setPosts] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  // Composer
  const [commentText, setCommentText] = useState('')
  const [sendToCaptain, setSendToCaptain] = useState(false)
  const [posting, setPosting] = useState(false)

  // Replies
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [repliesByPost, setRepliesByPost] = useState<Map<string, Comment[]>>(new Map())
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [postingReply, setPostingReply] = useState(false)
  const replyInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  async function fetchPosts() {
    setLoading(true)
    try {
      const res = await fetch('/api/comments?type=qa')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setPosts(data)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handlePost() {
    if (!commentText.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userName,
          comment_text: commentText.trim(),
          send_to_captain: sendToCaptain,
        }),
      })
      if (res.ok) {
        const newPost = await res.json()
        newPost.reply_count = 0
        setPosts((prev) => [newPost, ...prev])
        setCommentText('')
        setSendToCaptain(false)
      }
    } finally {
      setPosting(false)
    }
  }

  async function toggleReplies(postId: string) {
    if (expandedReplies.has(postId)) {
      setExpandedReplies((prev) => { const next = new Set(prev); next.delete(postId); return next })
      return
    }
    setExpandedReplies((prev) => new Set(prev).add(postId))
    if (!repliesByPost.has(postId)) {
      setLoadingReplies((prev) => new Set(prev).add(postId))
      try {
        const res = await fetch(`/api/comments?parentId=${postId}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setRepliesByPost((prev) => new Map(prev).set(postId, data))
        }
      } finally {
        setLoadingReplies((prev) => { const next = new Set(prev); next.delete(postId); return next })
      }
    }
  }

  function startReply(postId: string) {
    setReplyingTo(postId)
    setReplyText('')
    if (!expandedReplies.has(postId)) {
      toggleReplies(postId)
    }
    setTimeout(() => replyInputRef.current?.focus(), 50)
  }

  async function handleReply(postId: string) {
    if (!replyText.trim()) return
    setPostingReply(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userName,
          comment_text: replyText.trim(),
          parent_id: postId,
        }),
      })
      if (res.ok) {
        const newReply = await res.json()
        setRepliesByPost((prev) => {
          const next = new Map(prev)
          next.set(postId, [...(next.get(postId) ?? []), newReply])
          return next
        })
        setPosts((prev) => prev.map((p) =>
          p.id === postId ? { ...p, reply_count: (p.reply_count ?? 0) + 1 } : p
        ))
        setReplyText('')
        setReplyingTo(null)
      }
    } finally {
      setPostingReply(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Q&A</h2>
        <p className="text-xs text-gray-400 mt-0.5">Ask questions and start discussions with the team</p>
      </div>

      {/* Composer */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={clsx('h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', avatarColor(userName))}>
            {initials(userName)}
          </div>
          <span className="text-sm font-medium text-gray-700">{userName}</span>
        </div>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost() }}
          rows={3}
          placeholder="Ask a question or start a discussion... (Cmd+Enter to post)"
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={sendToCaptain}
              onChange={(e) => setSendToCaptain(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 h-3 w-3"
            />
            <Shield className="h-3 w-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="text-xs text-gray-500">Submit to captain for review</span>
          </label>
          <button
            onClick={handlePost}
            disabled={posting || !commentText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Posts */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No posts yet</p>
          <p className="text-sm mt-1">Be the first to ask a question or start a discussion.</p>
        </div>
      )}

      <div className="space-y-3">
        {posts.map((post) => {
          const isRepliesOpen = expandedReplies.has(post.id)
          const replies = repliesByPost.get(post.id) ?? []
          const replyCount = post.reply_count ?? 0
          const isLoadingReplies = loadingReplies.has(post.id)

          return (
            <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Post */}
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={clsx('h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0', avatarColor(post.author_name))}>
                    {initials(post.author_name)}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{post.author_name}</span>
                  <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
                  {post.send_to_captain && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                      <Shield className="h-2.5 w-2.5" />
                      Review
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.comment_text}</p>

                {/* Action bar */}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => startReply(post.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Reply
                  </button>
                  {replyCount > 0 && (
                    <button
                      onClick={() => toggleReplies(post.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isRepliesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                    </button>
                  )}
                </div>
              </div>

              {/* Replies section */}
              {isRepliesOpen && (
                <div className="border-t border-gray-50 bg-gray-50/50">
                  {isLoadingReplies && (
                    <div className="px-4 py-3 text-xs text-gray-400">Loading replies...</div>
                  )}
                  {replies.map((reply) => (
                    <div key={reply.id} className="ml-6 pl-3 border-l-2 border-gray-200 mx-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={clsx('h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0', avatarColor(reply.author_name))}>
                          {initials(reply.author_name)}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{reply.author_name}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(reply.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{reply.comment_text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply composer */}
              {replyingTo === post.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                  <div className="ml-6 pl-3 border-l-2 border-blue-200 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className={clsx('h-4 w-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0', avatarColor(userName))}>
                        {initials(userName)}
                      </div>
                      <span className="text-xs font-medium text-gray-600">{userName}</span>
                    </div>
                    <textarea
                      ref={replyInputRef}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(post.id) }}
                      rows={2}
                      placeholder="Write a reply..."
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReply(post.id)}
                        disabled={postingReply || !replyText.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Send className="h-3 w-3" />
                        {postingReply ? 'Posting...' : 'Reply'}
                      </button>
                      <button
                        onClick={() => { setReplyingTo(null); setReplyText('') }}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
