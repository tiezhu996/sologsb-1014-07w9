import { redraw } from 'mithril';
import type { ProofCheck, ProofDocument, ProofStep, ProofVersion } from './types';

const STORAGE_KEY = 'sologsb-1014-proof-workspace-v1';
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T>(value: T): T => structuredClone(value);

export const RULES = ['前提', '定义展开', '代入', '等式变形', '分配律', '同类项合并', '数学归纳', '反证法', '构造法', '临时假设', '子证明收尾', '结论'];

/** assumption（子证明开始·临时假设）与 discharge（子证明收尾）共用的配对标识前缀 */
export const SUB_PREFIX = 'sub';

function sampleSteps(): ProofStep[] {
  return [
    { id: 's1', type: 'premise', statement: '$a,b$ 是实数', rule: '前提', references: [], note: '采用实数域中的交换律与分配律。', counterexample: '', alternative: '' },
    { id: 's2', type: 'derivation', statement: '$(a+b)^2=(a+b)(a+b)$', rule: '定义展开', references: ['s1'], note: '把平方写成两个相同因式之积。', counterexample: '', alternative: '' },
    { id: 's3', type: 'derivation', statement: '$(a+b)(a+b)=a^2+ab+ba+b^2$', rule: '分配律', references: ['s2'], note: '', counterexample: '', alternative: '也可先展开后半部分。' },
    { id: 's4', type: 'derivation', statement: '$a^2+ab+ba+b^2=a^2+2ab+b^2$', rule: '同类项合并', references: ['s3'], note: '由实数的交换律，$ab=ba$。', counterexample: '', alternative: '' },
    { id: 's5', type: 'goal', statement: '$(a+b)^2=a^2+2ab+b^2$', rule: '结论', references: ['s4'], note: '目标已由步骤 1 至 4 逐项推出。', counterexample: '', alternative: '' },
  ];
}

function issueSteps(): ProofStep[] {
  return [
    { id: 'i1', type: 'premise', statement: '$n$ 是正整数', rule: '前提', references: [], note: '', counterexample: '', alternative: '' },
    { id: 'i2', type: 'derivation', statement: '$P(1)$ 成立', rule: '前提', references: ['i1'], note: '归纳基例。', counterexample: '', alternative: '' },
    { id: 'i3', type: 'derivation', statement: '若 $P(k)$ 成立，则 $P(k+1)$ 也成立', rule: '数学归纳', references: ['missing-step'], note: '这里故意保留一个失效引用，用于演示检查。', counterexample: '', alternative: '' },
    { id: 'i4', type: 'goal', statement: '$P(n)$ 对所有正整数 $n$ 成立', rule: '结论', references: ['i3'], note: '尚未补齐归纳假设。', counterexample: '', alternative: '' },
  ];
}

function contradictionSteps(): ProofStep[] {
  const sub = 'sub-sqrt2';
  return [
    { id: 'c0', type: 'premise', statement: '$m,n$ 为正整数，若 $\\sqrt{2}$ 是有理数则存在互质的 $m,n$ 使 $\\sqrt{2}=\\dfrac{m}{n}$', rule: '前提', references: [], note: '有理数定义。', counterexample: '', alternative: '' },
    { id: 'c1', type: 'assumption', statement: '$\\sqrt{2}$ 是有理数，即 $\\sqrt{2}=\\dfrac{m}{n}$（$m,n$ 互质）', rule: '临时假设', references: ['c0'], note: '反证法临时假设：假设结论不成立。', counterexample: '', alternative: '', subId: sub },
    { id: 'c2', type: 'derivation', statement: '$2n^2=m^2$，故 $m$ 为偶数', rule: '等式变形', references: ['c1'], note: '', counterexample: '', alternative: '' },
    { id: 'c3', type: 'derivation', statement: '设 $m=2k$，代入得 $n^2=2k^2$，故 $n$ 也为偶数', rule: '代入', references: ['c2'], note: '', counterexample: '', alternative: '' },
    { id: 'c4', type: 'derivation', statement: '$m,n$ 都为偶数，与 $m,n$ 互质矛盾', rule: '等式变形', references: ['c3', 'c1'], note: '', counterexample: '', alternative: '' },
    { id: 'c5', type: 'discharge', statement: '$\\sqrt{2}$ 不是有理数，即 $\\sqrt{2}$ 是无理数', rule: '反证法', references: ['c4'], note: '由矛盾收回临时假设。', counterexample: '', alternative: '', subId: sub },
  ];
}

function initialDocuments(): ProofDocument[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'doc-algebra',
      title: '完全平方公式证明',
      author: '数学组',
      goal: '$(a+b)^2=a^2+2ab+b^2$',
      symbols: { a: '实数', b: '实数', P: '关于正整数的命题', n: '正整数', k: '正整数' },
      steps: sampleSteps(),
      versions: [],
      updatedAt: now,
    },
    {
      id: 'doc-contradiction',
      title: '√2 是无理数（反证法·子证明示例）',
      author: '数学组',
      goal: '$\\sqrt{2}$ 是无理数',
      symbols: { m: '正整数', n: '正整数', k: '正整数' },
      steps: contradictionSteps(),
      versions: [],
      updatedAt: now,
    },
    {
      id: 'doc-induction',
      title: '数学归纳法待核对稿',
      author: '学生工作区',
      goal: '$P(n)$ 对所有正整数 $n$ 成立',
      symbols: { P: '关于正整数的命题', n: '正整数', k: '正整数' },
      steps: issueSteps(),
      versions: [],
      updatedAt: now,
    },
  ];
}

function loadDocuments(): ProofDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialDocuments();
    const parsed = JSON.parse(raw) as ProofDocument[];
    return Array.isArray(parsed) && parsed.length ? parsed : initialDocuments();
  } catch {
    return initialDocuments();
  }
}

export class ProofStore {
  documents = loadDocuments();
  activeId = this.documents[0]?.id ?? '';
  selectedStepId = this.documents[0]?.steps[0]?.id ?? '';
  compareVersionId = '';
  dragStepId = '';
  lastInput: HTMLTextAreaElement | HTMLInputElement | null = null;
  undoStack: ProofDocument[][] = [];
  redoStack: ProofDocument[][] = [];
  toast = '';

  get current(): ProofDocument {
    return this.documents.find((item) => item.id === this.activeId) ?? this.documents[0];
  }

  get selectedStep(): ProofStep | undefined {
    return this.current?.steps.find((step) => step.id === this.selectedStepId);
  }

  get checks(): ProofCheck[] {
    if (!this.current) return [];
    return validate(this.current);
  }

  save(): void {
    this.current.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.documents));
  }

  update(mutator: (document: ProofDocument) => void): void {
    this.undoStack.push(clone(this.documents));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    mutator(this.current);
    this.save();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(clone(this.documents));
    this.documents = previous;
    this.ensureSelection();
    this.save();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(clone(this.documents));
    this.documents = next;
    this.ensureSelection();
    this.save();
  }

  selectDocument(id: string): void {
    this.activeId = id;
    this.compareVersionId = '';
    this.selectedStepId = this.current?.steps[0]?.id ?? '';
  }

  selectStep(id: string): void {
    this.selectedStepId = id;
  }

  ensureSelection(): void {
    if (!this.documents.some((item) => item.id === this.activeId)) this.activeId = this.documents[0]?.id ?? '';
    if (!this.current?.steps.some((step) => step.id === this.selectedStepId)) {
      this.selectedStepId = this.current?.steps[0]?.id ?? '';
    }
  }

  addDocument(): void {
    const id = uid('doc');
    const document: ProofDocument = {
      id,
      title: '未命名证明',
      author: '本地用户',
      goal: '$A=B$',
      symbols: { A: '待定义对象', B: '待定义对象' },
      steps: [{ id: uid('step'), type: 'premise', statement: '在这里输入前提', rule: '前提', references: [], note: '', counterexample: '', alternative: '' }],
      versions: [],
      updatedAt: new Date().toISOString(),
    };
    this.undoStack.push(clone(this.documents));
    this.documents.unshift(document);
    this.activeId = id;
    this.selectedStepId = document.steps[0].id;
    this.save();
  }

  removeDocument(id: string): void {
    if (this.documents.length <= 1) {
      this.notify('至少保留一个证明文档');
      return;
    }
    this.undoStack.push(clone(this.documents));
    this.documents = this.documents.filter((item) => item.id !== id);
    this.ensureSelection();
    this.save();
  }

  addStep(type: ProofStep['type'] = 'derivation'): void {
    const step: ProofStep = {
      id: uid('step'),
      type,
      statement: type === 'goal' ? '$A=B$' : '输入新的推导式',
      rule: type === 'goal' ? '结论' : '等式变形',
      references: this.selectedStepId ? [this.selectedStepId] : [],
      note: '',
      counterexample: '',
      alternative: '',
    };
    this.update((document) => {
      const selectedIndex = document.steps.findIndex((item) => item.id === this.selectedStepId);
      document.steps.splice(type === 'goal' ? document.steps.length : selectedIndex + 1, 0, step);
    });
    this.selectedStepId = step.id;
  }

  addSubproof(): void {
    const subId = uid(SUB_PREFIX);
    const assumption: ProofStep = {
      id: uid('step'),
      type: 'assumption',
      statement: '临时假设（例如：结论不成立 / $P(k)$ 成立）',
      rule: '临时假设',
      references: this.selectedStepId ? [this.selectedStepId] : [],
      note: '',
      counterexample: '',
      alternative: '',
      subId,
    };
    const interior: ProofStep = {
      id: uid('step'),
      type: 'derivation',
      statement: '在该假设下进行推导',
      rule: '等式变形',
      references: [assumption.id],
      note: '',
      counterexample: '',
      alternative: '',
    };
    const discharge: ProofStep = {
      id: uid('step'),
      type: 'discharge',
      statement: '收回假设后的结论（不再依赖假设）',
      rule: '反证法',
      references: [interior.id],
      note: '',
      counterexample: '',
      alternative: '',
      subId,
    };
    this.update((document) => {
      const selectedIndex = document.steps.findIndex((item) => item.id === this.selectedStepId);
      document.steps.splice(selectedIndex + 1, 0, assumption, interior, discharge);
    });
    this.selectedStepId = assumption.id;
  }

  /** 切换步骤类型时维护子证明配对标记，保证新类型立即可被检查。 */
  setStepType(id: string, type: ProofStep['type']): void {
    this.update((document) => {
      const step = document.steps.find((item) => item.id === id);
      if (!step) return;
      step.type = type;
      if (type === 'assumption') {
        if (!step.subId) step.subId = uid(SUB_PREFIX);
        if (!step.rule || step.rule === '结论') step.rule = '临时假设';
      } else if (type === 'discharge') {
        const index = document.steps.findIndex((item) => item.id === id);
        const scope = analyzeScopes(document.steps)[index];
        const openAssumption = [...scope.stack].reverse()
          .map((entry) => document.steps.find((item) => item.id === entry.assumptionId))
          .find((item): item is ProofStep => Boolean(item && item.type === 'assumption' && !document.steps.some((other) => other.type === 'discharge' && other.subId === item.subId && other.id !== id)));
        if (openAssumption) {
          step.subId = openAssumption.subId;
        } else {
          // 前面没有可配对的未闭合假设：自带一个假设插入到收尾步之前
          const paired: ProofStep = {
            id: uid('step'),
            type: 'assumption',
            statement: '临时假设',
            rule: '临时假设',
            references: [],
            note: '',
            counterexample: '',
            alternative: '',
            subId: uid(SUB_PREFIX),
          };
          document.steps.splice(index, 0, paired);
          step.subId = paired.subId;
        }
        if (!step.rule || step.rule === '前提') step.rule = '反证法';
      } else {
        delete step.subId;
      }
    });
  }

  removeStep(id: string): void {
    this.update((document) => {
      document.steps = document.steps.filter((step) => step.id !== id);
      document.steps.forEach((step) => {
        step.references = step.references.filter((reference) => reference !== id);
      });
    });
    this.ensureSelection();
  }

  moveStep(sourceId: string, targetId: string): void {
    if (sourceId === targetId) return;
    this.update((document) => {
      const from = document.steps.findIndex((step) => step.id === sourceId);
      const to = document.steps.findIndex((step) => step.id === targetId);
      if (from < 0 || to < 0) return;
      const [moved] = document.steps.splice(from, 1);
      document.steps.splice(to, 0, moved);
    });
  }

  updateStep(patch: Partial<ProofStep>): void {
    const id = this.selectedStepId;
    this.update((document) => {
      const step = document.steps.find((item) => item.id === id);
      if (step) Object.assign(step, patch);
    });
  }

  createVersion(): void {
    this.update((document) => {
      const version: ProofVersion = {
        id: uid('version'),
        name: `版本 ${document.versions.length + 1}`,
        createdAt: new Date().toISOString(),
        steps: clone(document.steps),
        goal: document.goal,
      };
      document.versions.unshift(version);
      this.compareVersionId = version.id;
    });
    this.notify('已保存当前证明快照');
  }

  notify(message: string): void {
    this.toast = message;
    window.setTimeout(() => {
      if (this.toast === message) {
        this.toast = '';
        redraw();
      }
    }, 2200);
  }
}

function stripLatexCommands(text: string): string {
  return text.replace(/\\[A-Za-z]+/g, ' ').replace(/[{}_^]/g, ' ');
}

export interface ScopeEntry {
  assumptionId: string;
  subId: string;
}

export interface StepScopeInfo {
  /** 该步骤被处理“之前”已打开的子证明栈（栈底 → 栈顶） */
  stack: ScopeEntry[];
  /** 引用判定时该步骤所处的上下文：收尾步在父作用域，其余在自身所在作用域 */
  context: ScopeEntry[];
  /** 仅收尾步：它正常关闭的子证明开始步 id */
  closes?: string;
  /** 收尾步找不到与之匹配的未闭合开始步 */
  strayDischarge?: boolean;
}

/**
 * 按步骤顺序维护子证明作用域栈：
 * assumption 压栈，与之配对（subId 相同且位于栈顶）的 discharge 弹栈。
 * 中间步骤不携带 subId，其所属子证明完全由栈推出，因此旧稿（没有任何
 * assumption/discharge）分析出来全部处于顶层，等价于“按普通步骤看待”。
 */
export function analyzeScopes(steps: ProofStep[]): StepScopeInfo[] {
  const stack: ScopeEntry[] = [];
  return steps.map((step) => {
    if (step.type === 'assumption') {
      const entry: ScopeEntry = { assumptionId: step.id, subId: step.subId ?? step.id };
      const info: StepScopeInfo = { stack: [...stack], context: [...stack, entry] };
      stack.push(entry);
      return info;
    }
    if (step.type === 'discharge') {
      const top = stack[stack.length - 1];
      if (top && (step.subId ?? step.id) === top.subId) {
        const info: StepScopeInfo = { stack: [...stack], context: stack.slice(0, -1), closes: top.assumptionId };
        stack.pop();
        return info;
      }
      return { stack: [...stack], context: [...stack], strayDischarge: true };
    }
    return { stack: [...stack], context: [...stack] };
  });
}

/** outer 是 inner 的外层（前缀）作用域，即 outer 中的步骤对 inner 可见。 */
function isPrefixScope(outer: ScopeEntry[], inner: ScopeEntry[]): boolean {
  return outer.length <= inner.length && outer.every((entry, index) => entry.subId === inner[index]?.subId);
}

export function validate(document: ProofDocument): ProofCheck[] {
  const checks: ProofCheck[] = [];
  const ids = new Set(document.steps.map((step) => step.id));
  const symbolKeys = new Set(Object.keys(document.symbols));
  const ignored = new Set(['a', 'A', 'b', 'B', 'n', 'k', 'P', 'Q', 'R', 'x', 'y', 'm', 'to', 'text', 'frac', 'sqrt', 'dfrac']);

  const scopes = analyzeScopes(document.steps);
  const scopeById = new Map(document.steps.map((step, index) => [step.id, scopes[index]]));
  const stepById = new Map(document.steps.map((step) => [step.id, step]));
  const label = (id: string): string => {
    const index = document.steps.findIndex((step) => step.id === id);
    return index >= 0 ? `步骤 ${index + 1}` : id;
  };

  document.steps.forEach((step, index) => {
    const tokens = stripLatexCommands(step.statement).match(/\b[A-Za-z][A-Za-z0-9']*\b/g) ?? [];
    const unknown = [...new Set(tokens.filter((token) => !symbolKeys.has(token) && !ignored.has(token)))];
    if (unknown.length) {
      checks.push({ id: `symbol-${step.id}`, severity: 'warning', title: '发现未定义符号', detail: `步骤 ${index + 1} 使用了：${unknown.join('、')}`, stepId: step.id });
    }

    const scope = scopes[index];
    if (scope.strayDischarge) {
      checks.push({ id: `stray-discharge-${step.id}`, severity: 'error', title: '子证明收尾缺少匹配的开始', detail: `步骤 ${index + 1} 标记为子证明收尾，但没有与之配对的“临时假设”开始步。`, stepId: step.id });
    }

    step.references.forEach((reference) => {
      if (!ids.has(reference)) {
        checks.push({ id: `missing-${step.id}-${reference}`, severity: 'error', title: '引用步骤不存在', detail: `步骤 ${index + 1} 引用了已删除的步骤 ${reference}`, stepId: step.id });
        return;
      }
      const target = stepById.get(reference)!;
      const targetScope = scopeById.get(reference)!;

      // 收尾步直接引用自己要收回的假设：假设没有被收回
      if (step.type === 'discharge' && scope.closes && target.type === 'assumption' && target.id === scope.closes) {
        checks.push({
          id: `undischarged-${step.id}`,
          severity: 'error',
          title: '临时假设未收回',
          detail: `步骤 ${index + 1} 是子证明收尾，却仍直接引用 ${label(reference)} 的临时假设；收尾结论不得再依赖该假设。`,
          stepId: step.id,
        });
        return;
      }

      // 正常收尾步在父作用域下结论，但允许引用本子证明内部的推导（虚拟上下文保留被关闭的子证明）
      const virtualContext = step.type === 'discharge' && scope.closes ? scope.stack : scope.context;
      if (!isPrefixScope(targetScope.context, virtualContext)) {
        const targetKind = target.type === 'assumption' ? '临时假设' : target.type === 'discharge' ? '另一个子证明的收尾' : '子证明内部步骤';
        checks.push({
          id: `scope-${step.id}-${reference}`,
          severity: 'error',
          title: '引用依赖越界',
          detail: `步骤 ${index + 1} 引用了 ${label(reference)}：该${targetKind}只在所属子证明内有效，外部只能引用该子证明的收尾步骤。`,
          stepId: step.id,
        });
      }
    });
  });

  // 扫描结束后仍在栈中的 assumption：子证明没有收尾
  scopes[scopes.length - 1]?.stack.forEach((entry) => {
    const index = document.steps.findIndex((step) => step.id === entry.assumptionId);
    checks.push({ id: `unclosed-${entry.assumptionId}`, severity: 'error', title: '子证明缺少收尾', detail: `步骤 ${index + 1} 的临时假设开启了子证明，但没有配对的收尾步骤将其收回。`, stepId: entry.assumptionId });
  });

  const graph = new Map(document.steps.map((step) => [step.id, step.references.filter((id) => ids.has(id))]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleStep = new Set<string>();
  const visit = (id: string, path: string[]): boolean => {
    if (visiting.has(id)) {
      path.slice(path.indexOf(id)).forEach((item) => cycleStep.add(item));
      return true;
    }
    if (visited.has(id)) return false;
    visiting.add(id);
    const hasCycle = (graph.get(id) ?? []).some((next) => visit(next, [...path, id]));
    visiting.delete(id);
    visited.add(id);
    return hasCycle;
  };
  [...graph.keys()].forEach((id) => visit(id, []));
  if (cycleStep.size) {
    checks.push({ id: 'cycle', severity: 'error', title: '检测到循环引用', detail: '引用链形成闭环，请调整步骤关系。', stepId: [...cycleStep][0] });
  }

  const goalStep = document.steps.find((step) => step.type === 'goal' && step.rule === '结论');
  if (!goalStep) {
    checks.push({ id: 'goal-missing', severity: 'error', title: '目标未被证明', detail: '请添加“结论”类型的最终步骤。' });
  } else if (goalStep.references.length === 0) {
    checks.push({ id: 'goal-unlinked', severity: 'warning', title: '结论尚无推导支撑', detail: '最终步骤没有引用任何前置步骤。', stepId: goalStep.id });
  }

  if (!checks.some((check) => check.severity === 'error')) {
    checks.push({ id: 'proof-ok', severity: 'info', title: '结构检查通过', detail: '未发现缺失引用、循环引用或未证明目标。' });
  }
  return checks;
}

export function compareVersion(document: ProofDocument, version: ProofVersion) {
  const result = [];
  const size = Math.max(document.steps.length, version.steps.length);
  for (let index = 0; index < size; index += 1) {
    const before = version.steps[index]?.statement ?? '';
    const after = document.steps[index]?.statement ?? '';
    const kind = !before ? 'added' : !after ? 'removed' : before === after ? 'same' : 'changed';
    result.push({ kind, label: `步骤 ${index + 1}`, before, after } as const);
  }
  return result;
}

export function createId(prefix: string): string {
  return uid(prefix);
}
