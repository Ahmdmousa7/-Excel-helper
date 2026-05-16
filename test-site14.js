import fetch from 'node-fetch';

async function run() {
  const res1 = await fetch('https://arhib.menus-sa.com/ar', { redirect: 'manual' });
  const cookies = res1.headers.raw()['set-cookie'].map(c => c.split(';')[0]).join('; ');
  
  const res2 = await fetch('https://arhib.menus-sa.com/ar', {
    headers: {
      'Cookie': cookies
    }
  });
  const text = await res2.text();
  
  // Search for SAR or ر.س
  const priceMatches = text.match(/SAR|ر\.س/g);
  if (priceMatches) {
    console.log("Found prices:", priceMatches.length);
  }
  
  // Search for any numbers that look like prices
  const numberMatches = text.match(/>\s*\d+\s*</g);
  if (numberMatches) {
    console.log("Found numbers:", numberMatches.slice(0, 10));
  }
}
run();
