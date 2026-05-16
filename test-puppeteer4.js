import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('https://arhib.menus-sa.com/ar', { waitUntil: 'networkidle2' });
  
  const categories = await page.$$('.mainCategory');
  if (categories.length > 0) {
    await categories[0].click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Wait, maybe the items are hidden by CSS?
  const items = await page.$$('.item-card, .product, .item');
  console.log("Found items:", items.length);
  
  // What if I just extract all text including hidden text?
  const allText = await page.evaluate(() => document.body.textContent);
  console.log("All text length:", allText.length);
  console.log("All text:", allText.substring(0, 1000).replace(/\s+/g, ' '));
  
  await browser.close();
}
run();
