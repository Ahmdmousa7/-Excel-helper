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
  
  // Find all <script> tags
  const scripts = text.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
  if (scripts) {
    scripts.forEach((s, i) => {
      if (s.includes('items') || s.includes('products') || s.includes('menu')) {
        console.log(`Script ${i} contains items/products/menu`);
        console.log(s.substring(0, 300));
      }
    });
  }
}
run();
