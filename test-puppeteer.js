import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://arhib.menus-sa.com/ar', { waitUntil: 'networkidle2' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Text length:", text.length);
  console.log("Text:", text.substring(0, 500));
  await browser.close();
}
run();
