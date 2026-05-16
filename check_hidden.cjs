const fs = require('fs');
let dirs = fs.readdirSync('.', { withFileTypes: true });
console.log(dirs.filter(d => d.name.startsWith('.')).map(d => d.name));
