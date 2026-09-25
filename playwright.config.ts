import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: '**/*.pw.ts', workers: 1,
  reporter: [['list'], ['html', {open:'never'}]],
  timeout: 240000, expect: { timeout: 45000 },
  use: { baseURL: 'http://127.0.0.1:4180', actionTimeout:15000, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    // SPACE_NINJA_CHROMIUM points at a pre-installed Chromium where Playwright's own
    // download is unavailable (a managed container); unset, Playwright uses its bundled one,
    // as the deploy workflow does. The capture scripts honour the same variable.
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      ...(process.env.SPACE_NINJA_CHROMIUM ? { executablePath: process.env.SPACE_NINJA_CHROMIUM } : {}) } },
  projects: [
    { name: 'phone', use: { viewport: {width:390,height:844}, reducedMotion:'reduce', hasTouch:true, deviceScaleFactor:0.5 } },
    { name: 'tablet', use: { viewport: {width:1024,height:768}, reducedMotion:'no-preference', hasTouch:true, deviceScaleFactor:0.5 } },
    { name: 'short-landscape', use: { viewport: {width:844,height:390}, reducedMotion:'reduce', hasTouch:true, deviceScaleFactor:0.5 } },
  ],
  webServer: { command: 'npm run build:playtest && npm run preview:playtest',
    url:'http://127.0.0.1:4180', timeout:120000, reuseExistingServer:false,
    env: { VITE_PLAYTEST:'1' } },
});
