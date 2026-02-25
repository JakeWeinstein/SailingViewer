'use client'

import { useState } from 'react'
import { Folder, FolderOpen, Plus, Trash2, Check, X, Edit2, ChevronRight } from 'lucide-react'
import type { ReferenceFolder } from '@/lib/types'

interface Props {
  folders: ReferenceFolder[]
  onFoldersChanged: (folders: ReferenceFolder[]) => void
}

function EditableRow({
  value,
  description,
  onSave,
  onCancel,
}: {
  value: string
  description: string
  onSave: (name: string, desc: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(value)
  const [desc, setDesc] = useState(description)
  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        autoFocus
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <button
          onClick={() => name.trim() && onSave(name.trim(), desc.trim())}
          disabled={!name.trim()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Check className="h-3 w-3" /> Save
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export default function FolderManager({ folders, onFoldersChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingParent, setAddingParent] = useState<string | null | 'top'>('top')
  const [showAddForm, setShowAddForm] = useState(false)

  const topLevel = folders.filter((f) => !f.parent_id).sort((a, b) => a.sort_order - b.sort_order)

  function getChildren(parentId: string) {
    return folders.filter((f) => f.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)
  }

  async function createFolder(name: string, desc: string, parentId: string | null) {
    const res = await fetch('/api/reference-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc, parent_id: parentId, sort_order: folders.length }),
    })
    if (res.ok) {
      const newFolder = await res.json()
      onFoldersChanged([...folders, newFolder])
    }
    setShowAddForm(false)
    setAddingParent('top')
  }

  async function updateFolder(id: string, name: string, desc: string) {
    const res = await fetch(`/api/reference-folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: desc }),
    })
    if (res.ok) {
      const updated = await res.json()
      onFoldersChanged(folders.map((f) => f.id === id ? updated : f))
    }
    setEditingId(null)
  }

  async function deleteFolder(id: string) {
    if (!confirm('Delete this folder? Videos in it will become unfoldered.')) return
    const res = await fetch(`/api/reference-folders/${id}`, { method: 'DELETE' })
    if (res.ok) onFoldersChanged(folders.filter((f) => f.id !== id && f.parent_id !== id))
  }

  function FolderRow({ folder, depth = 0 }: { folder: ReferenceFolder; depth?: number }) {
    const children = getChildren(folder.id)
    const [childOpen, setChildOpen] = useState(false)

    return (
      <div>
        <div
          className="flex items-start gap-2 py-2 group"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <button
            onClick={() => setChildOpen((v) => !v)}
            className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-600"
          >
            {children.length > 0 ? (
              childOpen ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )}
          </button>

          {editingId === folder.id ? (
            <div className="flex-1">
              <EditableRow
                value={folder.name}
                description={folder.description ?? ''}
                onSave={(n, d) => updateFolder(folder.id, n, d)}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800">{folder.name}</span>
              {folder.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{folder.description}</p>
              )}
            </div>
          )}

          {editingId !== folder.id && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
              {depth === 0 && (
                <button
                  onClick={() => { setAddingParent(folder.id); setShowAddForm(true) }}
                  title="Add subfolder"
                  className="p-1 text-gray-300 hover:text-blue-500 rounded"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setEditingId(folder.id)}
                className="p-1 text-gray-300 hover:text-gray-600 rounded"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => deleteFolder(folder.id)}
                className="p-1 text-gray-300 hover:text-red-400 rounded"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {childOpen && children.map((child) => (
          <FolderRow key={child.id} folder={child} depth={depth + 1} />
        ))}

        {showAddForm && addingParent === folder.id && (
          <div className="ml-8 mt-1 mb-2">
            <EditableRow
              value=""
              description=""
              onSave={(n, d) => createFolder(n, d, folder.id)}
              onCancel={() => { setShowAddForm(false); setAddingParent('top') }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Manage folders</p>
        <button
          onClick={() => { setAddingParent('top'); setShowAddForm(true) }}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> New folder
        </button>
      </div>

      {showAddForm && addingParent === 'top' && (
        <div className="bg-gray-50 rounded-lg p-3">
          <EditableRow
            value=""
            description=""
            onSave={(n, d) => createFolder(n, d, null)}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {topLevel.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-400 italic">No folders yet. Create one to organize videos.</p>
      )}

      <div className="space-y-0.5">
        {topLevel.map((folder) => (
          <FolderRow key={folder.id} folder={folder} depth={0} />
        ))}
      </div>
    </div>
  )
}
