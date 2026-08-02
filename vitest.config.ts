import { defineConfig } from 'vitest/config';

// Samostatná konfigurace bez PWA pluginu — testy nutričního modulu jsou čistá
// logika a běží v prostředí node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
