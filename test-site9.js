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
  
  // Strip out scripts and styles
  const cleanText = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/g, '')
                        .replace(/<style[^>]*>([\s\S]*?)<\/style>/g, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                        
  console.log("Clean text length:", cleanText.length);
  console.log("Clean text:", cleanText.substring(0, 1000));
}
run();
