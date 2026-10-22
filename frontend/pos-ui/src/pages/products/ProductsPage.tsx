import { useState } from 'react';
import { App, Button, Card, Dropdown, Flex, Input, Space, Tag, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GenericTable } from '@components/GenericTable';
import { DeleteConfirmModal } from '@components/DeleteConfirmModal';
import { ProductService } from '@services/productService';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import type { Product } from '@/types';
import { ProductFormModal } from './ProductFormModal';

export const ProductsPage = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const query = useQuery({
    queryKey: ['products', pagination, search, sortField, sortOrder],
    queryFn: () =>
      ProductService.getProducts({
        skip: (pagination.current - 1) * pagination.pageSize,
        take: pagination.pageSize,
        search: search || undefined,
        sortField,
        sortOrder,
      }),
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ProductService.deleteProduct(id),
    onSuccess: () => {
      message.success('Product deleted successfully');
      setDeleting(null);
      refresh();
    },
    onError: () => message.error('Failed to delete product'),
  });

  const columns: TableColumnsType<Product> = [
    { title: 'Name', dataIndex: 'name', sorter: true },
    { title: 'SKU', dataIndex: 'sku', sorter: true },
    { title: 'Price', dataIndex: 'price', sorter: true, align: 'right', render: (v: number) => v.toFixed(2) },
    {
      title: 'Stock',
      dataIndex: 'stockQuantity',
      sorter: true,
      align: 'right',
      render: (v: number) => (v === 0 ? <Tag color="red">Out of stock</Tag> : v <= 10 ? <Tag color="orange">{v} low</Tag> : v),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Action',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, record) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => { setEditing(record); setFormOpen(true); } },
              { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => setDeleting(record) },
            ],
          }}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const onTableChange: TableProps<Product>['onChange'] = (p, _f, sorter) => {
    setPagination({ current: p.current ?? 1, pageSize: p.pageSize ?? DEFAULT_PAGE_SIZE });
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortField(s?.order ? String(s.field ?? s.columnKey) : undefined);
    setSortOrder(s?.order === 'descend' ? 'desc' : s?.order === 'ascend' ? 'asc' : undefined);
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Typography.Title level={3} style={{ margin: 0 }}>Products</Typography.Title>
        <Space>
          <Input.Search
            allowClear
            placeholder="Search name, SKU, category..."
            onSearch={(v) => { setSearch(v.trim()); setPagination((p) => ({ ...p, current: 1 })); }}
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Product
          </Button>
        </Space>
      </Flex>

      <Card styles={{ body: { padding: 0 } }}>
        <GenericTable<Product>
          columns={columns}
          dataSource={query.data?.data ?? []}
          loading={query.isLoading || query.isFetching}
          onChange={onTableChange}
          pagination={{ ...pagination, total: query.data?.total ?? 0 }}
        />
      </Card>

      <ProductFormModal
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSuccess={() => { setFormOpen(false); setEditing(null); refresh(); }}
      />

      <DeleteConfirmModal
        open={!!deleting}
        itemLabel={deleting?.name ?? ''}
        title="Delete Product"
        warningMessage="This action cannot be undone."
        confirmLoading={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </Space>
  );
};
