import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://api.microlink.io?url=https://arhib.menus-sa.com/ar&prerender=true');
  const json = await res.json();
  console.log(Object.keys(json.data));
}
run();
