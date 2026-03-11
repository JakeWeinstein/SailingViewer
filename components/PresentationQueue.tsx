'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquare, HelpCircle, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Comment } from '@/lib/types'
import { initials, avatarColor } from '@/lib/comment-utils'
import { formatTime } from '@/lib/types'
import clsx from 'clsx'

interface PresentationQueueProps {
  groups: Array<{ author: string; items: Comment[] }>
  activeItemId: string | null
  onSelectItem: (id: string) => void
  onReorder: (reordered: Comment[]) => void
  showArchived: boolean
}

function SortableItem({
  item,
  isActive,
  onSelect,
}: {
  item: Comment
  isActive: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isQA = !item.video_id
  const truncated = item.comment_text.length > 80
    ? item.comment_text.slice(0, 80) + '…'
    : item.comment_text

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-white ring-1 ring-blue-400'
          : 'hover:bg-gray-800'
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="mt-0.5 shrink-0 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Type icon */}
      <div className="mt-0.5 shrink-0">
        {isQA
          ? <HelpCircle className="h-4 w-4 text-purple-400" />
          : <MessageSquare className="h-4 w-4 text-blue-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className={clsx('text-xs leading-snug line-clamp-2', isActive ? 'text-gray-900' : 'text-gray-300')}>{truncated}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {!isQA && item.timestamp_seconds != null && (
            <span className={clsx('text-xs font-mono px-1 py-0.5 rounded', isActive ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/50 text-blue-300')}>
              {formatTime(item.timestamp_seconds)}
            </span>
          )}
          {isQA && (
            <span className={clsx('text-xs px-1 py-0.5 rounded', isActive ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/50 text-purple-300')}>
              Q&A
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AuthorGroup({
  author,
  items,
  activeItemId,
  onSelectItem,
  onReorder,
  showArchived,
}: {
  author: string
  items: Comment[]
  activeItemId: string | null
  onSelectItem: (id: string) => void
  onReorder: (ids: string[], reordered: Comment[]) => void
  showArchived: boolean
}) {
  const [open, setOpen] = useState(true)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    onReorder(
      reordered.map((i) => i.id),
      reordered
    )
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800 rounded-lg transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        }
        <div
          className={clsx(
            'h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
            avatarColor(author)
          )}
        >
          {initials(author)}
        </div>
        <span className="text-sm font-semibold text-gray-200 truncate flex-1">{author}</span>
        <span className="text-xs text-gray-400 shrink-0">{items.length}</span>
      </button>

      {open && (
        showArchived ? (
          // Archived view — no drag-and-drop
          <div className="ml-2 space-y-0.5">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isActive={item.id === activeItemId}
                onSelect={() => onSelectItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="ml-2 space-y-0.5">
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    isActive={item.id === activeItemId}
                    onSelect={() => onSelectItem(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )
      )}
    </div>
  )
}

export default function PresentationQueue({
  groups,
  activeItemId,
  onSelectItem,
  onReorder,
  showArchived,
}: PresentationQueueProps) {
  function handleGroupReorder(
    _ids: string[],
    reorderedItems: Comment[],
    authorItems: Comment[]
  ) {
    // Merge reordered items back into the full flat list
    const allItems = groups.flatMap((g) => g.items)
    const authorSet = new Set(authorItems.map((i) => i.id))
    const nonAuthorItems = allItems.filter((i) => !authorSet.has(i.id))
    onReorder([...nonAuthorItems, ...reorderedItems])
  }

  return (
    <div className="py-2">
      {groups.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No items in queue
        </div>
      )}
      {groups.map(({ author, items }) => (
        <AuthorGroup
          key={author}
          author={author}
          items={items}
          activeItemId={activeItemId}
          onSelectItem={onSelectItem}
          showArchived={showArchived}
          onReorder={(ids, reordered) =>
            handleGroupReorder(ids, reordered, items)
          }
        />
      ))}
    </div>
  )
}
