import { exportLatex, exportMarkdown } from '../src/app';
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

const document: ProofDocument = {
  id: 'd',
  title: '导出测试',
  author: 'a',
  goal: '\\sqrt{2} 是无理数',
  symbols: { p: '整数' },
  versions: [],
  updatedAt: '',
  steps: [
    step('p1', { type: 'premise', rule: '前提', statement: '$p$ 是整数' }),
    step('a1', { subproofRole: 'assume', subproofId: 's1', assumptionMethod: '反证法', rule: '反证法', statement: '假设 $\\sqrt{2}$ 是有理数' }),
    step('m1', { references: ['p1', 'a1'], statement: '推出矛盾中间式' }),
    step('n1', { subproofRole: 'assume', subproofId: 's2', assumptionMethod: '数学归纳', rule: '数学归纳', statement: '嵌套假设 $P(k)$' }),
    step('n2', { references: ['n1'], statement: '嵌套内层推导' }),
    step('n3', { subproofRole: 'close', subproofId: 's2', assumptionMethod: '数学归纳', rule: '数学归纳', references: ['n2'], statement: '嵌套收尾' }),
    step('cl1', { subproofRole: 'close', subproofId: 's1', assumptionMethod: '反证法', rule: '反证法', references: ['m1', 'n3'], statement: '矛盾，假设不成立' }),
    step('g1', { type: 'goal', rule: '结论', references: ['cl1'], statement: '$\\sqrt{2}$ 是无理数' }),
  ],
};

console.log(exportMarkdown(document));
console.log('\n================ LaTeX ================\n');
console.log(exportLatex(document));
