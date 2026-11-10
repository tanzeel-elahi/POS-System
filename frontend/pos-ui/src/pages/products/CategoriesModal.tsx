import { useState } from 'react';
import { App, Button, Input, Modal, Popconfirm, Space, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryService } from '@services/categoryService';
import { getApiError } from '@/utils/apiError';
import type { Category } from '@/types';
import { useCategories } from './useCategories';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CategoriesModal = ({ open, onClose }: Props) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const categoriesQuery = useCategories(open);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['products'] }); // product rows carry category_name
  };

  const addMutation = useMutation({
    mutationFn: (n: string) => CategoryService.createCategory(n),
    onSuccess: () => {
      message.success('Category added');
      setName('');
      refresh();
    },
    onError: (e) => message.error(getApiError(e, 'Failed to add category')),
  });

  const renameMutation = useMutation({
    mutationFn: (v: { id: string; name: string }) => CategoryService.renameCategory(v.id, v.name),
    onSuccess: () => {
      message.success('Category renamed');
      refresh();
    },
    onError: (e) => message.error(getApiError(e, 'Failed to rename category')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CategoryService.deleteCategory(id),
    onSuccess: () => {
      message.success('Category deleted');
      refresh();
    },
    onError: (e) => message.error(getApiError(e, 'Failed to delete category')),
  });

  const submitNew = () => {
    const n = name.trim();
    if (n) addMutation.mutate(n);
  };

  const columns: TableColumnsType<Category> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (_, c) => (
        <Typography.Text
          editable={{
            tooltip: 'Rename',
            onChange: (v) => {
              const t = v.trim();
              if (t && t !== c.name) renameMutation.mutate({ id: c.id, name: t });
            },
          }}
        >
          {c.name}
        </Typography.Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, c) => (
        <Popconfirm
          title="Delete this category?"
          description="Existing products keep it, but it can't be assigned to new ones."
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteMutation.mutate(c.id)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal title="Categories" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          placeholder="New category name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={submitNew}
        />
        <Button type="primary" loading={addMutation.isPending} onClick={submitNew}>
          Add
        </Button>
      </Space.Compact>

      <Table<Category>
        size="small"
        rowKey="id"
        loading={categoriesQuery.isLoading}
        columns={columns}
        dataSource={categoriesQuery.data ?? []}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        locale={{ emptyText: 'No categories yet' }}
      />
    </Modal>
  );
};