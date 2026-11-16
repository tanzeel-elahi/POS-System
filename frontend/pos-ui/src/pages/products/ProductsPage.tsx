import { useState } from 'react';
import { App, Button, Card, Dropdown, Flex, Input, Select, Space, Tag, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  QrcodeOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GenericTable } from '@components/GenericTable';
import { DeleteConfirmModal } from '@components/DeleteConfirmModal';
import { ProductService } from '@services/productService';
import { ProductGroupService } from '@services/productGroupService';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import type { Product } from '@/types';
import { ProductFormModal } from './ProductFormModal';
import { ProductCreateModal } from './ProductCreateModal';
import { ProductGroupEditModal } from './ProductGroupEditModal';
import { VariantFormModal } from './VariantFormModal';
import { CategoriesModal } from './CategoriesModal';
import { ProductQrModal } from './ProductQrModal';
import { useCategories } from './useCategories';

export const ProductsPage = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>();
  const [sortField, setSortField] = useState<string>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>();

  // modals
  const [simpleOpen, setSimpleOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null); // simple product being edited
  const [createOpen, setCreateOpen] = useState(false);
  const [variantModal, setVariantModal] = useState<{ editing: Product | null; groupId: string | null } | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null); // one product / one variant
  const [deletingGroup, setDeletingGroup] = useState<Product | null>(null); // whole product
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const categoriesQuery = useCategories();

  const query = useQuery({
    queryKey: ['products', pagination, search, category, sortField, sortOrder],
    queryFn: () =>
      ProductService.getProducts({
        skip: (pagination.current - 1) * pagination.pageSize,
        take: pagination.pageSize,
        search: search || undefined,
        category,
        sortField,
        sortOrder,
      }),
    placeholderData: (prev) => prev,
  });

  // One prefix refreshes the list, the billing search AND every ['products', 'group', id] detail.
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

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => ProductGroupService.deleteGroup(id),
    onSuccess: () => {
      message.success('Product and all its variants deleted');
      setDeletingGroup(null);
      refresh();
    },
    onError: () => message.error('Failed to delete product'),
  });

  const openEdit = (record: Product) => {
    if (record.group) setVariantModal({ editing: record, groupId: record.group });
    else {
      setEditing(record);
      setSimpleOpen(true);
    }
  };

  const columns: TableColumnsType<Product> = [
    { title: 'Name', dataIndex: 'displayName', sorter: true },
    { title: 'SKU', dataIndex: 'sku', sorter: true },
    { title: 'Category', dataIndex: 'categoryName', render: (v: string | null) => v || '-' },
    { title: 'Price', dataIndex: 'price', sorter: true, align: 'right', render: (v: number) => v.toFixed(2) },
    {
      title: 'Stock',
      dataIndex: 'stockQuantity',
      sorter: true,
      align: 'right',
      render: (v: number) => (v === 0 ? <Tag color="red">Out of stock</Tag> : v <= 10 ? <Tag color="orange">{v} low</Tag> : v),
    },
    {
      title: 'Action',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, record) => {
        const isVariant = !!record.group;
        return (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'qr', icon: <QrcodeOutlined />, label: 'QR code', onClick: () => setQrProduct(record) },
                { key: 'edit', icon: <EditOutlined />, label: isVariant ? 'Edit variant' : 'Edit', onClick: () => openEdit(record) },
                ...(isVariant
                  ? [
                    {
                      key: 'edit-product',
                      icon: <EditOutlined />,
                      label: 'Edit product (name, category)',
                      onClick: () => setEditGroupId(record.group),
                    },
                    {
                      key: 'add-variant',
                      icon: <AppstoreAddOutlined />,
                      label: 'Add variant',
                      onClick: () => setVariantModal({ editing: null, groupId: record.group }),
                    },
                  ]
                  : []),
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: isVariant ? 'Delete variant' : 'Delete',
                  danger: true,
                  onClick: () => setDeleting(record),
                },
                ...(isVariant
                  ? [
                    {
                      key: 'delete-product',
                      icon: <DeleteOutlined />,
                      label: 'Delete whole product',
                      danger: true,
                      onClick: () => setDeletingGroup(record),
                    },
                  ]
                  : []),
              ],
            }}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
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
        <Space wrap>
          <Select
            allowClear
            placeholder="All categories"
            style={{ width: 180 }}
            value={category}
            loading={categoriesQuery.isLoading}
            options={(categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            onChange={(v) => {
              setCategory(v);
              setPagination((p) => ({ ...p, current: 1 }));
            }}
          />
          <Input.Search
            allowClear
            placeholder="Search name, SKU or QR code..."
            onSearch={(v) => { setSearch(v.trim()); setPagination((p) => ({ ...p, current: 1 })); }}
            style={{ width: 260 }}
          />
          <Button icon={<TagsOutlined />} onClick={() => setCategoriesOpen(true)}>
            Categories
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
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
        open={simpleOpen}
        editing={editing}
        onClose={() => { setSimpleOpen(false); setEditing(null); }}
        onSuccess={() => { setSimpleOpen(false); setEditing(null); refresh(); }}
      />

      <ProductCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); refresh(); }}
      />

      <VariantFormModal
        open={!!variantModal}
        editing={variantModal?.editing ?? null}
        groupId={variantModal?.groupId ?? null}
        onClose={() => setVariantModal(null)}
        onSuccess={() => { setVariantModal(null); refresh(); }}
      />

      <ProductGroupEditModal
        groupId={editGroupId}
        onClose={() => setEditGroupId(null)}
        onSuccess={() => { setEditGroupId(null); refresh(); }}
      />

      <CategoriesModal open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ProductQrModal product={qrProduct} onClose={() => setQrProduct(null)} />

      <DeleteConfirmModal
        open={!!deleting}
        itemLabel={deleting?.displayName ?? ''}
        title={deleting?.group ? 'Delete Variant' : 'Delete Product'}
        warningMessage="This action cannot be undone."
        confirmLoading={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />

      <DeleteConfirmModal
        open={!!deletingGroup}
        itemLabel={deletingGroup?.name ?? ''}
        title="Delete Whole Product"
        warningMessage="This deletes the product and ALL of its variants."
        confirmLoading={deleteGroupMutation.isPending}
        onCancel={() => setDeletingGroup(null)}
        onConfirm={() => deletingGroup?.group && deleteGroupMutation.mutate(deletingGroup.group)}
      />
    </Space>
  );
};