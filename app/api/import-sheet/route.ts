import { NextRequest, NextResponse } from 'next/server'
import { getTokenPayload } from '@/lib/auth'

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(current.trim())
        current = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(current.trim())
        if (row.some((c) => c)) rows.push(row)
        row = []
        current = ''
      } else {
        current += ch
      }
    }
  }
  row.push(current.trim())
  if (row.some((c) => c)) rows.push(row)

  return rows
}

// POST /api/import-sheet
// Body: { sheetUrl: string }
// Returns: { videos: { name: string; id: string }[] }
export async function POST(req: NextRequest) {
  const payload = await getTokenPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sheetUrl } = await req.json()
  if (!sheetUrl || typeof sheetUrl !== 'string') {
    return NextResponse.json({ error: 'sheetUrl is required' }, { status: 400 })
  }

  const sheetId = extractSheetId(sheetUrl)
  if (!sheetId) {
    return NextResponse.json({ error: 'Could not parse Google Sheet ID from URL' }, { status: 400 })
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`

  let csvText: string
  try {
    const res = await fetch(csvUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csvText = await res.text()
  } catch (e) {
    return NextResponse.json(
      { error: 'Could not fetch spreadsheet. Make sure it is shared as "Anyone with the link can view".' },
      { status: 400 }
    )
  }

  const rows = parseCSV(csvText)
  if (rows.length < 2) {
    return NextResponse.json({ error: 'Spreadsheet appears empty (need header + data rows)' }, { status: 400 })
  }

  // Find columns: look for "Name"/"Title" and "File ID"/"ID"/"Link" in header row
  const header = rows[0].map((h) => h.toLowerCase())
  let nameCol = header.findIndex((h) => h === 'name' || h === 'title')
  let idCol = header.findIndex((h) => h === 'file id' || h === 'id' || h === 'fileid')
  let linkCol = header.findIndex((h) => h === 'link' || h === 'url')

  // Fallback: first two columns
  if (nameCol === -1) nameCol = 0
  if (idCol === -1 && linkCol === -1) idCol = 1

  const videos: { name: string; id: string }[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const name = row[nameCol] ?? ''
    let fileId = ''

    if (idCol !== -1 && row[idCol]) {
      fileId = row[idCol]
    } else if (linkCol !== -1 && row[linkCol]) {
      // Try to extract file ID from a Drive link
      const match = row[linkCol].match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (match) fileId = match[1]
      else {
        const idMatch = row[linkCol].match(/[?&]id=([a-zA-Z0-9_-]+)/)
        if (idMatch) fileId = idMatch[1]
      }
    }

    if (name && fileId) {
      videos.push({ name, id: fileId })
    }
  }

  return NextResponse.json({ videos })
}
