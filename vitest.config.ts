import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Pure date/number logic (depletion + refill engines) — no DOM needed. Route
// handler tests also run here (node environment suits them fine, no DOM either).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Mirrors tsconfig's "@/*" -> "./src/*" — needed so route-handler tests can
    // import files (and the files they import) that use the @/ alias. No prior
    // test needed this, so it was never configured.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
