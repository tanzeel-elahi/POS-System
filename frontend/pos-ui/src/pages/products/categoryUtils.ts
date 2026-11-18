import type { TreeDataNode } from 'antd';
import type { CategoryNode } from '@/types';

export const MAX_DEPTH = 5;

export type CategoryIndex = Map<string, CategoryNode>;

export const buildIndex = (tree: CategoryNode[]): CategoryIndex => {
  const index: CategoryIndex = new Map();
  const walk = (nodes: CategoryNode[]) =>
    nodes.forEach((n) => {
      index.set(n.id, n);
      walk(n.children);
    });
  walk(tree);
  return index;
};

/** 1 for a top-level category. */
export const depthOf = (id: string, index: CategoryIndex): number => {
  let depth = 0;
  let cur = index.get(id);
  while (cur) {
    depth++;
    cur = cur.parent ? index.get(cur.parent) : undefined;
  }
  return depth;
};

/** Levels in this branch, counting the node itself. */
export const heightOf = (node: CategoryNode): number => 1 + Math.max(0, ...node.children.map(heightOf));

/** True if `id` is `ancestorId` itself or sits anywhere below it. */
export const isInside = (id: string, ancestorId: string, index: CategoryIndex): boolean => {
  let cur = index.get(id);
  while (cur) {
    if (cur.id === ancestorId) return true;
    cur = cur.parent ? index.get(cur.parent) : undefined;
  }
  return false;
};

export const toTreeData = (nodes: CategoryNode[]): TreeDataNode[] =>
  nodes.map((n) => ({ key: n.id, title: n.name, children: toTreeData(n.children) }));

export interface SelectNode {
  value: string;
  title: string; // shown in the dropdown (own name) and used for search
  label: string; // shown in the box after selecting (full path)
  children: SelectNode[];
}

export const toSelectData = (nodes: CategoryNode[], parentPath: string[] = []): SelectNode[] =>
  nodes.map((n) => {
    const path = [...parentPath, n.name];
    return {
      value: n.id,
      title: n.name,
      label: path.join(' › '),
      children: toSelectData(n.children, path),
    };
  });