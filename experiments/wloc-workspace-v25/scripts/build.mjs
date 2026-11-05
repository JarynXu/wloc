import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const license = await readFile(new URL('../node_modules/pako/LICENSE', import.meta.url), 'utf8');
await build({entryPoints:['src/entry.mjs'],bundle:true,format:'iife',platform:'browser',target:['es2020'],outfile:'dist/wloc-location.js',minify:false,legalComments:'inline',banner:{js:'/* WLOC typed response candidate. No claim of iOS location adoption.\nIncludes pako 2.1.0:\n'+license.replaceAll('*/','* /')+'\n*/'}});
