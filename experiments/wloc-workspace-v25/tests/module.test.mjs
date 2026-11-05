import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const module=await readFile(new URL('../wloc-complete.module',import.meta.url),'utf8');
const lines=module.split('\n').filter(line=>line.includes(' = type='));
const rules=lines.map(line=>Object.fromEntries(line.slice(line.indexOf(' = ')+3).split(',').map(part=>{const index=part.indexOf('=');return [part.slice(0,index),part.slice(index+1)];})));
test('module identifies the v2.5 combination and contains five scripts',()=>{assert.match(module,/#!name=WLOC Local Workspace v2.5 - Typed Location/);assert.equal(rules.length,5);assert.match(module,/Control page intentionally shows v2.4/);});
test('both script paths use the same exact reviewed immutable commit',()=>{const paths=[...new Set(rules.map(rule=>rule['script-path']))];assert.equal(paths.length,2);for(const path of paths)assert.match(path,/^https:\/\/raw\.githubusercontent\.com\/JarynXu\/wloc\/2df9e824ded1b82847cda368ac726aaff97a2510\/experiments\/wloc-workspace-v25\/dist\/wloc-(?:control|location)\.js$/);});
test('MITM list is unchanged and contains no extra hosts or wildcard',()=>{const line=module.split('\n').find(line=>line.startsWith('hostname = '));assert.equal(line,'hostname = %APPEND% wloc-settings.invalid, gs-loc.apple.com, gs-loc-cn.apple.com');});
test('local control REJECT stays present',()=>assert.match(module,/^DOMAIN,wloc-settings\.invalid,REJECT$/m));
test('location buffering and binary body are bounded and explicit',()=>{const rule=rules.find(rule=>rule.type==='http-response');assert.equal(rule['requires-body'],'1');assert.equal(rule['binary-body-mode'],'1');assert.equal(rule['max-size'],'2097152');assert.equal(rule.timeout,'30');assert.equal(rule.enable,'true');});
const cases=[
 ['https://wloc-settings.invalid/wloc-write/v1/save','http-request'],
 ['https://wloc-settings.invalid/wloc-write/v1/clear','http-request'],
 ['https://wloc-settings.invalid/wloc-write/v1/restore','http-request'],
 ['https://wloc-settings.invalid/wloc-read/v1/','http-request'],
 ['https://wloc-settings.invalid/wloc-control/v2/','http-request'],
 ['https://wloc-settings.invalid/wloc-control/v2/query','http-request'],
 ['https://gs-loc.apple.com/wloc-settings/save?legacy=true','http-request'],
 ['https://gs-loc-cn.apple.com/clls/wloc','http-response'],
 ['https://gs-loc.apple.com/clls/wloc?synthetic=1','http-response'],
 ['http://gs-loc.apple.com/clls/wloc',null],
 ['https://gs-loc.apple.com/clls/wloc/other',null],
 ['https://gsp-ssl.ls.apple.com/clls/wloc',null],
 ['https://bluedot.is.autonavi.com/clls/wloc',null],
 ['https://gs-loc.apple.com.attacker.invalid/clls/wloc',null],
];
for(const [url,type]of cases)test(`rule selection is unambiguous: ${url}`,()=>{const matches=rules.filter(rule=>new RegExp(rule.pattern).test(url));assert.equal(matches.length,type?1:0);if(type)assert.equal(matches[0].type,type);});
