import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Flex, Input, InputNumber, Popconfirm, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type { TableColumnsType } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { GenericTable } from '@components/GenericTable';
import { ProductService } from '@services/productService';
import { useDebounce } from '@/utils/useDebounce';
import type { BulkUpdateResult, Product } from '@/types';
import { CategorySelect } from './CategorySelect';
import { BulkActionModal } from './BulkActionModal';
import type { BulkActionValue } from './BulkActionModal';
import { BulkReviewModal } from './BulkReviewModal';
import { buildUpdates, isEdited, previewPrice, previewStock, rowProblems } from './bulkUtils';
import type { Edits, PriceEdit, RowEdit, StockEdit } from './bulkUtils';

const MAX_ROWS = 500; // also the API's limit per request
const money = (n: number) => n.toFixed(2);

const patchEdit = (prev: Edits, id: string, patch: Partial<RowEdit>): Edits => ({
  ...prev,
  [id]: { ...prev[id], ...patch },
});

export const BulkUpdatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();

  /* ---------- filters ---------- */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>();
  const [includeSub, setIncludeSub] = useState(true);
  const [stockLte, setStockLte] = useState<number | null>(null);
  const debouncedStockLte = useDebounce(stockLte, 400);

  /* ---------- edits ---------- */
  const [edits, setEdits] = useState<Edits>({});
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [actionOpen, setActionOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Edits survive filter changes, so remember every product we've seen to validate hidden rows too.
  const known = useRef(new Map<string, Product>());

  const gridQuery = useQuery({
    queryKey: ['products', 'bulk-grid', search, category, includeSub, debouncedStockLte],
    queryFn: () =>
      ProductService.getProducts({
        take: MAX_ROWS,
        search: search || undefined,
        category,
        includeSubcategories: includeSub,
        stockLte: debouncedStockLte ?? undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = gridQuery.data?.data ?? [];
  rows.forEach((p) => known.current.set(p.id, p));
  const total = gridQuery.data?.total ?? 0;

  const editedIds = Object.keys(edits).filter((id) => isEdited(edits[id]));
  const problemsById = new Map<string, string[]>();
  editedIds.forEach((id) => {
    const p = known.current.get(id);
    const probs = p ? rowProblems(p, edits[id]) : [];
    if (probs.length) problemsById.set(id, probs);
  });
  const updates = buildUpdates(edits);
  const hiddenEdited = editedIds.filter((id) => !rows.some((r) => r.id === id)).length;

  // Warn before leaving with unsaved edits
  useEffect(() => {
    if (editedIds.length === 0) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [editedIds.length]);

  /* ---------- edit actions ---------- */

  const setPrice = (id: string, price: PriceEdit | undefined) => setEdits((prev) => patchEdit(prev, id, { price }));
  const setStock = (id: string, stock: StockEdit | undefined) => setEdits((prev) => patchEdit(prev, id, { stock }));
  const clearRow = (id: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const applyBulk = ({ action, value }: BulkActionValue) => {
    setEdits((prev) => {
      let next = prev;
      selected.forEach((key) => {
        const id = String(key);
        if (action === 'percent') next = patchEdit(next, id, { price: { kind: 'percent', value } });
        else if (action === 'setPrice') next = patchEdit(next, id, { price: { kind: 'set', value } });
        else if (action === 'addStock') next = patchEdit(next, id, { stock: { kind: 'change', value } });
        else next = patchEdit(next, id, { stock: { kind: 'set', value } });
      });
      return next;
    });
    setActionOpen(false);
    message.success(`Applied to ${selected.length} rows. Review before saving.`);
  };

  const handleApplied = (r: BulkUpdateResult | null) => {
    if (r) message.success(`${r.changed} ${r.changed === 1 ? 'product' : 'products'} updated, ${r.unchanged} unchanged`);
    setEdits({});
    setSelected([]);
    setReviewOpen(false);
    queryClient.invalidateQueries({ queryKey: ['products'] }); // refetches this grid, the list and the billing search
  };

  const goBack = () => {
    if (editedIds.length === 0) return navigate('/products');
    modal.confirm({
      title: 'Discard unsaved changes?',
      content: `${editedIds.length} edited ${editedIds.length === 1 ? 'row' : 'rows'} will be lost.`,
      okText: 'Discard and leave',
      okButtonProps: { danger: true },
      onOk: () => navigate('/products'),
    });
  };

  const changeFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setSelected([]); // selection only makes sense for the rows on screen
  };

  /* ---------- table ---------- */

  const columns: TableColumnsType<Product> = [
    { title: 'Product', dataIndex: 'displayName', sorter: (a, b) => a.displayName.localeCompare(b.displayName) },
    { title: 'SKU', dataIndex: 'sku', sorter: (a, b) => a.sku.localeCompare(b.sku) },
    {
      title: 'Price',
      dataIndex: 'price',
      align: 'right',
      sorter: (a, b) => a.price - b.price,
      render: (v: number) => money(v),
    },
    {
      title: 'New price',
      key: 'newPrice',
      width: 190,
      render: (_, p) => {
        const e = edits[p.id];
        const price = e?.price;
        if (price?.kind === 'percent' && price.value != null) {
          const preview = previewPrice(p.price, e);
          return (
            <Tag closable color={price.value >= 0 ? 'green' : 'red'} onClose={() => setPrice(p.id, undefined)}>
              {price.value > 0 ? '+' : ''}
              {price.value}% → ≈{preview != null ? money(preview) : '-'}
            </Tag>
          );
        }
        const bad = (problemsById.get(p.id) ?? []).some((m) => /price|percent/i.test(m));
        return (
          <InputNumber
            size="small"
            min={0.01}
            precision={2}
            placeholder="New price"
            style={{ width: 120 }}
            status={bad ? 'error' : undefined}
            value={price?.value ?? null}
            onChange={(v) => setPrice(p.id, v == null ? undefined : { kind: 'set', value: v })}
          />
        );
      },
    },
    {
      title: 'Stock',
      dataIndex: 'stockQuantity',
      align: 'right',
      sorter: (a, b) => a.stockQuantity - b.stockQuantity,
      render: (v: number) => (v === 0 ? <Tag color="red">0</Tag> : v),
    },
    {
      title: 'Stock edit',
      key: 'stockEdit',
      width: 220,
      render: (_, p) => {
        const e = edits[p.id];
        const kind = e?.stock?.kind ?? 'change';
        const next = previewStock(p.stockQuantity, e);
        const bad = (problemsById.get(p.id) ?? []).some((m) => /stock/i.test(m));
        return (
          <Space orientation="vertical" size={2}>
            <Space.Compact>
              <Tooltip title={kind === 'change' ? 'Add or remove (use negative to remove)' : 'Set exact count — overwrites sales since load'}>
                <Select
                  size="small"
                  style={{ width: 64 }}
                  value={kind}
                  options={[
                    { value: 'change', label: '±' },
                    { value: 'set', label: '=' },
                  ]}
                  onChange={(k: 'change' | 'set') => setStock(p.id, { kind: k, value: e?.stock?.value ?? null })}
                />
              </Tooltip>
              <InputNumber
                size="small"
                precision={0}
                min={kind === 'set' ? 0 : undefined}
                style={{ width: 110 }}
                placeholder={kind === 'change' ? 'e.g. +20' : 'Exact count'}
                status={bad ? 'error' : undefined}
                value={e?.stock?.value ?? null}
                onChange={(v) => setStock(p.id, { kind, value: v })}
              />
            </Space.Compact>
            {next != null && (
              <Typography.Text type={next < 0 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                → {next} in stock
              </Typography.Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Notes',
      key: 'notes',
      render: (_, p) => {
        const probs = problemsById.get(p.id);
        return probs ? <Typography.Text type="danger" style={{ fontSize: 12 }}>{probs.join(' · ')}</Typography.Text> : null;
      },
    },
    {
      title: '',
      key: 'reset',
      width: 70,
      render: (_, p) => (isEdited(edits[p.id]) ? <Button type="link" size="small" onClick={() => clearRow(p.id)}>Reset</Button> : null),
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Flex align="center" gap={8}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBack} />
        <Typography.Title level={3} style={{ margin: 0 }}>Bulk price & stock update</Typography.Title>
      </Flex>

      <Flex gap={8} wrap="wrap" align="center">
        <Input.Search
          allowClear
          placeholder="Search name, SKU or QR code..."
          style={{ width: 260 }}
          onSearch={(v) => changeFilter(setSearch)(v.trim())}
        />
        <CategorySelect value={category} placeholder="All categories" style={{ width: 220 }} onChange={changeFilter(setCategory)} />
        {category && (
          <Checkbox checked={includeSub} onChange={(e) => changeFilter(setIncludeSub)(e.target.checked)}>
            Include subcategories
          </Checkbox>
        )}
        <InputNumber
          min={0}
          precision={0}
          placeholder="Stock at or below"
          style={{ width: 170 }}
          value={stockLte}
          onChange={(v) => changeFilter(setStockLte)(v)}
        />
      </Flex>

      <Alert
        type="info"
        showIcon
        message={
          <span>
            Use <b>±</b> to add or remove stock, which is safe while sales continue. Use <b>=</b> only for a stock count: it
            overwrites any sales made since this grid loaded.
          </span>
        }
      />

      {total > MAX_ROWS && (
        <Alert type="warning" showIcon message={`Showing the first ${MAX_ROWS} of ${total} products. Narrow the filters to see the rest.`} />
      )}

      <Card
        styles={{ body: { padding: 0 } }}
        title={
          <Flex align="center" gap={12} wrap="wrap">
            <Typography.Text>
              <b>{editedIds.length}</b> edited {editedIds.length === 1 ? 'row' : 'rows'}
              {hiddenEdited > 0 && <Typography.Text type="secondary"> ({hiddenEdited} hidden by filters)</Typography.Text>}
            </Typography.Text>
            <Button disabled={selected.length === 0} onClick={() => setActionOpen(true)}>
              Apply action to {selected.length || ''} selected
            </Button>
          </Flex>
        }
        extra={
          <Space>
            <Popconfirm
              title="Discard all edits?"
              okText="Discard"
              okButtonProps={{ danger: true }}
              disabled={editedIds.length === 0}
              onConfirm={() => setEdits({})}
            >
              <Button disabled={editedIds.length === 0}>Discard all</Button>
            </Popconfirm>
            <Tooltip title={problemsById.size > 0 ? `Fix ${problemsById.size} row(s) with errors first` : undefined}>
              <Button type="primary" disabled={updates.length === 0 || problemsById.size > 0} onClick={() => setReviewOpen(true)}>
                Review & save
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <GenericTable<Product>
          columns={columns}
          dataSource={rows}
          loading={gridQuery.isLoading || gridQuery.isFetching}
          pagination={{ pageSize: 50 }}
          rowSelection={{ selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: true }}
          onRow={(p) => ({ style: isEdited(edits[p.id]) ? { background: token.colorWarningBg } : undefined })}
        />
      </Card>

      <BulkActionModal open={actionOpen} count={selected.length} onApply={applyBulk} onClose={() => setActionOpen(false)} />

      <BulkReviewModal
        open={reviewOpen}
        updates={updates}
        nameOf={(id) => known.current.get(id)?.displayName ?? `Product #${id}`}
        onClose={() => setReviewOpen(false)}
        onApplied={handleApplied}
      />
    </Space>
  );
};