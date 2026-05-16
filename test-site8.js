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
  
  // Print out all script tags that have src
  const scriptTags = text.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g);
  if (scriptTags) {
    console.log("External scripts:", scriptTags);
  }
  
  // Let's check if there's any JSON in the HTML
  const jsonMatches = text.match(/\{"[\s\S]*?"\}/g);
  if (jsonMatches) {
    console.log("Found JSON-like strings:", jsonMatches.length);
    if (jsonMatches.length > 0) {
      console.log(jsonMatches[0].substring(0, 200));
    }
  }
}
run();
