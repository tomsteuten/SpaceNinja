import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYTEST_PORT ?? 4180);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e', testMatch: '**/*.pw.ts', workers: 1,
  reporter: [['list'], ['html', {open:'never'}]],
  timeout: 240000, expect: { timeout: 45000 },
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  projects: [
    { name: 'phone', use: { viewport: {width:390,height:844}, reducedMotion:'reduce', hasTouch:true, deviceScaleFactor:0.5 } },
    { name: 'tablet', use: { viewport: {width:1024,height:768}, reducedMotion:'no-preference', hasTouch:true, deviceScaleFactor:0.5 } },
    { name: 'short-landscape', use: { viewport: {width:844,height:390}, reducedMotion:'reduce', hasTouch:true, deviceScaleFactor:0.5 } },
  ],
  webServer: { command: `npm run build:playtest && npm run preview:playtest -- --port ${port}`,
    url:baseURL, timeout:120000, reuseExistingServer:false,
    env: { VITE_PLAYTEST:'1' } },
});
