import test from 'node:test';
import assert from 'node:assert/strict';
import { changeSubtask, validateSubtask, createInitialSubtasks } from '../src/modules/subtask.js';
import { createTask, normalizeTask, taskCounts } from '../src/modules/task.js';
import { planTaskReminders, reminderSubject, snoozeFields } from '../src/modules/notification.js';

const input = { title: '管理会计第一章', status: 'todo', dueDate: '2026-11-24', dueTime: '18:00', reminderEnabled: true, reminderDate: '2026-11-24', reminderTime: '09:00' };
const now = new Date('2026-11-24T10:00:00');
const children = () => changeSubtask([], 'child', 'add', input, { now: now.toISOString() });
const parent = () => ({ ...createTask({ title: '课程复习', category: '学习', priority: 'none', dueDate: '2026-11-24' }, 'parent'), subtasks: children() });

test('子任务支持独立截止日期、全天及跨天时间段，复用时间与提醒校验', () => {
  assert.equal(validateSubtask(input).reminderTime, '09:00');
  assert.equal(validateSubtask({ title: '无时间任务' }).dueDate, '');
  assert.equal(validateSubtask({ ...input, dueTime: '' }).dueTime, '');
  const range = { ...input, timeMode:'range', startDate:'2026-11-23', startTime:'20:00' };
  assert.equal(validateSubtask(range).startDate, '2026-11-23');
  for (const fields of [{title:'  '},{dueDate:'2026-02-29'},{dueTime:'24:00'},{reminderDate:''},{reminderTime:'bad'},{status:'bad'}]) assert.throws(() => validateSubtask({...input,...fields}));
  assert.throws(() => validateSubtask({...range,startDate:'2026-11-25'}));
});

test('子任务编辑、状态、软删除与恢复保留身份并拒绝过期表单', () => {
  const initial = children();
  const edited = changeSubtask(initial,'child','edit',{...input,title:'复习第一章'}, {expectedRevision:1});
  assert.equal(edited[0].title,'复习第一章');
  assert.equal(initial[0].title,input.title);
  assert.equal(edited[0].id,initial[0].id);
  assert.equal(edited[0].createdAt,initial[0].createdAt);
  assert.throws(() => changeSubtask(edited,'child','edit',input,{expectedRevision:1}));
  const done=changeSubtask(edited,'child','status',{status:'done'});
  assert.equal(done[0].completed,true);
  const deleted=changeSubtask(done,'child','delete');
  assert.ok(deleted[0].deletedAt);
  assert.throws(() => changeSubtask(deleted,'child','edit',input));
  const restored=changeSubtask(deleted,'child','restore');
  assert.equal(restored[0].deletedAt,null);
  assert.equal(restored[0].status,'done');
  assert.equal(restored[0].reminderDate,input.reminderDate);
});

test('只改子任务名称保留提醒触发与延迟，改提醒时间生成新版本', () => {
  const initial = [{...children()[0],reminderFiredAt:'fired',snoozedUntil:'later'}];
  const edited=changeSubtask(initial,'child','edit',{...input,title:'另一个标题'});
  assert.equal(edited[0].reminderFiredAt,'fired');
  assert.equal(edited[0].snoozedUntil,'later');
  const rescheduled=changeSubtask(edited,'child','edit',{...input,reminderTime:'11:00'});
  assert.equal(rescheduled[0].reminderVersion,2);
  assert.equal(rescheduled[0].reminderFiredAt,null);
  assert.equal(rescheduled[0].snoozedUntil,null);
});

test('父任务未开启提醒时子任务仍独立触发，标记后不重复且不更改父提醒', () => {
  const source=parent();
  const plan=planTaskReminders([source],now);
  assert.equal(plan.events.length,1);
  assert.equal(plan.events[0].taskId,'parent');
  assert.equal(plan.events[0].subtaskId,'child');
  assert.equal(plan.events[0].title,'课程复习 · 管理会计第一章');
  assert.equal(source.subtasks[0].reminderFiredAt,null);
  assert.equal(plan.changed[0].reminderFiredAt,null);
  assert.ok(plan.changed[0].subtasks[0].reminderFiredAt);
  assert.equal(planTaskReminders(plan.changed,now).events.length,0);
  assert.equal(reminderSubject(plan.changed,plan.events[0]).id,'child');
});

test('父子同时到时分别记录，子任务延迟和旧版本过滤不影响父提醒', () => {
  const source={...parent(),...input,reminderMode:'custom',id:'parent',title:'父任务'};
  const plan=planTaskReminders([source],now);
  assert.equal(plan.events.length,2);
  assert.notEqual(plan.events[0].id,plan.events[1].id);
  const fired=plan.changed[0], child=fired.subtasks[0];
  const delayed={...fired,subtasks:[{...child,...snoozeFields(child,10,now)}]};
  assert.equal(reminderSubject([delayed],plan.events[1]),null);
  assert.equal(planTaskReminders([delayed],now).events.length,0);
  const again=planTaskReminders([delayed],new Date(now.getTime()+600000));
  assert.equal(again.events.length,1);
  assert.equal(again.events[0].subtaskId,'child');
  assert.equal(delayed.reminderFiredAt,fired.reminderFiredAt);
});

test('父任务结束或删除时暂停子提醒，子任务结束或删除只影响自己', () => {
  const source=parent();
  const event=planTaskReminders([source],now).events[0];
  for(const fields of [{status:'done'},{status:'cancel'},{deletedAt:'deleted'}]) {
    const stopped={...source,...fields};
    assert.equal(planTaskReminders([stopped],now).events.length,0);
    assert.equal(reminderSubject([stopped],event),null);
  }
  for(const fields of [{status:'done'},{status:'cancel'},{deletedAt:'deleted'},{reminderEnabled:false}]) {
    const stopped={...source,subtasks:[{...source.subtasks[0],...fields}]};
    assert.equal(planTaskReminders([stopped],now).events.length,0);
    assert.equal(reminderSubject([stopped],event),null);
  }
  assert.equal(planTaskReminders([source],now).events.length,1);
});

test('旧任务兼容且子任务不重复计入顶部数量', () => {
  assert.deepEqual(normalizeTask({}).subtasks,[]);
  assert.equal(taskCounts([parent()],'2026-11-24',now).today,1);
  assert.deepEqual(createTask({title:'旧任务',category:'学习',priority:'none'},'old').subtasks,[]);
});



test('新增任务的子任务整组初始化，重新验证字段并重置存储标记', () => {
  const drafts = [{...input,id:'draft',reminderFiredAt:'stale',reminderVersion:8,revision:9}, {...input,title:'已移除',deletedAt:'removed'}];
  const saved=createInitialSubtasks(drafts,now.toISOString(),()=> 'saved-child');
  assert.equal(saved.length,1);
  assert.equal(saved[0].id,'saved-child');
  assert.equal(saved[0].reminderVersion,1);
  assert.equal(saved[0].reminderFiredAt,null);
  assert.equal(saved[0].createdAt,now.toISOString());
  assert.equal(saved[0].dueDate,input.dueDate);
  assert.equal(drafts[0].revision,9);
  assert.deepEqual(createInitialSubtasks(),[]);
});

test('任一待保存子任务无效时整组拒绝，并校验跨天与已完成子任务', () => {
  assert.throws(()=>createInitialSubtasks([input,{...input,title:'   '}]));
  assert.throws(()=>createInitialSubtasks('invalid'));
  let index=0;
  const saved=createInitialSubtasks([{...input,status:'done'}, {...input,timeMode:'range',startDate:'2026-11-23',startTime:'20:00'}],now.toISOString(),()=>String(++index));
  assert.equal(saved[0].completedAt,now.toISOString());
  assert.equal(saved[1].startDate,'2026-11-23');
  assert.notEqual(saved[0].id,saved[1].id);
});
