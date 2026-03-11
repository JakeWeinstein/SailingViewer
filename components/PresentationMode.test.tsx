import { describe, it } from 'vitest'

describe('PresentationMode (REV-02)', () => {
  it.todo('renders split-pane layout with queue sidebar and detail pane')
  it.todo('groups items by sailor name')
  it.todo('shows collapsible author sections')
})

describe('PresentationMode — keyboard shortcuts (REV-04)', () => {
  it.todo('ArrowDown selects next item')
  it.todo('ArrowUp selects previous item')
  it.todo('R marks current item as reviewed')
  it.todo('Escape navigates back to dashboard')
  it.todo('ignores shortcuts when input is focused')
})

describe('PresentationMode — reference panel (REV-06)', () => {
  it.todo('opens reference side panel on button click')
  it.todo('closes reference side panel')
})

describe('PresentationMode — reply (REV-07)', () => {
  it.todo('shows inline reply field for active item')
  it.todo('submits reply via POST /api/comments')
})
