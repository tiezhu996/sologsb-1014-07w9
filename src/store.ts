import { redraw } from 'mithril';
import type { ProofCheck, ProofDocument, ProofStep, ProofVersion, SubproofAnalysis, SubproofInfo } from './types';

const STORAGE_KEY = 'sologsb-1014-proof-workspace-v1';
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T>(value: T): T => structuredClone(value);

export const RULES = ['前提', '定义展开', '代入', '等式变形', '分配律', '同类项合并', '数学归纳', '反证法', '构造法', '结论'];
export const SUBPROOF_METHODS = ['反证法', '数学归纳'];
const SUBPROOF_LABELS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

/**
 * 扫描步骤序列，圈出每个子证明的范围（假设步骤起、收尾步骤止，含首尾，允许嵌套）。
 * 没有子证明标记的旧文档会得到空结果，全部步骤按普通步骤看待。
 */
export function analyzeSubproofs(document: ProofDocument): SubproofAnalysis {
  const subproofs: SubproofInfo[] = [];
  const byStep = new Map<string, SubproofInfo[]>();
  const depth = new Map<string, number>();
  const checks: ProofCheck[] = [];
  const stack: SubproofInfo[] = [];

  const remember = (info: SubproofInfo, stepId: string) => {
    const list = byStep.get(stepId) ?? [];
    list.push(info);
    byStep.set(stepId, list);
  };

  document.steps.forEach((step, index) => {
    if (step.subproofRole === 'assume' && step.subproofId) {
      const info: SubproofInfo = {
        id: step.subproofId,
        label: SUBPROOF_LABELS[subproofs.length] ?? `S${subproofs.length + 1}`,
        method: step.assumptionMethod || '未指明方法',
        assumeStepId: step.id,
        closeStepId: null,
        startIndex: index,
        endIndex: null,
      };
      subproofs.push(info);
      stack.push(info);
    }
    stack.forEach((info) => remember(info, step.id));
    depth.set(step.id, stack.length);
    if (step.subproofRole === 'close') {
      const openIndex = stack.findIndex((info) => info.id === step.subproofId);
      if (openIndex < 0) {
        checks.push({
          id: `subproof-unopened-${step.id}`,
          severity: 'error',
          title: '子证明收尾未配对',
          detail: `步骤 ${index + 1} 标记为子证明收尾，但找不到与之配对的假设起点。`,
          stepId: step.id,
        });
      } else {
        if (openIndex !== stack.length - 1) {
          const blocker = stack[stack.length - 1];
          checks.push({
            id: `subproof-cross-${step.id}`,
            severity: 'error',
            title: '子证明嵌套交叉',
            detail: `步骤 ${index + 1} 试图收尾子证明 ${stack[openIndex].label}，但内层的子证明 ${blocker.label} 尚未收尾，请先收尾内层。`,
            stepId: step.id,
          });
        }
        const info = stack[openIndex];
        info.closeStepId = step.id;
        info.endIndex = index;
        stack.splice(openIndex, 1);
      }
    }
  });

  stack.forEach((info) => {
    checks.push({
      id: `subproof-unclosed-${info.id}`,
      severity: 'error',
      title: '子证明未收尾',
      detail: `子证明 ${info.label}（步骤 ${info.startIndex + 1} 的临时假设）缺少收尾步骤，假设一直未被收回。`,
      stepId: info.assumeStepId,
    });
  });

  return { subproofs, byStep, depth, checks };
}

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

function subproofSampleSteps(): ProofStep[] {
  return [
    { id: 'c1', type: 'premise', statement: '任一有理数都可写成既约分数 $\\frac{p}{q}$（$p,q$ 互质，$q\\ne 0$）', rule: '前提', references: [], note: '', counterexample: '', alternative: '' },
    { id: 'c2', type: 'derivation', statement: '假设 $\\sqrt{2}$ 是有理数', rule: '反证法', references: [], note: '临时假设，只在子证明 甲 内有效。', counterexample: '', alternative: '', subproofRole: 'assume', subproofId: 'sub-c', assumptionMethod: '反证法' },
    { id: 'c3', type: 'derivation', statement: '$\\sqrt{2}=\\frac{p}{q}$，其中 $p,q$ 互质', rule: '代入', references: ['c1', 'c2'], note: '', counterexample: '', alternative: '' },
    { id: 'c4', type: 'derivation', statement: '$2q^2=p^2$，故 $p^2$ 为偶数，$p$ 为偶数', rule: '等式变形', references: ['c3'], note: '', counterexample: '', alternative: '' },
    { id: 'c5', type: 'derivation', statement: '设 $p=2m$，则 $q^2=2m^2$，$q$ 也是偶数', rule: '等式变形', references: ['c4'], note: '', counterexample: '', alternative: '' },
    { id: 'c6', type: 'derivation', statement: '$p,q$ 有公因子 $2$，与互质矛盾，故假设不成立', rule: '反证法', references: ['c3', 'c5'], note: '收尾：结论由子证明内的推导得出，不再直接依赖假设。', counterexample: '', alternative: '', subproofRole: 'close', subproofId: 'sub-c', assumptionMethod: '反证法' },
    { id: 'c7', type: 'goal', statement: '$\\sqrt{2}$ 是无理数', rule: '结论', references: ['c6'], note: '子证明外只能引用收尾步骤。', counterexample: '', alternative: '' },
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
      id: 'doc-induction',
      title: '数学归纳法待核对稿',
      author: '学生工作区',
      goal: '$P(n)$ 对所有正整数 $n$ 成立',
      symbols: { P: '关于正整数的命题', n: '正整数', k: '正整数' },
      steps: issueSteps(),
      versions: [],
      updatedAt: now,
    },
    {
      id: 'doc-contradiction',
      title: '根号 2 无理性（反证法）',
      author: '数学组',
      goal: '$\\sqrt{2}$ 是无理数',
      symbols: { p: '整数', q: '非零整数', m: '整数' },
      steps: subproofSampleSteps(),
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

  removeStep(id: string): void {
    this.update((document) => {
      document.steps = document.steps.filter((step) => step.id !== id);
      document.steps.forEach((step) => {
        step.references = step.references.filter((reference) => reference !== id);
      });
    });
    this.ensureSelection();
  }

  /** 在当前步骤后插入一个临时假设步骤，开启子证明。 */
  startSubproof(method: string): void {
    const step: ProofStep = {
      id: uid('step'),
      type: 'derivation',
      statement: method === '数学归纳' ? '假设 $P(k)$ 成立（归纳假设）' : '假设结论不成立（待否定）',
      rule: method,
      references: [],
      note: '',
      counterexample: '',
      alternative: '',
      subproofRole: 'assume',
      subproofId: uid('sub'),
      assumptionMethod: method,
    };
    this.update((document) => {
      const selectedIndex = document.steps.findIndex((item) => item.id === this.selectedStepId);
      document.steps.splice(selectedIndex + 1, 0, step);
    });
    this.selectedStepId = step.id;
  }

  /** 为当前步骤所在的（最内层未收尾）子证明补上收尾步骤，插到该子证明末尾。 */
  closeSubproof(): void {
    const analysis = analyzeSubproofs(this.current);
    const enclosing = analysis.byStep.get(this.selectedStepId) ?? [];
    const target = enclosing.filter((info) => info.closeStepId === null).pop();
    if (!target) {
      this.notify('当前步骤不在未收尾的子证明内');
      return;
    }
    let insertAt = this.current.steps.length;
    let lastInteriorId = '';
    for (let index = this.current.steps.length - 1; index >= 0; index -= 1) {
      const stepId = this.current.steps[index].id;
      if ((analysis.byStep.get(stepId) ?? []).includes(target)) {
        insertAt = index + 1;
        if (stepId !== target.assumeStepId) lastInteriorId = stepId;
        break;
      }
    }
    const step: ProofStep = {
      id: uid('step'),
      type: 'derivation',
      statement: target.method === '数学归纳' ? '由归纳假设推出 $P(k+1)$，归纳步骤成立' : '矛盾，故假设不成立，原命题得证',
      rule: target.method,
      references: lastInteriorId ? [lastInteriorId] : [],
      note: '',
      counterexample: '',
      alternative: '',
      subproofRole: 'close',
      subproofId: target.id,
      assumptionMethod: target.method,
    };
    this.update((document) => {
      document.steps.splice(insertAt, 0, step);
    });
    this.selectedStepId = step.id;
  }

  /** 取消整个子证明的标记，起止步骤退回为普通步骤。 */
  unmarkSubproof(subproofId: string): void {
    this.update((document) => {
      document.steps.forEach((step) => {
        if (step.subproofId === subproofId) {
          delete step.subproofRole;
          delete step.subproofId;
          delete step.assumptionMethod;
        }
      });
    });
    this.notify('已取消子证明标记，相关步骤按普通步骤看待');
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

export function validate(document: ProofDocument): ProofCheck[] {
  const checks: ProofCheck[] = [];
  const ids = new Set(document.steps.map((step) => step.id));
  const symbolKeys = new Set(Object.keys(document.symbols));
  const ignored = new Set(['a', 'A', 'b', 'B', 'n', 'k', 'P', 'Q', 'R', 'x', 'y', 'to', 'text', 'frac', 'sqrt']);

  document.steps.forEach((step, index) => {
    const tokens = stripLatexCommands(step.statement).match(/\b[A-Za-z][A-Za-z0-9']*\b/g) ?? [];
    const unknown = [...new Set(tokens.filter((token) => !symbolKeys.has(token) && !ignored.has(token)))];
    if (unknown.length) {
      checks.push({ id: `symbol-${step.id}`, severity: 'warning', title: '发现未定义符号', detail: `步骤 ${index + 1} 使用了：${unknown.join('、')}`, stepId: step.id });
    }

    step.references.forEach((reference) => {
      if (!ids.has(reference)) {
        checks.push({ id: `missing-${step.id}-${reference}`, severity: 'error', title: '引用步骤不存在', detail: `步骤 ${index + 1} 引用了已删除的步骤 ${reference}`, stepId: step.id });
      }
    });
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

  const subproofs = analyzeSubproofs(document);
  checks.push(...subproofs.checks);
  const indexOfStep = new Map(document.steps.map((step, index) => [step.id, index]));

  // 作用域：子证明内的假设与中间步骤只在子证明内可见，外部只能引用收尾步骤。
  document.steps.forEach((step, index) => {
    const ownSubproofs = subproofs.byStep.get(step.id) ?? [];
    step.references.forEach((reference) => {
      if (!ids.has(reference)) return;
      const targetSubproofs = subproofs.byStep.get(reference) ?? [];
      targetSubproofs.forEach((info) => {
        if (ownSubproofs.includes(info)) return;
        if (reference === info.closeStepId) return;
        const targetIndex = indexOfStep.get(reference) ?? 0;
        const role = reference === info.assumeStepId ? '临时假设' : '中间步骤';
        const visible = info.endIndex !== null ? `子证明外只能引用其收尾步骤（步骤 ${info.endIndex + 1}）` : '该子证明尚未收尾，其内部步骤一律不可外引';
        checks.push({
          id: `scope-${step.id}-${reference}`,
          severity: 'error',
          title: '引用越出子证明作用域',
          detail: `步骤 ${index + 1} 在子证明 ${info.label} 之外，却引用了其中的${role}（步骤 ${targetIndex + 1}）；${visible}。`,
          stepId: step.id,
        });
      });
    });
  });

  // 收回：收尾步骤必须给出不再依赖假设的结论，即不得再直接引用本子证明的假设。
  subproofs.subproofs.forEach((info) => {
    if (!info.closeStepId) return;
    const closeStep = document.steps.find((step) => step.id === info.closeStepId);
    if (!closeStep) return;
    if (closeStep.references.includes(info.assumeStepId)) {
      checks.push({
        id: `discharge-${info.id}`,
        severity: 'error',
        title: '假设未收回',
        detail: `子证明 ${info.label} 的收尾步骤（步骤 ${(info.endIndex ?? 0) + 1}）仍直接引用临时假设（步骤 ${info.startIndex + 1}），收尾必须给出不再依赖假设的结论。`,
        stepId: info.closeStepId,
      });
      return;
    }
    const usesInterior = closeStep.references.some((reference) => (subproofs.byStep.get(reference) ?? []).includes(info));
    if (!usesInterior) {
      checks.push({
        id: `close-unlinked-${info.id}`,
        severity: 'warning',
        title: '收尾未引用子证明内部推导',
        detail: `子证明 ${info.label} 的收尾步骤没有引用子证明内的任何推导，结论可能并非由假设推出。`,
        stepId: info.closeStepId,
      });
    }
  });

  const goalStep = document.steps.find((step) => step.type === 'goal' && step.rule === '结论');
  if (!goalStep) {
    checks.push({ id: 'goal-missing', severity: 'error', title: '目标未被证明', detail: '请添加“结论”类型的最终步骤。' });
  } else if (goalStep.references.length === 0) {
    checks.push({ id: 'goal-unlinked', severity: 'warning', title: '结论尚无推导支撑', detail: '最终步骤没有引用任何前置步骤。', stepId: goalStep.id });
  }

  if (!checks.some((check) => check.severity === 'error')) {
    checks.push({ id: 'proof-ok', severity: 'info', title: '结构检查通过', detail: '未发现缺失引用、循环引用、子证明作用域问题或未证明目标。' });
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
