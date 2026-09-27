export type StepType = 'premise' | 'derivation' | 'goal';
export type CheckSeverity = 'error' | 'warning' | 'info';
export type SubproofRole = 'assume' | 'close';

export interface ProofStep {
  id: string;
  type: StepType;
  statement: string;
  rule: string;
  references: string[];
  note: string;
  counterexample: string;
  alternative: string;
  /** 子证明标记：assume 为子证明起点（临时假设），close 为收尾。缺省视为普通步骤。 */
  subproofRole?: SubproofRole;
  /** 同一子证明的起止步骤共享的标识。 */
  subproofId?: string;
  /** 临时假设采用的证明方法（反证法 / 数学归纳）。 */
  assumptionMethod?: string;
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

export interface SubproofInfo {
  id: string;
  label: string;
  method: string;
  assumeStepId: string;
  closeStepId: string | null;
  startIndex: number;
  endIndex: number | null;
}

export interface SubproofAnalysis {
  subproofs: SubproofInfo[];
  /** 每个步骤所属的子证明（含嵌套，自外向内排列）。 */
  byStep: Map<string, SubproofInfo[]>;
  /** 每个步骤的子证明嵌套深度，普通步骤为 0。 */
  depth: Map<string, number>;
  /** 起止未配对、嵌套交叉等结构性问题。 */
  checks: ProofCheck[];
}
