import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { TreeSelect } from 'antd';
import { useCategoryTree } from './useCategories';
import { toSelectData } from './categoryUtils';

interface Props {
  value?: string | null;
  onChange?: (value?: string) => void;
  placeholder?: string;
  style?: CSSProperties;
}

export const CategorySelect = ({ value, onChange, placeholder = 'No category', style }: Props) => {
  const { data, isLoading } = useCategoryTree();
  const treeData = useMemo(() => toSelectData(data ?? []), [data]);

  return (
    <TreeSelect
      // remount once the data arrives so treeDefaultExpandAll applies to it
      key={data ? 'loaded' : 'loading'}
      showSearch
      allowClear
      treeLine
      treeDefaultExpandAll
      treeNodeFilterProp="title"
      treeNodeLabelProp="label"
      popupMatchSelectWidth={false}
      listHeight={320}
      placeholder={placeholder}
      loading={isLoading}
      style={style}
      value={value ?? undefined}
      onChange={(v) => onChange?.(v ?? undefined)}
      treeData={treeData}
    />
  );
};