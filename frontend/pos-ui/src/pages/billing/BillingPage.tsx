import { useEffect, useRef, useState } from 'react';
import { Alert, App, AutoComplete, Button, Card, Col, Descriptions, Flex, Input, InputNumber, Row, Segmented, Space, Table, Tag, Typography, Upload } from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, LoadingOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProductService } from '@services/productService';
import { CustomerService } from '@services/customerService';
import { BillingService } from '@services/billingService';
import { CreditService } from '@services/creditService';
import { useDebounce } from '@/utils/useDebounce';
import { getApiError } from '@/utils/apiError';
import type { Bill, Customer, PaymentMode } from '@/types';
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

const MIN_PHONE_DIGITS = 7; // customer lookup starts at this many digits — adjust to your numbering
const MAX_PROOF_MB = 5;

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

export const BillingPage = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState<Bill | null>(null);

  // customer + payment
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState(''); // new customer (required) or walk-in (optional)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFailure, setProofFailure] = useState<{ billId: string; file: File } | null>(null);
  const [retrying, setRetrying] = useState(false);

  /* ---------- focus management ---------- */

  const refs = useRef<Record<string, Focusable>>({});
  const pendingFocus = useRef<string | null>(null);
  const focusField = (rowKey: string, field: 'item' | 'price' | 'qty') => {
    pendingFocus.current = `${rowKey}:${field}`;
  };
  useEffect(() => {
    if (pendingFocus.current) {
      refs.current[pendingFocus.current]?.focus();
      pendingFocus.current = null;
    }
  });

  /* ---------- product search ---------- */

  const q = search.trim();
  const debouncedQ = useDebounce(q, 200);

  const productsQuery = useQuery({
    queryKey: ['products', 'billing-search', debouncedQ],
    queryFn: () => ProductService.getProducts({ search: debouncedQ, take: 8 }),
    enabled: debouncedQ.length > 0,
  });

  const products = productsQuery.data?.data ?? [];
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

  /* ---------- customer lookup by phone ---------- */

  const phoneTrim = phone.trim();
  const phoneDigits = phoneTrim.replace(/\D/g, '');
  const debouncedPhone = useDebounce(phoneTrim, 500);
  const lookupEnabled = debouncedPhone.replace(/\D/g, '').length >= MIN_PHONE_DIGITS;

  const lookupQuery = useQuery({
    queryKey: ['customers', 'lookup', debouncedPhone],
    queryFn: () => CustomerService.lookupByPhone(debouncedPhone),
    enabled: lookupEnabled,
  });

  // The lookup result only counts once it matches what is currently typed.
  const lookupSettled = lookupEnabled && phoneTrim === debouncedPhone && !lookupQuery.isFetching && lookupQuery.data !== undefined;
  const foundCustomer: Customer | null = lookupSettled ? (lookupQuery.data ?? null) : null;
  const isNewCustomer = lookupSettled && lookupQuery.data === null;
  const lookupBusy = phoneDigits.length >= MIN_PHONE_DIGITS && !lookupSettled;

  const creditQuery = useQuery({
    queryKey: ['customers', foundCustomer?.id, 'credit'],
    queryFn: () => CreditService.getCredit(foundCustomer!.id),
    enabled: !!foundCustomer,
  });
  const balance = creditQuery.data?.balance ?? 0;


  /* ---------- phone / name suggestions (partial search) ---------- */

  // If the text looks like a phone number, strip spaces/dashes the same way the server does when storing.
  const suggestTerm = /^[\d\s+\-()]+$/.test(phoneTrim) ? phoneTrim.replace(/[\s\-()]/g, '') : phoneTrim;
  const debouncedSuggest = useDebounce(suggestTerm, 250);

  const suggestQuery = useQuery({
    queryKey: ['customers', 'billing-search', debouncedSuggest],
    queryFn: () => CustomerService.getCustomers({ search: debouncedSuggest, take: 8 }),
    enabled: debouncedSuggest.length >= 2 && !foundCustomer,
  });

  // Hide suggestions while the search catches up with typing, and once an exact customer is found.
  const suggestPending = suggestTerm !== debouncedSuggest || suggestQuery.isFetching;
  const customerOptions =
    foundCustomer || suggestPending || suggestTerm.length < 2
      ? []
      : (suggestQuery.data?.data ?? []).map((c) => ({
        value: c.phone, // selecting fills the phone field, and the exact lookup then runs
        label: (
          <Flex justify="space-between" gap={12}>
            <span>{c.name}</span>
            <Typography.Text type="secondary">{c.phone}</Typography.Text>
          </Flex>
        ),
      }));
  /* ---------- row actions ---------- */

  const onItemText = (key: string, text: string) => {
    if (text.startsWith('\u200B')) return; // echo of an option value after selecting — ignore
    setRows((prev) =>
      withTrailing(
        prev.map((r) => {
          if (r.key !== key) return r;
          if (r.committed && r.name === text) return r;
          return { ...r, name: text, committed: false, isCustom: false, productId: undefined, sku: undefined, unitPrice: null, maxQty: undefined };
        }),
      ),
    );
  };

  const onItemSelect = (key: string, value: string) => {
    const current = rows.find((r) => r.key === key);
    if (!current) return;

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

    const product = products.find((p) => p.id === value.slice(PRODUCT_PREFIX.length));
    if (!product) return;
    if (product.stockQuantity <= 0) {
      message.warning(`"${product.name}" is out of stock`);
      return;
    }

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

  /* ---------- totals ---------- */

  const committedRows = rows.filter((r) => r.committed);
  const total = committedRows.reduce((sum, r) => sum + (r.unitPrice ?? 0) * r.quantity, 0);
  const itemCount = committedRows.reduce((n, r) => n + r.quantity, 0);

  const resetBill = () => {
    setRows([newRow()]);
    setSearch('');
    setPhone('');
    setCustomerName('');
    setPaymentMode('cash');
    setProofFile(null);
  };

  /* ---------- submit ---------- */

  const createMutation = useMutation({
    mutationFn: async () => {
      const bill = await BillingService.createBill({
        customerPhone: phoneTrim || undefined,
        // existing customers keep their stored name; send a name only for new customers / walk-ins
        customerName: foundCustomer ? undefined : customerName.trim() || undefined,
        paymentMode,
        items: committedRows.map((r) => ({
          productId: r.productId,
          name: r.productId ? undefined : r.name,
          unitPrice: r.productId ? undefined : (r.unitPrice ?? undefined),
          quantity: r.quantity,
        })),
      });

      // Step 2: the bill exists now. A failed upload must NOT look like a failed bill.
      let finalBill = bill;
      let proofFailed = false;
      if (paymentMode === 'online' && proofFile) {
        try {
          finalBill = await BillingService.uploadPaymentProof(bill.id, proofFile);
        } catch {
          proofFailed = true;
        }
      }
      return { bill: finalBill, proofFailed, file: proofFile };
    },
    onSuccess: ({ bill, proofFailed, file }) => {
      setReceipt(bill);
      setProofFailure(proofFailed && file ? { billId: bill.id, file } : null);
      resetBill();
      // Stock, customers (new customer / credit balance / history) all changed.
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: any) => {
      message.error(getApiError(e, 'Failed to create bill'));
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
    if (paymentMode === 'credit' && !phoneTrim) {
      message.error('Credit bills need a customer phone number');
      return;
    }
    if (phoneTrim) {
      if (phoneDigits.length < MIN_PHONE_DIGITS) {
        message.warning('Enter the full phone number');
        return;
      }
      if (!lookupSettled) {
        message.warning('Wait for the customer lookup to finish');
        return;
      }
      if (isNewCustomer && !customerName.trim()) {
        message.error("Enter the new customer's name");
        return;
      }
    }
    // PLACEHOLDER rule — the API doc left "credit bills with a total of 0" undecided. Remove once decided.
    if (paymentMode === 'credit' && total <= 0) {
      message.error('A credit bill must have a total above 0');
      return;
    }
    createMutation.mutate();
  };

  const handleRetryProof = async () => {
    if (!proofFailure) return;
    setRetrying(true);
    try {
      const updated = await BillingService.uploadPaymentProof(proofFailure.billId, proofFailure.file);
      setReceipt(updated);
      setProofFailure(null);
      message.success('Proof uploaded');
    } catch (e) {
      message.error(getApiError(e, 'Upload failed again'));
    } finally {
      setRetrying(false);
    }
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

        {/* ---------- right: customer + payment + summary ---------- */}
        <Col xs={24} lg={8}>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Card title="Customer">
              <AutoComplete
                style={{ width: '100%' }}
                value={phone}
                options={customerOptions}
                filterOption={false}
                defaultActiveFirstOption={false}
                onChange={(text) => setPhone(text)}
                onSelect={(value) => setPhone(value)}
              >
                <Input
                  allowClear
                  maxLength={20}
                  placeholder="Phone or name (leave empty for walk-in)"
                  suffix={lookupBusy ? <LoadingOutlined /> : undefined}
                />
              </AutoComplete>

              <div style={{ marginTop: 12 }}>
                {!phoneTrim && (
                  <Input
                    placeholder="Customer name (optional, walk-in)"
                    value={customerName}
                    maxLength={200}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                )}

                {phoneTrim && phoneDigits.length < MIN_PHONE_DIGITS && (
                  <Typography.Text type="secondary">Pick a suggestion, or enter the full phone number.</Typography.Text>
                )}

                {foundCustomer && (
                  <>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="Name">{foundCustomer.name}</Descriptions.Item>
                      <Descriptions.Item label="Phone">{foundCustomer.phone}</Descriptions.Item>
                      <Descriptions.Item label="Email">{foundCustomer.email || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Address">{foundCustomer.address || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Credit">
                        {creditQuery.isLoading ? (
                          <LoadingOutlined />
                        ) : balance > 0 ? (
                          <Tag color="red">Owes {money(balance)}</Tag>
                        ) : (
                          <Tag color="green">No balance</Tag>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                    {paymentMode === 'credit' && total > 0 && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Balance after this bill: {money(balance + total)}
                      </Typography.Text>
                    )}
                  </>
                )}

                {isNewCustomer && (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 8 }}
                      message="New customer — they'll be created with this bill"
                    />
                    <Input
                      placeholder="Customer name (required)"
                      value={customerName}
                      maxLength={200}
                      status={!customerName.trim() ? 'warning' : undefined}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </>
                )}
              </div>
            </Card>

            <Card title="Payment">
              <Segmented
                block
                value={paymentMode}
                onChange={(v) => {
                  setPaymentMode(v as PaymentMode);
                  if (v !== 'online') setProofFile(null);
                }}
                options={[
                  { label: 'Cash', value: 'cash' },
                  { label: 'Credit', value: 'credit' },
                  { label: 'Online', value: 'online' },
                ]}
              />

              {paymentMode === 'credit' && !phoneTrim && (
                <Alert type="warning" showIcon style={{ marginTop: 12 }} message="Credit needs a customer phone number" />
              )}

              {paymentMode === 'online' && (
                <div style={{ marginTop: 12 }}>
                  <Upload
                    accept="image/*"
                    maxCount={1}
                    fileList={proofFile ? [{ uid: '-1', name: proofFile.name, status: 'done' as const }] : []}
                    beforeUpload={(file) => {
                      if (!file.type.startsWith('image/')) {
                        message.error('Please choose an image file');
                        return Upload.LIST_IGNORE;
                      }
                      if (file.size > MAX_PROOF_MB * 1024 * 1024) {
                        message.error(`Image must be under ${MAX_PROOF_MB} MB`);
                        return Upload.LIST_IGNORE;
                      }
                      setProofFile(file);
                      return false; // keep it local; we upload after the bill is created
                    }}
                    onRemove={() => setProofFile(null)}
                  >
                    <Button icon={<UploadOutlined />}>Payment proof (optional)</Button>
                  </Upload>
                </div>
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
              {(committedRows.length > 0 || phoneTrim) && (
                <Button block style={{ marginTop: 8 }} onClick={resetBill}>
                  Clear
                </Button>
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <BillReceiptModal
        bill={receipt}
        proofFailed={!!proofFailure}
        retrying={retrying}
        onRetryProof={handleRetryProof}
        onClose={() => {
          setReceipt(null);
          setProofFailure(null);
        }}
      />
    </Space>
  );
};