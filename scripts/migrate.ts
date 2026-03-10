/**
 * Seed captain password generator
 *
 * Usage:
 *   CAPTAIN_PASSWORD=yourpassword npx tsx scripts/migrate.ts
 *
 * After running scripts/migrate.sql in the Supabase SQL editor, run this script
 * to generate the INSERT statement for the seed captain account. Copy the output
 * and run it in the Supabase SQL editor.
 *
 * Environment variables:
 *   CAPTAIN_PASSWORD       (required) — the captain's initial password
 *   CAPTAIN_USERNAME       (optional, default: 'captain')
 *   CAPTAIN_DISPLAY_NAME   (optional, default: 'Captain')
 */

import bcrypt from 'bcryptjs'

async function main() {
  const username = process.env.CAPTAIN_USERNAME || 'captain'
  const displayName = process.env.CAPTAIN_DISPLAY_NAME || 'Captain'
  const password = process.env.CAPTAIN_PASSWORD

  if (!password) {
    console.error('Error: Set CAPTAIN_PASSWORD env var before running this script.')
    console.error('  Example: CAPTAIN_PASSWORD=yourpassword npx tsx scripts/migrate.ts')
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 12)

  console.log('-- Run this in the Supabase SQL editor after migrate.sql:')
  console.log(`INSERT INTO users (username, display_name, password_hash, role, is_active, is_seed)`)
  console.log(`VALUES ('${username}', '${displayName}', '${hash}', 'captain', true, true)`)
  console.log(`ON CONFLICT (username) DO NOTHING;`)
}

main()
