import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lint the checked-in SQL. These files are pasted straight into the Supabase SQL
 * editor by hand, so a syntax error costs a round trip with the user rather than
 * failing in CI. One shipped with an unescaped apostrophe ("MiniMed's ...") inside
 * a quoted string, which Postgres rejects; this catches that class of mistake.
 */
const SQL_DIR = join(process.cwd(), 'supabase')
const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql'))

/** Strip whole-line comments; they may legitimately contain a lone apostrophe. */
function codeLines(sql: string): { line: number; text: string }[] {
  return sql
    .split(/\r?\n/)
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => !text.trimStart().startsWith('--'))
}

describe('checked-in SQL', () => {
  it('has files to check', () => {
    expect(sqlFiles.length).toBeGreaterThan(0)
  })

  for (const file of sqlFiles) {
    it(`${file}: every string literal is closed (apostrophes escaped as '')`, () => {
      const offenders = codeLines(readFileSync(join(SQL_DIR, file), 'utf8'))
        // An odd number of quotes on a line means one is unclosed: a literal
        // apostrophe that should have been doubled.
        .filter(({ text }) => (text.match(/'/g)?.length ?? 0) % 2 === 1)
        .map(({ line, text }) => `${file}:${line}  ${text.trim().slice(0, 90)}`)
      expect(offenders).toEqual([])
    })
  }
})
