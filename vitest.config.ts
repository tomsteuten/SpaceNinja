import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Local experimental checkouts must run their tests from their own project root.
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
});
