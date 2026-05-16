import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://arhib.menus-sa.com/ar', { waitUntil: 'networkidle2' });
  
  const allText = await page.evaluate(() => document.body.textContent);
  console.log("Prices found:", allText.match(/SAR|ر\.س/g)?.length);
  
  const html = await page.content();
  console.log("HTML length:", html.length);
  
  // Let's dump the first 5000 characters of the HTML to see what's going on
  // or maybe search for "SAR" in the HTML
  const sarIndex = html.indexOf('SAR');
  if (sarIndex !== -1) {
    console.log("Found SAR at", sarIndex);
    console.log(html.substring(sarIndex - 100, sarIndex + 100));
  } else {
    console.log("SAR not found in HTML");
  }
  
  await browser.close();
}
run();
