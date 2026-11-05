import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
const control=await readFile(new URL('../dist/wloc-control.js',import.meta.url),'utf8');
const location=await readFile(new URL('../dist/wloc-location.js',import.meta.url),'utf8');
const {target,fixtures}=JSON.parse(await readFile(new URL('./protocol-fixtures.json',import.meta.url),'utf8'));
function run(script,request,store,response){
 let calls=0,payload;
 const forbidden=()=>{throw Error('Unexpected side effect');};
 vm.runInNewContext(script,{$rocket:{},$argument:'enabled=true&allowMissingOrigin=true',$request:request,...(response?{$response:response}:{}),$persistentStore:{read:key=>store.get(key)??null,write:(value,key)=>{store.set(key,value);return true;}},$done:value=>{calls++;payload=value;},Uint8Array,Uint32Array,ArrayBuffer,DataView,console:{log:forbidden,error:forbidden},fetch:forbidden,$httpClient:{get:forbidden,post:forbidden},$notification:{post:forbidden}},{timeout:1000});
 assert.equal(calls,1);return payload;
}
function write(store,action,payload={}){
 const result=run(control,{url:'https://wloc-settings.invalid/wloc-write/v1/'+action,method:'POST',headers:{'X-WLOC-Protocol':'wloc-local-control/2','X-WLOC-Payload':JSON.stringify(payload)}},store);
 assert.ok(result.response);return JSON.parse(result.response.body);
}
function query(store){return JSON.parse(run(control,{url:'https://wloc-settings.invalid/wloc-read/v1/',method:'GET',headers:{}},store).response.body);}
function rewrite(store,body,headers={}){return run(location,{url:'https://gs-loc.apple.com/clls/wloc',method:'POST'},store,{status:200,headers:{'Content-Type':'application/octet-stream',...headers},body:new Uint8Array(body)});}
test('control bytes are exactly the reviewed v2.4 script',()=>assert.equal(createHash('sha256').update(control).digest('hex'),'4de93aba317f546219e9a28102228da57897684a6494874eed1a2d40f2395af5'));
test('location bytes are exactly the reviewed typed adapter',()=>assert.equal(createHash('sha256').update(location).digest('hex'),'4340a44d89edf961446e835a5b555a1167bb3eab4e94ee5635cb2932ceb0d481'));
test('page identity deliberately remains v2.4, without silently rebuilding its UI',()=>{const result=run(control,{url:'https://wloc-settings.invalid/wloc-control/v2/',method:'GET',headers:{}},new Map());assert.match(result.response.body,/本机控制 · v2.4 保存修正/);});
for(const [name,fixture] of Object.entries(fixtures))for(const compressed of [false,true])test(`combined save -> read -> response: ${name} gzip=${compressed}`,()=>{
 const store=new Map();assert.equal(write(store,'save',target).success,true);assert.deepEqual(query(store).target,target);
 const source=Buffer.from(fixture.input,'base64'),expected=Buffer.from(fixture.expected,'base64'),body=compressed?gzipSync(source):source;
 const before=[...store];const result=rewrite(store,body,compressed?{'Content-Encoding':'gzip'}:{});
 assert.equal(Object.hasOwn(result,'response'),false);assert.deepEqual(Object.keys(result).sort(),['body','headers']);assert.deepEqual(Buffer.from(result.body),expected);assert.deepEqual([...store],before);
});
test('save, clear, restore and location stage share the existing storage without losing the first backup',()=>{
 const original={latitude:3.75,longitude:4.5,accuracy:25,randomRadius:0};const originalText=JSON.stringify(original),store=new Map([['wloc_settings',originalText]]);
 assert.equal(write(store,'save',target).success,true);const backup=store.get('wloc_settings_control_backup_v2');
 assert.equal(write(store,'clear').success,true);assert.equal(query(store).state,'empty');assert.deepEqual(Object.keys(rewrite(store,Buffer.from(fixtures['type1-mixed'].input,'base64'))),[]);
 assert.equal(write(store,'restore').success,true);assert.equal(store.get('wloc_settings'),originalText);assert.equal(store.get('wloc_settings_control_backup_v2'),backup);
});
test('damaged gzip stays untouched after a valid save',()=>{const store=new Map();write(store,'save',target);const source=gzipSync(Buffer.from(fixtures['type1-mixed'].input,'base64'),{level:0});source[13]^=1;assert.deepEqual(Object.keys(rewrite(store,source,{'Content-Encoding':'gzip'})),[]);});
test('re-saving the same target does not mutate storage',()=>{const store=new Map();write(store,'save',target);const before=[...store];assert.equal(write(store,'save',target).unchanged,true);assert.deepEqual([...store],before);});
