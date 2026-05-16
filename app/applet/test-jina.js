import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://r.jina.ai/https://arhib.menus-sa.com/ar', {
    headers: {
      'X-Return-Format': 'html'
    }
  });
  const text = await res.text();
  console.log(text.substring(0, 1000));
}
run();
