import { analyzeSubproofs, validate } from '../src/store';
import type { ProofDocument, ProofStep } from '../src/types';

const step = (id: string, overrides: Partial<ProofStep> = {}): ProofStep => ({
  id,
  type: 'derivation',
  statement: '$x$',
  rule: '等式变形',
  references: [],
  note: '',
  counterexample: '',
  alternative: '',
  ...overrides,
});

const doc = (steps: ProofStep[], goal = '$x$'): ProofDocument => ({
  id: 'd',
  title: 't',
  author: 'a',
  goal,
  symbols: { x: '实数' },
  steps,
  versions: [],
  updatedAt: '',
});

const assume = (id: string, subId: string, method = '反证法'): ProofStep =>
  step(id, { subproofRole: 'assume', subproofId: subId, assumptionMethod: method, rule: method });
const close = (id: string, subId: string, refs: string[], method = '反证法'): ProofStep =>
  step(id, { subproofRole: 'close', subproofId: subId, assumptionMethod: method, rule: method, references: refs });

const titles = (d: ProofDocument) => validate(d).filter((c) => c.severity === 'error').map((c) => c.title);
const warnings = (d: ProofDocument) => validate(d).filter((c) => c.severity === 'warning').map((c) => c.title);

let failures = 0;
const expect = (name: string, condition: boolean, extra: string = '') => {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name} ${extra}`);
  }
};

// 1. 规范的反证法子证明：收尾不直接引假设，结论只引收尾 → 无错误
const good = doc([
  step('p1', { type: 'premise', rule: '前提' }),
  assume('a1', 's1'),
  step('m1', { references: ['p1', 'a1'] }),
  step('m2', { references: ['m1'] }),
  close('cl1', 's1', ['m2']),
  step('g1', { type: 'goal', rule: '结论', references: ['cl1'] }),
]);
expect('规范子证明无错误', titles(good).length === 0, JSON.stringify(titles(good)));

// 2. 原 bug：结论在子证明外直接引用假设 → 越界错误
const bug1 = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
  close('cl1', 's1', ['m1']),
  step('g1', { type: 'goal', rule: '结论', references: ['a1'] }),
]);
expect('外部引用假设报越界', titles(bug1).includes('引用越出子证明作用域'), JSON.stringify(titles(bug1)));

// 3. 外部引用子证明中间步骤 → 越界错误
const bug2 = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
  close('cl1', 's1', ['m1']),
  step('g1', { type: 'goal', rule: '结论', references: ['m1'] }),
]);
expect('外部引用中间步骤报越界', titles(bug2).includes('引用越出子证明作用域'));

// 4. 收尾仍直接引用假设 → 假设未收回
const bug3 = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
  close('cl1', 's1', ['a1', 'm1']),
  step('g1', { type: 'goal', rule: '结论', references: ['cl1'] }),
]);
expect('收尾引假设报未收回', titles(bug3).includes('假设未收回'), JSON.stringify(titles(bug3)));

// 5. 子证明内部引用假设与中间步骤 → 照常允许
const inner = doc([
  step('p1', { type: 'premise', rule: '前提' }),
  assume('a1', 's1'),
  step('m1', { references: ['p1', 'a1'] }),
  step('m2', { references: ['a1', 'm1'] }),
  close('cl1', 's1', ['m2']),
  step('g1', { type: 'goal', rule: '结论', references: ['cl1'] }),
]);
expect('内部引用允许', titles(inner).length === 0, JSON.stringify(titles(inner)));

// 6. 外部引用收尾步骤 → 允许
const closeVisible = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
  close('cl1', 's1', ['m1']),
  step('out', { references: ['cl1'] }),
  step('g1', { type: 'goal', rule: '结论', references: ['out'] }),
]);
expect('外部引用收尾允许', titles(closeVisible).length === 0, JSON.stringify(titles(closeVisible)));

// 7. 假设没有收尾 → 子证明未收尾
const unclosed = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
]);
expect('未收尾报错', titles(unclosed).includes('子证明未收尾'), JSON.stringify(titles(unclosed)));

// 7b. 未收尾的子证明按位置延伸到底部，其后的步骤仍算在子证明内
const unclosedRef = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
  step('out', { references: ['m1'] }),
]);
const unclosedAnalysis = analyzeSubproofs(unclosedRef);
expect('未收尾子证明延伸到底部', unclosedAnalysis.depth.get('out') === 1);
expect('未收尾时不误报越界', !titles(unclosedRef).includes('引用越出子证明作用域'), JSON.stringify(titles(unclosedRef)));

// 8. 收尾没有对应起点 → 未配对
const loneClose = doc([close('cl1', 'ghost', [])]);
expect('收尾未配对报错', titles(loneClose).includes('子证明收尾未配对'), JSON.stringify(titles(loneClose)));

// 9. 嵌套交叉（先收尾外层）→ 嵌套交叉
const crossed = doc([
  assume('a1', 's1'),
  assume('a2', 's2'),
  step('m2', { references: ['a2'] }),
  close('cl1', 's1', ['a1']),
  step('m2b', { references: ['m2'] }),
  close('cl2', 's2', ['m2b']),
]);
expect('嵌套交叉报错', titles(crossed).includes('子证明嵌套交叉'), JSON.stringify(titles(crossed)));

// 10. 正确嵌套：内层收尾对外层可见，外层可引内层收尾
const nested = doc([
  assume('a1', 's1'),
  step('m1', { references: ['a1'] }),
  assume('a2', 's2'),
  step('m2', { references: ['a2', 'm1'] }),
  close('cl2', 's2', ['m2']),
  close('cl1', 's1', ['m1', 'cl2']),
  step('g1', { type: 'goal', rule: '结论', references: ['cl1'] }),
]);
expect('规范嵌套无错误', titles(nested).length === 0, JSON.stringify(titles(nested)));

// 11. 深度图正确
const an = analyzeSubproofs(nested);
expect('深度：外层假设深度 1', an.depth.get('a1') === 1);
expect('深度：内层步骤深度 2', an.depth.get('m2') === 2);
expect('深度：收尾后回到 0', an.depth.get('g1') === 0);

// 12. 收尾不引用任何内部推导 → 警告（空子证明同理）
const emptySub = doc([
  assume('a1', 's1'),
  close('cl1', 's1', []),
]);
expect('空子证明警告', warnings(emptySub).includes('收尾未引用子证明内部推导'), JSON.stringify(warnings(emptySub)));

// 13. 旧稿子（没有子证明标记）按普通步骤处理，无任何子证明检查
const legacy = doc([
  step('l1', { type: 'premise', rule: '前提' }),
  step('l2', { references: ['l1'] }),
  step('l3', { type: 'goal', rule: '结论', references: ['l2'] }),
]);
const legacyTitles = titles(legacy);
const legacyAnalysis = analyzeSubproofs(legacy);
expect('旧稿无标记即无子证明', legacyAnalysis.subproofs.length === 0 && [...legacyAnalysis.depth.values()].every((v) => v === 0));
expect('旧稿不触发子证明检查', !legacyTitles.some((t) => t.includes('子证明') || t.includes('作用域') || t.includes('假设')), JSON.stringify(legacyTitles));

// 14. 数学归纳法子证明同样工作
const induction = doc([
  step('base', { statement: '$P(1)$ 成立', type: 'premise', rule: '前提' }),
  assume('ih', 's1', '数学归纳'),
  step('step', { statement: '$P(k)\\to P(k+1)$', references: ['ih'] }),
  close('ind', 's1', ['step'], '数学归纳'),
  step('g1', { type: 'goal', rule: '结论', references: ['base', 'ind'] }),
]);
expect('归纳子证明无错误', titles(induction).length === 0, JSON.stringify(titles(induction)));

console.log(failures ? `\n${failures} 个失败` : '\n全部通过');
if (failures) throw new Error(`${failures} 个测试失败`);
