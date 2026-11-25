import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { reminderFields, reminderMode, reminderSettingsChanged } from '../src/modules/reminder-options.js';
import { validateFields } from '../src/modules/task.js';
import { validateSubtask, changeSubtask } from '../src/modules/subtask.js';
import { reminderStamp, reminderDue } from '../src/modules/notification.js';

const base={title:'复习',category:'学习',priority:'none',timeMode:'deadline',dueDate:'2026-11-25',dueTime:'10:30'};

test('提前一小时一天一周严格从截止时点往前推，跨月跨年正确', () => {
  for(const [mode,date,time] of [['hour','2026-11-25','09:30'],['day','2026-11-24','10:30'],['week','2026-11-18','10:30']]) {
    const fields=validateFields({...base,reminderMode:mode});
    assert.equal(fields.reminderDate,date);
    assert.equal(fields.reminderTime,time);
    assert.equal(fields.reminderMode,mode);
    assert.equal(fields.reminderEnabled,true);
  }
  const fields=reminderFields({...base,dueDate:'2027-01-01',dueTime:'00:30',reminderMode:'hour'});
  assert.equal(fields.reminderDate,'2026-12-31');
  assert.equal(fields.reminderTime,'23:30');
});

test('时间段按开始时点计算，修改结束时点不改变提前提醒', () => {
  const range={...base,timeMode:'range',startDate:'2026-11-25',startTime:'08:00',dueDate:'2026-11-26',dueTime:'18:00',reminderMode:'day'};
  const fields=validateFields(range);
  assert.equal(fields.reminderDate,'2026-11-24');
  assert.equal(fields.reminderTime,'08:00');
  assert.equal(reminderSettingsChanged(fields,validateFields({...range,dueDate:'2026-11-27'})),false);
  assert.equal(reminderSettingsChanged(fields,validateFields({...range,startTime:'09:00'})),true);
});

test('仅自定义允许无安排的任务独立选择提醒，提前选项必须有完整时点', () => {
  for(const overrides of [{timeMode:'none'},{dueDate:''},{dueTime:''},{dueDate:'2026-02-30'}]) {
    assert.throws(()=>reminderFields({...base,...overrides,reminderMode:'hour'}));
  }
  assert.throws(()=>reminderFields({...base,timeMode:'range',startDate:'',startTime:'',reminderMode:'day'}));
  const fields=validateFields({...base,timeMode:'none',reminderMode:'custom',reminderDate:'2026-11-24',reminderTime:'09:00'});
  assert.equal(fields.dueDate,'');
  assert.equal(fields.reminderTime,'09:00');
  assert.throws(()=>validateFields({...base,reminderMode:'custom'}));
  assert.throws(()=>reminderFields({...base,reminderMode:'constructor'}));
});

test('无提醒清空旧自定义时间，旧开启提醒按自定义兼容且不会重置触发状态', () => {
  const previous={reminderEnabled:true,reminderDate:'2026-11-24',reminderTime:'09:00'};
  const fields=reminderFields(previous);
  assert.equal(reminderMode(previous),'custom');
  assert.equal(reminderSettingsChanged(previous,fields),false);
  const disabled=reminderFields({...previous,reminderMode:'none'});
  assert.equal(disabled.reminderEnabled,false);
  assert.equal(disabled.reminderDate,'');
  assert.equal(disabled.reminderTime,'');
  assert.equal(reminderSettingsChanged(previous,disabled),true);
});

test('子任务使用自己的时点，改变开始时间自动重新计算并重新启用提醒', () => {
  const fields={...base,timeMode:'range',startDate:'2026-11-25',startTime:'08:00',dueDate:'2026-11-25',dueTime:'18:00',reminderMode:'hour'};
  const initial=changeSubtask([],'child','add',fields);
  const fired=[{...initial[0],reminderFiredAt:'fired',snoozedUntil:'later'}];
  const next=changeSubtask(fired,'child','edit',{...fields,startTime:'09:00'});
  assert.equal(next[0].reminderTime,'08:00');
  assert.equal(next[0].reminderVersion,2);
  assert.equal(next[0].reminderFiredAt,null);
  assert.equal(next[0].snoozedUntil,null);
  assert.equal(validateSubtask(fields).reminderTime,'07:00');
});


test('相对提醒交给现有调度器，延迟提醒优先，错误数据不阻断其他提醒', () => {
  const task={...validateFields({...base,reminderMode:'hour'}),status:'todo'};
  assert.equal(reminderStamp(task),new Date('2026-11-25T09:30').toISOString());
  assert.equal(Boolean(reminderDue(task,new Date('2026-11-25T09:29'))),false);
  assert.equal(Boolean(reminderDue(task,new Date('2026-11-25T09:30'))),true);
  const snoozed={...task,snoozedUntil:new Date('2026-11-25T09:40').toISOString()};
  assert.equal(reminderStamp(snoozed),snoozed.snoozedUntil);
  assert.equal(reminderStamp({...task,dueDate:''}),null);
});

test('夏令时变化前的提前一天仍按24小时计算', () => {
  const script=`import {reminderFields} from './src/modules/reminder-options.js'; const fields=reminderFields({timeMode:'deadline',dueDate:'2026-03-08',dueTime:'09:00',reminderMode:'day'}); process.stdout.write(JSON.stringify({date:fields.reminderDate,time:fields.reminderTime}));`;
  const output=execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),{date:'2026-03-07',time:'08:00'});
});
