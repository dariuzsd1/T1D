import { defineConfig } from 'vitest/config'

// Pure date/number logic (depletion + refill engines) — no DOM needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
