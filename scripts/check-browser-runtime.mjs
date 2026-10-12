// Only a narrowly identified launch/environment failure is BLOCKED. A running
// browser's test failure must remain FAIL, regardless of its error text.
import { chromium, webkit } from '@playwright/test';
const name = process.argv[2];
if (!['chromium', 'webkit'].includes(name)) throw new Error('UNKNOWN_BROWSER');
try {
  const browser = await ({ chromium, webkit })[name].launch();
  await browser.close();
  console.log('BROWSER_RUNTIME_AVAILABLE');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const blocked = /Executable doesn't exist|Host system is missing dependencies|error while loading shared libraries|spawn .* (?:EACCES|EPERM)/.test(message);
  console.error((blocked ? 'NOT TESTED LOCALLY — ENVIRONMENT BLOCKED\n' : 'BROWSER_LAUNCH_FAILED\n') + message);
  process.exitCode = blocked ? 2 : 1;
}
