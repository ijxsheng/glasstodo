import test from 'node:test';
import assert from 'node:assert/strict';
import { subtaskProgress } from '../src/modules/subtask.js';
import { notificationMessages, sendReminderNotifications, planTaskReminders, notifyDesktop } from '../src/modules/notification.js';

test('子任务进度使用未删除设置总数，兼容旧完成标记并排除已删除项', () => {
  const progress=subtaskProgress({subtasks:[{status:'done'},{status:'wip'},{status:'cancel'},{completed:true},{status:'done',deletedAt:'removed'}]});
  assert.deepEqual(progress,{completed:2,total:4,percent:50});
  assert.deepEqual(subtaskProgress({}),{completed:0,total:0,percent:0});
  assert.equal(subtaskProgress({subtasks:[{status:'done'}]}).percent,100);
});

const now=new Date('2026-11-25T12:00:00');
const stamp=now.toISOString();
const fields={status:'todo',reminderEnabled:true,reminderDate:'2026-11-25',reminderTime:'12:00',reminderVersion:1};

test('点击通知只回传该通知对应的提醒，显示或关闭通知不自动标记已读', () => {
  const sent=[], viewed=[];
  class FakeNotification {
    static permission='granted';
    constructor(){sent.push(this);}
    close(){}
  }
  const events=[{id:'parent@1',title:'父任务',scheduledAt:stamp},
    {id:'parent/sub/child@1',title:'子任务',scheduledAt:stamp},
    {id:'old-a@1',title:'错过A',scheduledAt:new Date(now-600000).toISOString()},
    {id:'old-b@1',title:'错过B',scheduledAt:new Date(now-600000).toISOString()}];
  sendReminderNotifications(events,items=>viewed.push(items.map(item=>item.id)),FakeNotification,now);
  assert.equal(sent.length,3);
  assert.deepEqual(viewed,[]);
  sent[0].close();
  assert.deepEqual(viewed,[]);
  sent[1].onclick();
  assert.deepEqual(viewed,[['parent/sub/child@1']]);
  sent[2].onclick();
  assert.deepEqual(viewed[1],['old-a@1','old-b@1']);
});

test('同一分钟的父任务、子任务和另一项任务分别请求通知，标记互不覆盖', () => {
  const tasks=[{...fields,id:'parent',title:'父任务',subtasks:[{...fields,id:'child',title:'子任务'}]},{...fields,id:'other',title:'另一项任务'}];
  const plan=planTaskReminders(tasks,now);
  const sent=[];
  class FakeNotification {static permission='granted';constructor(title,options){sent.push({title,...options});}}
  assert.deepEqual(sendReminderNotifications(plan.events,undefined,FakeNotification,now),{requested:3,total:3});
  assert.equal(new Set(sent.map(item=>item.tag)).size,3);
  assert.deepEqual(sent.map(item=>item.body),['父任务','父任务 · 子任务','另一项任务']);
  assert.equal(planTaskReminders(plan.changed,now).events.length,0);
});

test('相邻检查相隔一分钟也不需要额外间隔，通知保持不同身份', () => {
  const sent=[];
  class FakeNotification {static permission='granted';constructor(title,options){sent.push(options);}}
  for(let minute=0;minute<2;minute++) {
    const time=new Date(now.getTime()+minute*60000);
    sendReminderNotifications([{id:`task-${minute}@1`,title:`任务${minute}`,scheduledAt:time.toISOString(),firedAt:time.toISOString()}],undefined,FakeNotification,time);
  }
  assert.equal(sent.length,2);
  assert.notEqual(sent[0].tag,sent[1].tag);
  notifyDesktop('测试','第一次',undefined,FakeNotification);
  notifyDesktop('测试','第二次',undefined,FakeNotification);
  assert.equal(sent[2].tag,undefined);
  assert.equal(sent[3].tag,undefined);
});

test('错过两分钟以上的提醒合并为一条，刚到时的提醒仍分别保留', () => {
  const events=Array.from({length:6},(_,index)=>({id:String(index),title:`任务${index}`,scheduledAt:new Date(now.getTime()-(index<2?0:600000)).toISOString(),firedAt:stamp}));
  const messages=notificationMessages(events,now);
  assert.equal(messages.length,3);
  assert.equal(messages[0].body,'任务0');
  assert.match(messages[2].body,/4\s+missed reminders/);
  assert.equal(new Set(messages.map(item=>item.tag)).size,3);
});

test('系统通知被拒绝或构造失败时报告未能请求，不抛异常或影响已保存的站内记录', () => {
  const events=[{id:'event',title:'任务',scheduledAt:stamp,firedAt:stamp}];
  class Denied {static permission='denied';constructor(){throw Error('不应调用');}}
  class Broken {static permission='granted';constructor(){throw Error('平台不支持');}}
  for(const API of [Denied,Broken]) assert.deepEqual(sendReminderNotifications(events,undefined,API,now),{requested:0,total:1});
});
