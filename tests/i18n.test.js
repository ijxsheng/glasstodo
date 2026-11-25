import test from 'node:test';
import assert from 'node:assert/strict';
import { readLanguage, saveLanguage, translate, translations, ui, taskCount } from '../src/modules/i18n.js';
import { statuses } from '../src/modules/task.js';

test('语言默认英文，恢复有效偏好，无法读取时也可打开英文界面', () => {
  assert.equal(readLanguage({getItem:()=>null}),'en');
  assert.equal(readLanguage({getItem:()=> 'zh'}),'zh');
  assert.equal(readLanguage({getItem:()=> 'en'}),'en');
  assert.equal(readLanguage({getItem:()=> 'unknown'}),'en');
  assert.equal(readLanguage({getItem:()=>{throw Error('blocked');}}),'en');
});
test('语言设置只写自己的偏好键，拒绝不支持的语言', () => {
  const writes=[];
  saveLanguage('zh',{setItem:(...args)=>writes.push(args)});
  assert.deepEqual(writes,[['glasstodo.ui.language','zh']]);
  assert.throws(()=>saveLanguage('other',{setItem:()=>{}}));
});
test('界面文案覆盖英文，中文模式保留原文', () => {
  for(const [key,value] of Object.entries(translations)) {
    assert.equal(translate(key,'zh'),key);
    assert.equal(/[\u3400-\u9fff]/.test(value),false, key);
  }
  assert.equal(translate('开始日期','en'),'Start date');
  assert.equal(translate('选择日期','en'),'Choose date');
  assert.equal(translate('结束时间必须晚于开始时间。','en'),'The end must be after the start.');
});
test('模板只翻译固定文案，不改任务名称、备注、标签或附件名称', () => {
  const userText='新增任务 · 学习 · 工作 · 任务备注.docx';
  const rendered=ui`任务详情：${userText}`;
  assert.match(rendered,/Task details/);
  assert.ok(rendered.includes(userText));
});
test('任务状态专有名词在两种语言中保持一致', () => {
  assert.deepEqual(Object.values(statuses),['To do','WIP','Pending','Done','Cancel']);
  for(const label of Object.values(statuses)) {
    assert.equal(translate(label,'en'),label);
    assert.equal(translate(label,'zh'),label);
  }
});

test('英文数量使用正确的单复数，中文数量不受影响', () => {
  assert.equal(taskCount(1,'en'),'1 task');
  assert.equal(taskCount(0,'en'),'0 tasks');
  assert.equal(taskCount(2,'en'),'2 tasks');
  assert.equal(taskCount(1,'zh'),'1 项');
});
