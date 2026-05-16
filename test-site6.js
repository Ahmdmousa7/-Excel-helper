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
  
  // Look for API endpoints or JSON state
  const scriptMatches = text.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (scriptMatches) {
    scriptMatches.forEach((m, i) => {
      if (m.includes('window.') || m.includes('var ') || m.includes('const ')) {
        console.log(`Script ${i}:`, m.substring(0, 300));
      }
    });
  }
  
  // Look for any JSON data attributes
  const jsonMatches = text.match(/data-[a-zA-Z\-]+="({[^"]+})"/g);
  if (jsonMatches) {
    console.log("Found JSON data attributes:", jsonMatches.length);
  }
}
run();
