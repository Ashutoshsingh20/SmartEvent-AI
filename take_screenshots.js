const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  console.log('Capturing home page...');
  await page.goto('https://event-7b1bf.web.app/');
  await page.waitForTimeout(5000); // Wait for Firebase data to load
  await page.screenshot({ path: '/Users/shu/Desktop/event_management/screenshots/fresh_home.png' });

  console.log('Capturing events page...');
  await page.goto('https://event-7b1bf.web.app/events.html');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/Users/shu/Desktop/event_management/screenshots/fresh_events.png' });

  console.log('Capturing login page...');
  await page.goto('https://event-7b1bf.web.app/login.html');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/shu/Desktop/event_management/screenshots/fresh_login.png' });

  await browser.close();
  console.log('Done capturing fresh screenshots!');
})();
