import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, validateFields } from '../src/modules/task.js';
import { reminderDue, snoozeFields, notifyDesktop } from '../src/modules/notification.js';

const input = { title:'管理会计复习', category:'学习', priority:'none', dueDate:'2026-11-23', dueTime:'10:00', reminderEnabled:true, reminderDate:'2026-11-23', reminderTime:'09:00', repeat:'daily' };
const now = new Date('2026-11-23T09:01:00');
const task = createTask(input, 'task', now.toISOString());

test('提醒输入验证，旧任务默认不启用', () => {
  assert.equal(task.reminderEnabled,true);
  assert.equal(task.seriesId,null);
  for (const fields of [{reminderDate:''},{reminderTime:'24:00'},{reminderDate:'2026-02-29'}]) assert.throws(() => validateFields({...input,...fields}));
  assert.equal(validateFields({...input,reminderEnabled:false,reminderDate:'bad'}).reminderDate,'');
});
test('到时与错过提醒只认领活动任务，已触发不重复', () => {
  assert.equal(Boolean(reminderDue(task, new Date('2026-11-23T08:59:59'))),false);
  assert.equal(Boolean(reminderDue(task, now)),true);
  assert.equal(Boolean(reminderDue(task, new Date('2026-11-25T12:00:00'))),true);
  for (const fields of [{status:'done'},{status:'cancel'},{deletedAt:'deleted'},{reminderFiredAt:'fired'},{reminderEnabled:false}]) assert.equal(Boolean(reminderDue({...task,...fields},now)),false);
  for(const status of ['wip','pending']) assert.equal(Boolean(reminderDue({...task,status},now)),true);
});
test('延迟5/10/30分钟递增版本且清除触发标记', () => {
  for (const minutes of [5,10,30]) {
    const delayed = {...task,...snoozeFields(task,minutes,now)};
    assert.equal(new Date(delayed.snoozedUntil)-now,minutes*60000);
    assert.equal(delayed.reminderVersion,2);
    assert.equal(Boolean(reminderDue(delayed,now)),false);
    assert.equal(Boolean(reminderDue(delayed,new Date(delayed.snoozedUntil))),true);
  }
  assert.throws(()=>snoozeFields(task,1,now));
  assert.throws(()=>snoozeFields({...task,status:'done'},5,now));
});
test('系统通知只在已授权时调用，不支持或构造失败时保留站内替代', () => {
  let sent=0;
  class FakeNotification { static permission='granted'; constructor(){ sent++; } }
  assert.equal(notifyDesktop('提醒','任务',null,FakeNotification),true);
  FakeNotification.permission='denied';
  assert.equal(notifyDesktop('提醒','任务',null,FakeNotification),false);
  assert.equal(sent,1);
  class BrokenNotification { static permission='granted'; constructor(){throw Error('unsupported');} }
  assert.equal(notifyDesktop('提醒','任务',null,BrokenNotification),false);
});
