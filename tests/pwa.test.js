import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {pwaBuild} from '../scripts/pwa-build.js';

function worker({failInstall=false,varyOrigin=false}={}) {
  const handlers={},deleted=[],saved=[];
  const cache={addAll:async urls=>{if(failInstall) throw Error('offline'); saved.push(...urls);},match:async (url,options)=>varyOrigin&&!options?.ignoreVary?undefined:({cached:String(url)})};
  const context={URL,Promise,fetch:async()=>({network:true}),caches:{open:async()=>cache,keys:async()=>['glasstodo:/demo/:old','other-app','glasstodo:/other/:old'],delete:async name=>deleted.push(name)},self:{location:{href:'https://example.test/demo/sw.js'},clients:{claim:async()=>{}},addEventListener:(name,callback)=>handlers[name]=callback}};
  vm.runInNewContext(readFileSync('src/service-worker.js','utf8').replace('__VERSION__','test').replace('__ASSETS__',JSON.stringify(['index.html','assets/app.js'])),context);
  return {handlers,deleted,saved};
}

test('Vary Origin 不同的模块请求仍命中版本化预缓存，避免离线只有 HTML 的白屏',async()=>{
 const w=worker({varyOrigin:true});let response;
 w.handlers.fetch({request:{url:'https://example.test/demo/assets/app.js',method:'GET',mode:'cors',headers:{Origin:'https://example.test'}},respondWith:value=>response=value});
 assert.ok((await response).cached);
});
test('离线缓存覆盖构建文件，更新版本随资源内容改变，支持子路径',()=>{
  const bundle={'index.html':{type:'asset',source:'<html>test</html>'},'assets/app.js':{type:'chunk',code:'one'}};
  let result;
  const plugin=pwaBuild();
  plugin.generateBundle.call({emitFile:file=>result=file},{},bundle);
  assert.equal(result.fileName,'sw.js');
  assert.ok(result.source.includes('assets/app.js'));
  assert.ok(result.source.includes('icon-512.png'));
  assert.ok(!result.source.includes('__ASSETS__'));
  const first=result.source;
  bundle['assets/app.js'].code='two';
  plugin.generateBundle.call({emitFile:file=>result=file},{},bundle);
  assert.notEqual(first,result.source);
});
test('安装完整缓存成功才完成，断网失败会拒绝安装；不强制刷新旧窗口',async()=>{
  for(const failInstall of [false,true]) {
    const w=worker({failInstall}); let done;
    w.handlers.install({waitUntil:value=>done=value});
    if(failInstall) await assert.rejects(done); else {await done; assert.ok(w.saved.includes('https://example.test/demo/index.html'));}
    assert.equal(w.handlers.message,undefined);
  }
});
test('激活仅清除同路径旧缓存，断网导航和构建脚本走缓存',async()=>{
  const w=worker();let done;
  w.handlers.activate({waitUntil:value=>done=value});await done;
  assert.deepEqual(w.deleted,['glasstodo:/demo/:old']);
  for(const [path,mode] of [['/demo/','navigate'],['/demo/?source=installed','navigate'],['/demo/assets/app.js','cors']]) {
    let response;
    w.handlers.fetch({request:{url:'https://example.test'+path,mode,method:'GET'},respondWith:value=>response=value});
    assert.ok((await response).cached);
  }
  for(const url of ['https://other.test/demo/','https://example.test/other/','https://example.test/demo/api']) {
    w.handlers.fetch({request:{url,mode:'cors',method:'GET'},respondWith:()=>assert.fail('unrelated request cached')});
  }
});
test('安装清单与 PNG 图标尺寸一致，应用使用相对路径',()=>{
  const manifest=JSON.parse(readFileSync('public/manifest.webmanifest'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons) {
    const bytes=readFileSync('public/'+icon.src),size=Number(icon.sizes.split('x')[0]);
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
  }
});
