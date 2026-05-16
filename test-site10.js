import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://api.microlink.io?url=https://arhib.menus-sa.com/ar&prerender=true&meta=false&data.html=document.body.innerHTML');
  const json = await res.json();
  console.log(json.data.html.substring(0, 500));
  console.log("Contains مضغوط?", json.data.html.includes('مضغوط'));
}
run();
