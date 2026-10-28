import { useState } from 'react';
import { App, Button, Card, Dropdown, Flex, Input, Space, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GenericTable } from '@components/GenericTable';
import { DeleteConfirmModal } from '@components/DeleteConfirmModal';
import { CustomerService } from '@services/customerService';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import type { Customer } from '@/types';
import { CustomerFormModal } from './CustomerFormModal';
import { CustomerDetailsDrawer } from './CustomerDetailsDrawer';

export const CustomersPage = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  const query = useQuery({
    queryKey: ['customers', pagination, search, sortField, sortOrder],
    queryFn: () =>
      CustomerService.getCustomers({
        skip: (pagination.current - 1) * pagination.pageSize,
        take: pagination.pageSize,
        search: search || undefined,
        sortField,
        sortOrder,
      }),
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => CustomerService.deleteCustomer(id),
    onSuccess: () => {
      message.success('Customer deleted successfully');
      setDeleting(null);
      refresh();
    },
    onError: () => message.error('Failed to delete customer'),
  });

  const columns: TableColumnsType<Customer> = [
    { title: 'Name', dataIndex: 'name', sorter: true },
    { title: 'Phone', dataIndex: 'phone', sorter: true },
    { title: 'Email', dataIndex: 'email', sorter: true, render: (v?: string) => v || '-' },
    { title: 'Address', dataIndex: 'address', render: (v?: string) => v || '-' },
    { title: 'Created', dataIndex: 'createdAt', sorter: true, render: (v: string) => new Date(v).toLocaleDateString() },
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
              { key: 'details', icon: <EyeOutlined />, label: 'Credit & bills', onClick: () => setViewing(record) },
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

  const onTableChange: TableProps<Customer>['onChange'] = (p, _f, sorter) => {
    setPagination({ current: p.current ?? 1, pageSize: p.pageSize ?? DEFAULT_PAGE_SIZE });
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    setSortField(s?.order ? String(s.field ?? s.columnKey) : undefined);
    setSortOrder(s?.order === 'descend' ? 'desc' : s?.order === 'ascend' ? 'asc' : undefined);
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Typography.Title level={3} style={{ margin: 0 }}>Customers</Typography.Title>
        <Space>
          <Input.Search
            allowClear
            placeholder="Search name, phone, email..."
            onSearch={(v) => { setSearch(v.trim()); setPagination((p) => ({ ...p, current: 1 })); }}
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            Add Customer
          </Button>
        </Space>
      </Flex>

      <Card styles={{ body: { padding: 0 } }}>
        <GenericTable<Customer>
          columns={columns}
          dataSource={query.data?.data ?? []}
          loading={query.isLoading || query.isFetching}
          onChange={onTableChange}
          pagination={{ ...pagination, total: query.data?.total ?? 0 }}
        />
      </Card>

      <CustomerFormModal
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSuccess={() => { setFormOpen(false); setEditing(null); refresh(); }}
      />

      <DeleteConfirmModal
        open={!!deleting}
        itemLabel={deleting?.name ?? ''}
        title="Delete Customer"
        warningMessage="This action cannot be undone."
        confirmLoading={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />

      <CustomerDetailsDrawer customer={viewing} onClose={() => setViewing(null)} />
    </Space>
  );
};
