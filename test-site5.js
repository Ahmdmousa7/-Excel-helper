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
  
  // Let's check if the items are in the HTML
  console.log("Contains 'مضغوط'?", text.includes('مضغوط'));
  console.log("Contains 'دجاج'?", text.includes('دجاج'));
  console.log("Contains 'ريال'?", text.includes('ريال'));
  
  // Print a small chunk of the body
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (bodyMatch) {
    console.log("Body length:", bodyMatch[1].length);
  }
}
run();
