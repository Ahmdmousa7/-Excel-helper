const fetch = require('node-fetch');

async function run() {
  const res = await fetch('https://r.jina.ai/https://arhib.menus-sa.com/ar', {
    headers: {
      'X-Return-Format': 'html'
    }
  });
  const text = await res.text();
  console.log(text.substring(0, 500));
}
run();
