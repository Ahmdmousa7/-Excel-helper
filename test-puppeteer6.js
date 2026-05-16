import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('api') || req.url().includes('json') || req.url().includes('menu')) {
      console.log('API Request:', req.url());
    }
  });
  
  page.on('response', async res => {
    if (res.url().includes('api') || res.url().includes('json') || res.url().includes('menu')) {
      console.log('API Response:', res.url(), res.status());
      try {
        const text = await res.text();
        console.log('Response length:', text.length);
      } catch (e) {}
    }
  });
  
  await page.goto('https://arhib.menus-sa.com/ar', { waitUntil: 'networkidle2' });
  
  // click a category
  const categories = await page.$$('.mainCategory');
  if (categories.length > 0) {
    await categories[0].click();
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await browser.close();
}
run();
