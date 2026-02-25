import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map((line) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  })
}

// POST /api/import-sheet — captain only
export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = await req.json()
  const sheetId = extractSheetId(url)
  if (!sheetId) {
    return NextResponse.json({ error: 'Could not find a spreadsheet ID in that URL' }, { status: 400 })
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`

  let text: string
  try {
    const res = await fetch(csvUrl, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
  } catch {
    return NextResponse.json({
      error: 'Could not fetch the spreadsheet. Make sure it is shared as "Anyone with the link can view".',
    }, { status: 400 })
  }

  const rows = parseCSV(text)
  // Skip header row; expect columns: Name (0), File ID (1), Link (2)
  const videos = rows
    .slice(1)
    .filter((row) => row[0] && row[1])
    .map((row) => ({ name: row[0], id: row[1] }))

  if (videos.length === 0) {
    return NextResponse.json({ error: 'No videos found in the spreadsheet' }, { status: 400 })
  }

  return NextResponse.json(videos)
}
