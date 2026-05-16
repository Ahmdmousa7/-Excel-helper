import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://arhib.menus-sa.com/ar');
  const text = await res.text();
  console.log("Length:", text.length);
  
  // Look for common state objects
  const match = text.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (match) {
    match.forEach((m, i) => {
      if (m.includes('window.') || m.includes('__')) {
        console.log(`Script ${i}:`, m.substring(0, 200));
      }
    });
  }
}
run();
