import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://arhib.menus-sa.com/ar', { waitUntil: 'networkidle2' });
  
  const html = await page.content();
  const match = html.match(/<div[^>]*class="[^"]*mainCategory[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  if (match) {
    console.log("Category HTML:", match[0]);
  }
  
  // Try clicking the first category that has an ID or something
  const categories = await page.$$('.mainCategory');
  if (categories.length > 0) {
    console.log("Found", categories.length, "categories");
    await categories[0].click();
    await new Promise(r => setTimeout(r, 2000));
    const text = await page.evaluate(() => document.body.innerText);
    console.log("Text after click:", text.substring(0, 500));
  }
  
  await browser.close();
}
run();
