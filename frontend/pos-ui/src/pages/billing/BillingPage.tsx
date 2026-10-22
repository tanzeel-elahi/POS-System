import { useEffect, useRef, useState } from 'react';
import { App, AutoComplete, Button, Card, Col, Descriptions, Flex, Input, InputNumber, Row, Segmented, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProductService } from '@services/productService';
import { CustomerService } from '@services/customerService';
import { BillingService } from '@services/billingService';
import { useDebounce } from '@/utils/useDebounce';
import type { Bill, Customer } from '@/types';
import { BillReceiptModal } from './BillReceiptModal';

interface Row {
  key: string;
  committed: boolean; // true once a product is picked or a custom item is confirmed
  isCustom: boolean;
  productId?: string;
  name: string; // also the text shown in the item input
  sku?: string;
  unitPrice: number | null;
  quantity: number;
  maxQty?: number; // stock limit for catalog items
}

type Focusable = { focus: () => void } | null;

// Invisible prefixes so option values can never collide with something the user types.
const PRODUCT_PREFIX = '\u200Bp:';
const CUSTOM_VALUE = '\u200Bcustom';

let rowSeq = 0;
const newRow = (): Row => ({ key: `r-${++rowSeq}`, committed: false, isCustom: false, name: '', unitPrice: null, quantity: 1 });
const blankRow = (r: Row): Row => ({ ...newRow(), key: r.key });
const isEmptyRow = (r: Row) => !r.committed && !r.name.trim();

/** Keeps exactly one empty row at the bottom. */
const withTrailing = (rows: Row[]): Row[] => {
  const out = [...rows];
  while (out.length > 1 && isEmptyRow(out[out.length - 1]) && isEmptyRow(out[out.length - 2])) out.pop();
  const last = out[out.length - 1];
  if (!last || !isEmptyRow(last)) out.push(newRow());
  return out;
};

const money = (n: number) => n.toFixed(2);

// Django's str(ValidationError) looks like "['message']" — strip that wrapper.
const cleanMsg = (s: string) => s.replace(/^\[['"]/, '').replace(/['"]\]$/, '');

export const BillingPage = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [customerMode, setCustomerMode] = useState<'existing' | 'walkin'>('existing');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [receipt, setReceipt] = useState<Bill | null>(null);

  /* ---------- focus management ---------- */

  const refs = useRef<Record<string, Focusable>>({});
  const pendingFocus = useRef<string | null>(null);
  const focusField = (rowKey: string, field: 'item' | 'price' | 'qty') => {
    pendingFocus.current = `${rowKey}:${field}`;
  };
  // Runs after every render: focuses the field requested by the last action (the row exists by now).
  useEffect(() => {
    if (pendingFocus.current) {
      refs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
  });

  /* ---------- queries (keys share the entity prefix, so one invalidate covers them) ---------- */

  const q = search.trim();
  const debouncedQ = useDebounce(q, 200);
  const debouncedCustomer = useDebounce(customerSearch);

  const productsQuery = useQuery({
    queryKey: ['products', 'billing-search', debouncedQ],
    queryFn: () => ProductService.getProducts({ search: debouncedQ, take: 8 }),
    enabled: debouncedQ.length > 0,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'billing-search', debouncedCustomer],
    queryFn: () => CustomerService.getCustomers({ search: debouncedCustomer || undefined, take: 10 }),
    enabled: customerMode === 'existing' && !customer,
  });

  const products = productsQuery.data?.data ?? [];
  // While the search is still catching up with typing, show no options so Enter can't pick a stale result.
  const searchPending = q !== debouncedQ || productsQuery.isFetching;

  const itemOptions = (() => {
    if (!q || searchPending) return [];
    const opts: { value: string; disabled?: boolean; label: React.ReactNode }[] = products.map((p) => ({
      value: PRODUCT_PREFIX + p.id,
      disabled: p.stockQuantity <= 0,
      label: (
        <Flex justify="space-between" gap={12}>
          <span>
            {p.name} <Typography.Text type="secondary">{p.sku}</Typography.Text>
          </span>
          <span>
            {money(p.price)} · {p.stockQuantity > 0 ? `${p.stockQuantity} in stock` : 'Out of stock'}
          </span>
        </Flex>
      ),
    }));
    const exactMatch = products.some((p) => p.name.toLowerCase() === q.toLowerCase());
    if (!exactMatch) {
      opts.push({
        value: CUSTOM_VALUE,
        label: (
          <span>
            <PlusOutlined /> Add "{q}" as custom item
          </span>
        ),
      });
    }
    return opts;
  })();

  /* ---------- row actions ---------- */

  const onItemText = (key: string, text: string) => {
    if (text.startsWith('\u200B')) return; // echo of an option value after selecting — ignore
    setRows((prev) =>
      withTrailing(
        prev.map((r) => {
          if (r.key !== key) return r;
          if (r.committed && r.name === text) return r;
          // Any edit to the text turns the row back into an uncommitted search
          return { ...r, name: text, committed: false, isCustom: false, productId: undefined, sku: undefined, unitPrice: null, maxQty: undefined };
        }),
      ),
    );
  };

  const onItemSelect = (key: string, value: string) => {
    const current = rows.find((r) => r.key === key);
    if (!current) return;

    // --- custom item ---
    if (value === CUSTOM_VALUE) {
      const name = current.name.trim();
      if (!name) return;
      setRows((prev) =>
        withTrailing(
          prev.map((r) =>
            r.key === key
              ? { ...r, name, committed: true, isCustom: true, productId: undefined, sku: undefined, unitPrice: null, maxQty: undefined, quantity: 1 }
              : r,
          ),
        ),
      );
      focusField(key, 'price');
      return;
    }

    // --- catalog product ---
    const product = products.find((p) => p.id === value.slice(PRODUCT_PREFIX.length));
    if (!product) return;
    if (product.stockQuantity <= 0) {
      message.warning(`"${product.name}" is out of stock`);
      return;
    }

    // Already on the bill? Bump that row instead of adding a duplicate.
    const dup = rows.find((r) => r.productId === product.id && r.key !== key);
    if (dup) {
      if (dup.quantity + 1 > product.stockQuantity) {
        message.warning(`Only ${product.stockQuantity} of "${product.name}" in stock`);
      }
      setRows((prev) =>
        withTrailing(
          prev.map((r) => {
            if (r.key === key) return blankRow(r);
            if (r.key === dup.key && r.quantity + 1 <= product.stockQuantity) return { ...r, quantity: r.quantity + 1 };
            return r;
          }),
        ),
      );
      focusField(key, 'item');
      return;
    }

    setRows((prev) =>
      withTrailing(
        prev.map((r) =>
          r.key === key
            ? {
                ...r,
                name: product.name,
                committed: true,
                isCustom: false,
                productId: product.id,
                sku: product.sku,
                unitPrice: product.price,
                quantity: 1,
                maxQty: product.stockQuantity,
              }
            : r,
        ),
      ),
    );
    focusField(key, 'qty');
  };

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const updateQty = (key: string, value: number | null) => {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    let qty = Math.max(1, Math.floor(value ?? 1));
    if (row.maxQty !== undefined && qty > row.maxQty) {
      message.warning(`Only ${row.maxQty} of "${row.name}" in stock`);
      qty = row.maxQty;
    }
    updateRow(key, { quantity: qty });
  };

  const removeRow = (key: string) => setRows((prev) => withTrailing(prev.filter((r) => r.key !== key)));

  const focusNextRow = (key: string) => {
    const idx = rows.findIndex((r) => r.key === key);
    const next = rows[idx + 1];
    if (next) focusField(next.key, 'item');
  };

  /* ---------- totals / submit ---------- */

  const committedRows = rows.filter((r) => r.committed);
  const total = committedRows.reduce((sum, r) => sum + (r.unitPrice ?? 0) * r.quantity, 0);
  const itemCount = committedRows.reduce((n, r) => n + r.quantity, 0);

  const resetBill = () => {
    setRows([newRow()]);
    setCustomer(null);
    setWalkInName('');
    setCustomerSearch('');
    setSearch('');
    focusField(rows[0]?.key ?? '', 'item');
  };

  const createMutation = useMutation({
    mutationFn: () =>
      BillingService.createBill({
        customerId: customerMode === 'existing' && customer ? customer.id : undefined,
        customerName: customerMode === 'walkin' ? walkInName.trim() : undefined,
        items: committedRows.map((r) => ({
          productId: r.productId,
          name: r.productId ? undefined : r.name,
          unitPrice: r.productId ? undefined : (r.unitPrice ?? undefined),
          quantity: r.quantity,
        })),
      }),
    onSuccess: (bill) => {
      setReceipt(bill);
      setRows([newRow()]);
      setCustomer(null);
      setWalkInName('');
      setSearch('');
      // Stock changed on the server — one prefix refreshes the products page AND the billing search.
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      if (data?.detail) message.error(cleanMsg(String(data.detail)));
      else if (data && typeof data === 'object') message.error(JSON.stringify(data));
      else message.error('Failed to create bill');
      queryClient.invalidateQueries({ queryKey: ['products'] }); // stock may have changed since we loaded it
    },
  });

  const handleGenerate = () => {
    const unfinished = rows.find((r) => !r.committed && r.name.trim());
    if (unfinished) {
      message.error(`"${unfinished.name}" isn't added yet — pick a product, or press Enter to add it as a custom item`);
      focusField(unfinished.key, 'item');
      return;
    }
    const noPrice = committedRows.find((r) => r.isCustom && !(r.unitPrice && r.unitPrice > 0));
    if (noPrice) {
      message.error(`Enter a price for "${noPrice.name}"`);
      focusField(noPrice.key, 'price');
      return;
    }
    createMutation.mutate();
  };

  /* ---------- table ---------- */

  const columns: TableColumnsType<Row> = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, r, i) => (isEmptyRow(r) ? '' : i + 1),
    },
    {
      title: 'Item',
      key: 'item',
      render: (_, r) => (
        <Flex align="center" gap={8}>
          <AutoComplete
            ref={(el) => {
              refs.current[`${r.key}:item`] = el;
            }}
            style={{ flex: 1, minWidth: 220 }}
            value={r.name}
            options={itemOptions}
            filterOption={false}
            placeholder={isEmptyRow(r) ? 'Type to search or add a new item...' : undefined}
            onSearch={setSearch}
            onChange={(text) => onItemText(r.key, text)}
            onSelect={(value) => onItemSelect(r.key, value)}
          />
          {r.committed && r.isCustom && <Tag>Custom</Tag>}
          {r.committed && r.sku && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {r.sku}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: 'Price',
      key: 'price',
      align: 'right',
      width: 130,
      render: (_, r) => {
        if (!r.committed) return '';
        if (!r.isCustom) return money(r.unitPrice ?? 0);
        return (
          <InputNumber
            ref={(el) => {
              refs.current[`${r.key}:price`] = el;
            }}
            size="small"
            min={0}
            precision={2}
            placeholder="Price"
            style={{ width: 110 }}
            value={r.unitPrice}
            onChange={(v) => updateRow(r.key, { unitPrice: v })}
            onFocus={(e) => e.target.select()}
            onPressEnter={() => focusField(r.key, 'qty')}
          />
        );
      },
    },
    {
      title: 'Qty',
      key: 'qty',
      align: 'right',
      width: 120,
      render: (_, r) =>
        r.committed ? (
          <Space orientation="vertical" size={0} align="end">
            <InputNumber
              ref={(el) => {
                refs.current[`${r.key}:qty`] = el;
              }}
              size="small"
              min={1}
              max={r.maxQty}
              precision={0}
              style={{ width: 80 }}
              value={r.quantity}
              onChange={(v) => updateQty(r.key, v)}
              onFocus={(e) => e.target.select()}
              onPressEnter={() => focusNextRow(r.key)}
            />
            {r.maxQty !== undefined && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                max {r.maxQty}
              </Typography.Text>
            )}
          </Space>
        ) : (
          ''
        ),
    },
    {
      title: 'Total',
      key: 'total',
      align: 'right',
      width: 110,
      render: (_, r) => (r.committed ? money((r.unitPrice ?? 0) * r.quantity) : ''),
    },
    {
      title: '',
      key: 'remove',
      width: 50,
      render: (_, r) =>
        isEmptyRow(r) ? null : (
          <Button type="text" danger size="small" tabIndex={-1} icon={<DeleteOutlined />} onClick={() => removeRow(r.key)} />
        ),
    },
  ];

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>New Bill</Typography.Title>

      <Row gutter={[16, 16]}>
        {/* ---------- left: items ---------- */}
        <Col xs={24} lg={16}>
          <Card title="Items">
            <Table<Row>
              size="middle"
              rowKey="key"
              columns={columns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
              Type to search · Enter picks the highlighted option · a name with no match can be added as a custom item ·
              Enter in Qty jumps to the next row
            </Typography.Text>
          </Card>
        </Col>

        {/* ---------- right: customer + summary ---------- */}
        <Col xs={24} lg={8}>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Card title="Customer">
              <Segmented
                block
                value={customerMode}
                onChange={(v) => {
                  setCustomerMode(v as 'existing' | 'walkin');
                  setCustomer(null);
                  setWalkInName('');
                }}
                options={[
                  { label: 'Existing', value: 'existing' },
                  { label: 'New / Walk-in', value: 'walkin' },
                ]}
                style={{ marginBottom: 12 }}
              />

              {customerMode === 'existing' ? (
                customer ? (
                  <>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Name">{customer.name}</Descriptions.Item>
                      <Descriptions.Item label="Phone">{customer.phone}</Descriptions.Item>
                      <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Address">{customer.address || '-'}</Descriptions.Item>
                    </Descriptions>
                    <Button size="small" onClick={() => setCustomer(null)}>Change</Button>
                  </>
                ) : (
                  <Select
                    showSearch
                    value={null}
                    placeholder="Search customer by name or phone..."
                    filterOption={false}
                    onSearch={setCustomerSearch}
                    onSelect={(id) => {
                      const c = customersQuery.data?.data.find((x) => x.id === id);
                      if (c) setCustomer(c);
                    }}
                    loading={customersQuery.isFetching}
                    style={{ width: '100%' }}
                    notFoundContent="No customers found"
                    options={(customersQuery.data?.data ?? []).map((c) => ({
                      value: c.id,
                      label: `${c.name} · ${c.phone}`,
                    }))}
                  />
                )
              ) : (
                <Input
                  placeholder="Customer name (optional)"
                  value={walkInName}
                  maxLength={200}
                  onChange={(e) => setWalkInName(e.target.value)}
                />
              )}
            </Card>

            <Card title="Summary">
              <Flex justify="space-between" style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary">Items</Typography.Text>
                <Typography.Text>{itemCount}</Typography.Text>
              </Flex>
              <Flex justify="space-between" style={{ marginBottom: 16 }}>
                <Typography.Text strong style={{ fontSize: 16 }}>Total</Typography.Text>
                <Typography.Text strong style={{ fontSize: 20 }}>{money(total)}</Typography.Text>
              </Flex>
              <Button
                type="primary"
                block
                size="large"
                disabled={committedRows.length === 0}
                loading={createMutation.isPending}
                onClick={handleGenerate}
              >
                Generate Bill
              </Button>
              {committedRows.length > 0 && (
                <Button block style={{ marginTop: 8 }} onClick={resetBill}>
                  Clear
                </Button>
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <BillReceiptModal bill={receipt} onClose={() => setReceipt(null)} />
    </Space>
  );
};