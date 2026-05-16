import fetch from 'node-fetch';

async function run() {
  const urls = [
    'https://arhib.menus-sa.com/api/menu',
    'https://arhib.menus-sa.com/api/items',
    'https://arhib.menus-sa.com/api/products',
    'https://arhib.menus-sa.com/ar/api/menu',
    'https://arhib.menus-sa.com/menu.json',
    'https://meuns-orders.com/api/menu?domain=arhib'
  ];
  
  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log(url, res.status);
    } catch (e) {
      console.log(url, "Error");
    }
  }
}
run();
