import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCategoryName } from '../src/modules/category.js';
import { createTask, validateFields } from '../src/modules/task.js';

test('自定义类别去除首尾空格，限制空白、长度和控制字符', () => {
  assert.equal(validateCategoryName('  运动  '), '运动');
  for (const name of ['', '  ', '字'.repeat(21), '类别\n名称']) assert.throws(() => validateCategoryName(name));
  assert.equal(validateCategoryName('🎨'.repeat(20)).length, 40);
});

test('拒绝已有、保留名称，英文大小写和全角形式也不能重复', () => {
  for (const name of ['学习', ' 学习 ', 'travel', 'Ｔｒａｖｅｌ', 'ALL', '全部类别', 'All categories']) {
    assert.throws(() => validateCategoryName(name, ['学习', 'Travel']));
  }
});

test('真实任务可以使用已保存的自定义类别，不能使用不存在的类别', () => {
  const fields = { title: '跑步', note: '', dueDate: '', dueTime: '', category: '运动', priority: 'low' };
  assert.throws(() => validateFields(fields));
  const task = createTask(fields, 'custom-category', undefined, ['学习', '运动']);
  assert.equal(task.category, '运动');
});
