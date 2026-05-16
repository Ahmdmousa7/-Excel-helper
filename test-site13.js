import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://arhib.menus-sa.com/build/assets/app.21f00078.js');
  const text = await res.text();
  
  const urls = text.match(/https?:\/\/[^\s"'<>]+/g);
  if (urls) {
    console.log("URLs in JS:", [...new Set(urls)]);
  }
  
  const endpoints = text.match(/\/api\/[^\s"'<>]+/g);
  if (endpoints) {
    console.log("API Endpoints:", [...new Set(endpoints)]);
  }
}
run();
