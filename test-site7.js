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
  
  // Look for any URLs in the HTML
  const urlMatches = text.match(/https?:\/\/[^\s"'<>]+/g);
  if (urlMatches) {
    const uniqueUrls = [...new Set(urlMatches)].filter(u => u.includes('api') || u.includes('json') || u.includes('items') || u.includes('category'));
    console.log("Interesting URLs:", uniqueUrls);
  }
  
  // Look for AJAX calls
  const ajaxMatches = text.match(/\$\.ajax\({[\s\S]*?}\)/g);
  if (ajaxMatches) {
    console.log("AJAX calls:", ajaxMatches);
  }
}
run();
