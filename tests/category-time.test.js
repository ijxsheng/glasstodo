import test from 'node:test';
import assert from 'node:assert/strict';
import { changeCategory } from '../src/modules/category.js';
import { validateFields, isOverdue, taskCounts } from '../src/modules/task.js';
import { validateSubtask } from '../src/modules/subtask.js';
import { reminderDue } from '../src/modules/notification.js';

const records = ['学习','生活','工作','其他'].map(name => ({name,createdAt:''}));
const now = new Date('2026-11-24T12:00:00');

test('类别重命名覆盖所有状态及最近删除，保留子任务和身份，更新版本', () => {
  const tasks=['todo','wip','pending','done','cancel'].map((status,index)=>({id:String(index),category:'学习',status,revision:3,subtasks:[{id:'child'}],deletedAt:index===4?'deleted':null}));
  tasks.push({id:'unrelated',category:'工作',revision:1});
  const plan=changeCategory(records,tasks,'学习','课程',now.toISOString());
  assert.equal(plan.destination,'课程');
  assert.equal(plan.records.some(record=>record.name==='学习'),false);
  assert.equal(plan.records.find(record=>record.name==='课程').userNamed,true);
  assert.equal(plan.tasks[4].category,'课程');
  assert.equal(plan.tasks[0].revision,4);
  assert.deepEqual(plan.tasks[0].subtasks,[{id:'child'}]);
  assert.equal(plan.tasks[0].id,'0');
  assert.equal(plan.tasks[5],tasks[5]);
  assert.equal(tasks[0].category,'学习');
});

test('删除类别迁移到其他，不丢任务，也不产生重复类别', () => {
  const tasks=[{id:'task',category:'学习',revision:1}];
  const plan=changeCategory(records,tasks,'学习',null);
  assert.equal(plan.destination,'其他');
  assert.equal(plan.tasks.length,1);
  assert.equal(plan.tasks[0].category,'其他');
  assert.equal(plan.records.filter(record=>record.name==='其他').length,1);
});

test('所有类别均可删除，包括其他和仅剩一个的类别', () => {
  const plan=changeCategory([{name:'其他',createdAt:''}],[{category:'其他',revision:1}],'其他',null);
  assert.deepEqual(plan.records.map(record=>record.name),['未分类']);
  assert.equal(plan.tasks[0].category,'未分类');
  const again=changeCategory(plan.records,plan.tasks,'未分类',null);
  assert.deepEqual(again.records.map(record=>record.name),['其他']);
  assert.equal(again.tasks[0].category,'其他');
});

test('类别管理拒绝重复空名与失效来源，同名保存不改任务版本', () => {
  for(const value of ['  ','工作','ALL','全部类别']) assert.throws(()=>changeCategory(records,[],'学习',value));
  assert.throws(()=>changeCategory(records,[],'已删除','新名称'));
  const tasks=[{category:'学习',revision:3}];
  assert.equal(changeCategory(records,tasks,'学习',' 学习 ').tasks,tasks);
});

const fields={title:'不设时间任务',category:'学习',priority:'none',timeMode:'none',dueDate:'2026-11-20',dueTime:'10:00',startDate:'2026-11-19',startTime:'09:00',reminderEnabled:true,reminderDate:'2026-11-24',reminderTime:'09:00'};

test('不设时间清除父子任务原日期与时间，仍可独立提醒且不归逾期', () => {
  for(const task of [validateFields(fields),validateSubtask(fields)]) {
    for(const key of ['dueDate','dueTime','startDate','startTime']) assert.equal(task[key],'');
    assert.equal(task.timeMode,'none');
    assert.equal(task.reminderEnabled,true);
    assert.equal(isOverdue(task,now),false);
    assert.equal(Boolean(reminderDue(task,now)),true);
  }
  const task={...validateFields(fields),id:'task',createdAt:now.toISOString()};
  const counts=taskCounts([task],'2026-11-24',now);
  assert.equal(counts.today,0);
  assert.equal(counts.upcoming,1);
  assert.equal(counts.overdue,0);
});

