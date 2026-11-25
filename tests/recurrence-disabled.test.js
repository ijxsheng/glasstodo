import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOccurrence } from '../src/modules/recurrence.js';
import { createTask, normalizeTask, validateFields, statusFields } from '../src/modules/task.js';

test('重复功能下线后，旧每日及每周任务完成、撤销再完成都不生成下一项', () => {
  for (const repeat of ['daily','weekly']) {
    const old = {id:'old',title:'已有任务',repeat,status:'todo',dueDate:'2026-11-25',subtasks:[{id:'child',title:'子任务'}],journal:[{text:'原进展'}]};
    const done = {...old,...statusFields(old,'done')};
    assert.equal(nextOccurrence(done,old),null);
    assert.equal(nextOccurrence({...done,status:'todo'},done),null);
    assert.equal(nextOccurrence(done,{...done,status:'todo'}),null);
    const visible = normalizeTask(old);
    assert.equal(visible.repeat,'none');
    assert.equal(visible.id,old.id);
    assert.deepEqual(visible.subtasks,old.subtasks);
    assert.deepEqual(visible.journal,old.journal);
    assert.equal(old.repeat,repeat);
  }
});

test('新建与编辑不再接受重复规则，不影响任务和提醒', () => {
  const input = {title:'课程复习',category:'学习',priority:'none',timeMode:'deadline',dueDate:'2026-11-25',dueTime:'10:00',reminderMode:'hour'};
  for (const repeat of ['daily','weekly',undefined]) {
    const fields = validateFields({...input,repeat});
    const task = createTask({...input,repeat});
    assert.equal(fields.repeat,'none');
    assert.equal(task.repeat,'none');
    assert.equal(task.seriesId,null);
    assert.equal(task.reminderTime,'09:00');
  }
});
