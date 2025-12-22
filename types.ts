
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ThoughtNode {
  id: string;
  label: string;
  description: string;
  parentId: string | null;
  level: number;
  position: { x: number; y: number };
  isExpanded: boolean;
  isLoading: boolean;
  isCollapsed?: boolean;
  isHidden?: boolean;
  isNew?: boolean;
  sources?: GroundingSource[];
  path: string[];
}

export interface BranchingResponse {
  topic: string;
  description: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
}
