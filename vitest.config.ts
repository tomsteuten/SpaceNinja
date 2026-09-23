import { defineConfig } from 'vitest/config';

// Nested historical worktrees are preserved inside this checkout. Only the canonical
// source and service-worker trees belong to this run.
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'sw/**/*.test.ts'] } });
