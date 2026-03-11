// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { arrayMove } from '@dnd-kit/sortable'

// ─── dnd-kit mocks ──────────────────────────────────────────────────────────
// DndContext and SortableContext need JSDOM pointer-event mocks.
// We mock them as pass-through wrappers so editor renders normally.
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/sortable')>('@dnd-kit/sortable')
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    }),
    verticalListSortingStrategy: 'vertical',
  }
})

// Mock react-markdown to avoid remark pipeline complexity in tests
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

// Mock next/image (used by some components)
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

import ArticleEditor from './ArticleEditor'
import ArticleViewer from './ArticleViewer'
import type { Article } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const defaultEditorProps = {
  article: null,
  userName: 'TestUser',
  folders: [],
  onSaved: vi.fn(),
  onCancel: vi.fn(),
}

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'art-1',
    title: 'Test Article',
    author_id: 'user-1',
    author_name: 'TestUser',
    blocks: [],
    is_published: false,
    folder_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─── ArticleEditor tests ──────────────────────────────────────────────────────

describe('ArticleEditor — block insertion buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows insertion buttons for all 4 block types', () => {
    render(<ArticleEditor {...defaultEditorProps} />)
    expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /video/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /image/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clip/i })).toBeInTheDocument()
  })

  test('clicking "+ Text" adds a text block', () => {
    render(<ArticleEditor {...defaultEditorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add text/i }))
    // Text block should render a textarea
    expect(screen.getByPlaceholderText(/write markdown/i)).toBeInTheDocument()
  })

  test('clicking "+ Image" adds an image block with URL input', () => {
    render(<ArticleEditor {...defaultEditorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add image/i }))
    expect(screen.getByPlaceholderText(/image url/i)).toBeInTheDocument()
  })

  test('clicking "+ Clip" adds a clip block with videoRef and startSeconds inputs', () => {
    render(<ArticleEditor {...defaultEditorProps} />)
    fireEvent.click(screen.getByRole('button', { name: /add clip/i }))
    expect(screen.getByPlaceholderText(/youtube.*url/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/start/i)).toBeInTheDocument()
  })

  test('each block has a delete button that removes the block', () => {
    render(<ArticleEditor {...defaultEditorProps} />)
    // Add a text block
    fireEvent.click(screen.getByRole('button', { name: /add text/i }))
    // Textarea should be there
    expect(screen.getByPlaceholderText(/write markdown/i)).toBeInTheDocument()
    // Click delete
    fireEvent.click(screen.getByRole('button', { name: /delete|remove/i }))
    // Block should be gone
    expect(screen.queryByPlaceholderText(/write markdown/i)).not.toBeInTheDocument()
  })
})

// ─── arrayMove logic ─────────────────────────────────────────────────────────

describe('arrayMove reorder logic', () => {
  test('arrayMove([A, B, C], 0, 2) produces [B, C, A]', () => {
    const result = arrayMove(['A', 'B', 'C'], 0, 2)
    expect(result).toEqual(['B', 'C', 'A'])
  })

  test('arrayMove([A, B, C], 2, 0) produces [C, A, B]', () => {
    const result = arrayMove(['A', 'B', 'C'], 2, 0)
    expect(result).toEqual(['C', 'A', 'B'])
  })
})

// ─── ArticleViewer tests ──────────────────────────────────────────────────────

describe('ArticleViewer — renders all 4 block types', () => {
  test('text block renders via ReactMarkdown', () => {
    const article = makeArticle({
      blocks: [{ type: 'text', content: '**Hello** world' }],
    })
    render(<ArticleViewer article={article} />)
    const md = screen.getByTestId('markdown')
    expect(md).toHaveTextContent('**Hello** world')
  })

  test('video block renders an iframe', () => {
    const article = makeArticle({
      blocks: [{ type: 'video', videoType: 'youtube', videoRef: 'abc123', title: 'My video' }],
    })
    render(<ArticleViewer article={article} />)
    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.src).toContain('abc123')
  })

  test('image block renders an img element', () => {
    const article = makeArticle({
      blocks: [{ type: 'image', url: 'https://example.com/photo.jpg', alt: 'A photo', caption: 'Nice shot' }],
    })
    render(<ArticleViewer article={article} />)
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.src).toBe('https://example.com/photo.jpg')
  })

  test('clip block renders an iframe with start param', () => {
    const article = makeArticle({
      blocks: [{ type: 'clip', videoRef: 'xyz999', startSeconds: 90, caption: 'Great tack' }],
    })
    render(<ArticleViewer article={article} />)
    const iframe = document.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.src).toContain('xyz999')
    expect(iframe?.src).toContain('start=90')
  })

  test('clip block with endSeconds includes end param in iframe src', () => {
    const article = makeArticle({
      blocks: [{ type: 'clip', videoRef: 'xyz999', startSeconds: 60, endSeconds: 120 }],
    })
    render(<ArticleViewer article={article} />)
    const iframe = document.querySelector('iframe')
    expect(iframe?.src).toContain('end=120')
  })

  test('unknown block type does not crash', () => {
    const article = makeArticle({
      // @ts-expect-error intentional unknown type for robustness test
      blocks: [{ type: 'unknown', data: 'foo' }],
    })
    expect(() => render(<ArticleViewer article={article} />)).not.toThrow()
  })

  test('image block shows error fallback text on load failure', async () => {
    const article = makeArticle({
      blocks: [{ type: 'image', url: 'https://bad-url.com/broken.jpg', alt: 'broken' }],
    })
    render(<ArticleViewer article={article} />)
    const img = document.querySelector('img')!
    // Simulate load error
    fireEvent.error(img)
    await waitFor(() => {
      expect(screen.getByText(/image could not be loaded/i)).toBeInTheDocument()
    })
  })
})
