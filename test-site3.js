import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://arhib.menus-sa.com/ar', { redirect: 'manual' });
  console.log("Status:", res.status);
  console.log("Headers:", res.headers.raw());
  const text = await res.text();
  console.log("Body:", text.substring(0, 200));
}
run();
