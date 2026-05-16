import fetch from 'node-fetch';

async function run() {
  const res1 = await fetch('https://arhib.menus-sa.com/ar', { redirect: 'manual' });
  const cookies = res1.headers.raw()['set-cookie'].map(c => c.split(';')[0]).join('; ');
  console.log("Cookies:", cookies);
  
  const res2 = await fetch('https://arhib.menus-sa.com/ar', {
    headers: {
      'Cookie': cookies
    }
  });
  const text = await res2.text();
  console.log("Length of actual page:", text.length);
  
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
