import {build} from 'esbuild';
await build({entryPoints:['src/near-connector.js'],outfile:'dist/near-connector.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'eof'});
console.log('Built the pinned NEAR wallet connector.');
