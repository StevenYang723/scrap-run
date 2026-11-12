import fs from 'node:fs';
import path from 'node:path';
let html=fs.readFileSync('index.html','utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync('style.css','utf8')+'</style>');
for(const file of ['engine.js','game.js'])html=html.replace('<script src="'+file+'"></script>',()=>'<script>'+fs.readFileSync(file,'utf8')+'</script>');
const output=path.resolve('standalone/scrap-run.html');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
console.log(output);
