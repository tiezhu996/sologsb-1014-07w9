export type StepType = 'premise' | 'derivation' | 'goal' | 'assumption' | 'discharge';
export type CheckSeverity = 'error' | 'warning' | 'info';

export interface ProofStep {
  id: string;
  type: StepType;
  statement: string;
  rule: string;
  references: string[];
  note: string;
  counterexample: string;
  alternative: string;
  /**
   * 子证明配对标识：assumption（开始·临时假设）与 discharge（收尾）
   * 拥有相同的 subId。中间步骤不带 subId，其所属子证明由步骤顺序与
   * 配对标记按栈结构推出。旧稿没有该字段，一律按普通步骤处理。
   */
  subId?: string;
}

export interface ProofVersion {
  id: string;
  name: string;
  createdAt: string;
  steps: ProofStep[];
  goal: string;
}

export interface ProofDocument {
  id: string;
  title: string;
  author: string;
  goal: string;
  symbols: Record<string, string>;
  steps: ProofStep[];
  versions: ProofVersion[];
  updatedAt: string;
}

export interface ProofCheck {
  id: string;
  severity: CheckSeverity;
  title: string;
  detail: string;
  stepId?: string;
}

export interface ProofDiff {
  kind: 'same' | 'added' | 'removed' | 'changed';
  label: string;
  before: string;
  after: string;
}
