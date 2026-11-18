import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Divider, Flex, Form, Input, InputNumber, Modal, Select, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { AppstoreAddOutlined, DeleteOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { ProductService } from '@services/productService';
import { ProductGroupService } from '@services/productGroupService';
import { applyApiErrors } from '@/utils/formErrors';
import { getApiError } from '@/utils/apiError';
import type { ProductGroupCreatePayload, ProductPayload } from '@/types';
import { useCategories } from './useCategories';
import { CategorySelect } from './CategorySelect';

interface FormValues {
  name: string;
  category?: string | null;
  description?: string; // variants mode only
  sku?: string; // simple mode only
  qrCode?: string; // simple mode only
  price?: number; // simple mode only
  stockQuantity?: number; // simple mode only
}

interface AttrDef {
  id: string; // stable id, so renaming an attribute doesn't lose row values
  name: string;
  values: string[];
}

interface VariantRow {
  key: string;
  attrs: Record<string, string>; // keyed by AttrDef.id
  sku: string;
  price: number | null;
  stock: number;
  qrCode: string;
}

type Submit =
  | { mode: 'simple'; data: ProductPayload }
  | { mode: 'group'; data: ProductGroupCreatePayload };

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_ATTRS = 10;
const MAX_COMBOS = 200;

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;
const newAttr = (): AttrDef => ({ id: uid('a'), name: '', values: [] });
const newRow = (attrs: Record<string, string> = {}): VariantRow => ({ key: uid('v'), attrs, sku: '', price: null, stock: 0, qrCode: '' });
const norm = (s: string) => s.trim().toLowerCase();
const dedupe = (vals: string[]) => {
  const seen = new Set<string>();
  return vals.filter((v) => {
    const k = norm(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const routeDetailSimple = (msg: string) => {
  if (/price/i.test(msg)) return 'price';
  if (/qr code/i.test(msg)) return 'qrCode';
  if (/sku/i.test(msg)) return 'sku';
  if (/category/i.test(msg)) return 'category';
  return null;
};

const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' } as const;

export const ProductCreateModal = ({ open, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<FormValues>();
  const { message, modal } = App.useApp();

  const [variantMode, setVariantMode] = useState(false);
  const [attrs, setAttrs] = useState<AttrDef[]>([newAttr()]);
  const [rows, setRows] = useState<VariantRow[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setVariantMode(false);
    setAttrs([newAttr()]);
    setRows([]);
  }, [open, form]);

  /* ---------- simple <-> variants switch ---------- */

  const hasVariantContent = rows.length > 0 || attrs.some((a) => a.name.trim() || a.values.length > 0);

  const startVariants = () => setVariantMode(true);

  const stopVariants = () => {
    const discard = () => {
      setVariantMode(false);
      setAttrs([newAttr()]);
      setRows([]);
    };
    if (!hasVariantContent) return discard();
    modal.confirm({
      title: 'Remove variants?',
      content: 'The attributes and variant rows you entered will be discarded, and this becomes a simple product.',
      okText: 'Remove variants',
      okButtonProps: { danger: true },
      onOk: discard,
    });
  };

  /* ---------- attributes ---------- */

  const updateAttr = (id: string, patch: Partial<AttrDef>) =>
    setAttrs((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addAttr = () => {
    if (attrs.length >= MAX_ATTRS) {
      message.warning(`A product can have at most ${MAX_ATTRS} attributes`);
      return;
    }
    setAttrs((prev) => [...prev, newAttr()]);
  };

  const removeAttr = (id: string) => {
    setAttrs((prev) => prev.filter((a) => a.id !== id));
    setRows((prev) =>
      prev.map((r) => {
        const next = { ...r.attrs };
        delete next[id];
        return { ...r, attrs: next };
      }),
    );
  };

  /* ---------- variant rows ---------- */

  const updateRow = (key: string, patch: Partial<VariantRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const generate = () => {
    const clean = attrs.map((a) => ({ ...a, name: a.name.trim(), values: dedupe(a.values.map((v) => v.trim()).filter(Boolean)) }));
    const bad = clean.find((a) => !a.name || a.values.length === 0);
    if (bad) {
      message.warning(bad.name ? `Add at least one value for "${bad.name}"` : 'Give every attribute a name and at least one value');
      return;
    }

    const combos = clean.reduce<Record<string, string>[]>(
      (acc, a) => acc.flatMap((c) => a.values.map((v) => ({ ...c, [a.id]: v }))),
      [{}],
    );
    if (combos.length > MAX_COMBOS) {
      message.error(`That would create ${combos.length} variants. Reduce the values (max ${MAX_COMBOS}).`);
      return;
    }

    // Keep what was already typed for combinations that still exist
    const sig = (m: Record<string, string>) => clean.map((a) => norm(m[a.id] ?? '')).join('|');
    const existing = new Map(rows.map((r) => [sig(r.attrs), r]));
    setRows(combos.map((c) => existing.get(sig(c)) ?? newRow(c)));
    message.success(`${combos.length} variants ready. Fill in SKU, price and stock.`);
  };

  /* ---------- submit ---------- */

  // { variants: [{ price: [...] }, {}] } — one entry per variant, plus { detail } messages
  const showGroupErrors = (e: any) => {
    const data = e?.response?.data;
    if (e?.response?.status !== 400 || !data || typeof data !== 'object') {
      message.error(getApiError(e, 'Failed to create product'));
      return;
    }
    const parts: string[] = [];
    if (Array.isArray(data.variants)) {
      data.variants.forEach((ve: unknown, i: number) => {
        if (typeof ve === 'string') parts.push(ve);
        else if (ve && typeof ve === 'object') {
          Object.entries(ve).forEach(([field, errs]) =>
            parts.push(`Variant ${i + 1}, ${field.replace(/_/g, ' ')}: ${([] as string[]).concat(errs as string[]).join(' ')}`),
          );
        }
      });
    }
    if (data.detail) parts.push(getApiError(e));

    const fields = (['name', 'description', 'category'] as const)
      .filter((k) => Array.isArray(data[k]))
      .map((k) => ({ name: k, errors: data[k] as string[] }));
    if (fields.length) form.setFields(fields);

    if (parts.length) message.error({ content: parts.join(' · '), duration: 8 });
    else if (!fields.length) message.error(getApiError(e, 'Failed to create product'));
  };

  const mutation = useMutation({
    mutationFn: async (s: Submit) => {
      if (s.mode === 'simple') await ProductService.createProduct(s.data);
      else await ProductGroupService.createGroup(s.data);
    },
    onSuccess: (_d, s) => {
      message.success(s.mode === 'group' ? 'Product created with its variants' : 'Product created successfully');
      onSuccess();
    },
    onError: (e, s) => (s.mode === 'simple' ? applyApiErrors(form, e, message, routeDetailSimple) : showGroupErrors(e)),
  });

  const fail = (msg: string): null => {
    message.error(msg);
    return null;
  };

  const buildGroupPayload = (v: FormValues): ProductGroupCreatePayload | null => {
    const names = attrs.map((a) => a.name.trim());
    if (names.some((n) => !n)) return fail('Attribute names cannot be empty');
    const seenNames = new Set<string>();
    for (const n of names) {
      if (seenNames.has(norm(n))) return fail(`Duplicate attribute name "${n}" (names are not case-sensitive)`);
      seenNames.add(norm(n));
    }
    if (rows.length === 0) return fail('Add at least one variant. Use "Generate variants" or "Add blank variant", or remove variants to make a simple product.');

    const combos = new Set<string>();
    const skus = new Set<string>();
    const qrs = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const n = i + 1;
      for (const a of attrs) {
        if (!(r.attrs[a.id] ?? '').trim()) return fail(`Variant ${n}: enter a value for "${a.name.trim()}"`);
      }
      const combo = attrs.map((a) => norm(r.attrs[a.id])).join('|');
      if (combos.has(combo)) return fail(`Variant ${n} repeats an earlier combination`);
      combos.add(combo);

      if (!r.sku.trim()) return fail(`Variant ${n}: enter a SKU`);
      if (skus.has(norm(r.sku))) return fail(`Variant ${n}: SKU "${r.sku.trim()}" is used twice`);
      skus.add(norm(r.sku));

      if (!r.price || r.price <= 0) return fail(`Variant ${n}: price must be above 0`);

      const qr = r.qrCode.trim();
      if (qr) {
        if (qrs.has(norm(qr))) return fail(`Variant ${n}: QR code "${qr}" is used twice`);
        qrs.add(norm(qr));
      }
    }

    return {
      name: v.name.trim(),
      description: v.description?.trim() ?? '',
      category: v.category ?? null,
      attributeNames: names,
      variants: rows.map((r) => ({
        sku: r.sku,
        price: r.price as number,
        stockQuantity: r.stock,
        qrCode: r.qrCode,
        attributes: Object.fromEntries(attrs.map((a) => [a.name.trim(), r.attrs[a.id].trim()])),
      })),
    };
  };

  const handleFinish = (v: FormValues) => {
    if (!variantMode) {
      mutation.mutate({
        mode: 'simple',
        data: {
          name: v.name,
          sku: v.sku ?? '',
          price: v.price ?? 0,
          stockQuantity: v.stockQuantity ?? 0,
          category: v.category ?? null,
          qrCode: v.qrCode,
        },
      });
      return;
    }
    const payload = buildGroupPayload(v);
    if (payload) mutation.mutate({ mode: 'group', data: payload });
  };

  /* ---------- variant table ---------- */

  const columns: TableColumnsType<VariantRow> = [
    ...attrs.map(
      (a): TableColumnsType<VariantRow>[number] => ({
        title: a.name.trim() || 'Attribute',
        key: a.id,
        width: 140,
        render: (_, r) => (
          <Input
            size="small"
            value={r.attrs[a.id] ?? ''}
            onChange={(e) => updateRow(r.key, { attrs: { ...r.attrs, [a.id]: e.target.value } })}
          />
        ),
      }),
    ),
    {
      title: 'SKU',
      key: 'sku',
      width: 170,
      render: (_, r) => <Input size="small" value={r.sku} onChange={(e) => updateRow(r.key, { sku: e.target.value })} />,
    },
    {
      title: 'Price',
      key: 'price',
      width: 120,
      render: (_, r) => (
        <InputNumber size="small" min={0.01} precision={2} style={{ width: '100%' }} value={r.price} onChange={(v) => updateRow(r.key, { price: v })} />
      ),
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 100,
      render: (_, r) => (
        <InputNumber size="small" min={0} precision={0} style={{ width: '100%' }} value={r.stock} onChange={(v) => updateRow(r.key, { stock: v ?? 0 })} />
      ),
    },
    {
      title: 'QR code (optional)',
      key: 'qr',
      width: 170,
      render: (_, r) => <Input size="small" maxLength={100} value={r.qrCode} onChange={(e) => updateRow(r.key, { qrCode: e.target.value })} />,
    },
    {
      title: '',
      key: 'remove',
      width: 50,
      render: (_, r) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} />
      ),
    },
  ];

  return (
    <Modal
      title="Add Product"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={variantMode ? 'Create product with variants' : 'Create product'}
      confirmLoading={mutation.isPending}
      destroyOnHidden
      width={variantMode ? 1100 : 640}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      <Form form={form} layout="vertical" initialValues={{ stockQuantity: 0 }} onFinish={handleFinish}>
        <div style={grid}>
          <Form.Item label="Product name" name="name" rules={[{ required: true, whitespace: true, message: 'Please enter a name' }]}>
            <Input placeholder="e.g. Water Bottle" />
          </Form.Item>
          <Form.Item label="Category" name="category">
              <CategorySelect />
            </Form.Item>
        </div>

        {variantMode ? (
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
        ) : (
          // Fields are only mounted in simple mode, so they are only validated in simple mode.
          <div style={grid}>
            <Form.Item label="SKU" name="sku" rules={[{ required: true, whitespace: true, message: 'Please enter a SKU' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="QR code" name="qrCode" extra="Optional. Empty means the SKU is used when scanning.">
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item label="Price" name="price" rules={[{ required: true, message: 'Please enter a price' }]}>
              <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Stock quantity" name="stockQuantity" rules={[{ required: true, message: 'Please enter stock' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        )}
      </Form>

      {!variantMode ? (
        <Card size="small" style={{ borderStyle: 'dashed' }}>
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <Typography.Text type="secondary">Comes in different sizes, colours or other options?</Typography.Text>
            <Button icon={<AppstoreAddOutlined />} onClick={startVariants}>
              Add variants
            </Button>
          </Flex>
        </Card>
      ) : (
        <>
          <Divider titlePlacement="start">Attributes</Divider>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Attribute names can't be changed after the product is created." />
          {attrs.map((a) => (
            <Flex key={a.id} gap={8} style={{ marginBottom: 8 }}>
              <Input
                style={{ width: 200 }}
                placeholder="Name, e.g. Size"
                maxLength={50}
                value={a.name}
                onChange={(e) => updateAttr(a.id, { name: e.target.value })}
              />
              <Select
                mode="tags"
                open={false}
                suffixIcon={null}
                style={{ flex: 1 }}
                tokenSeparators={[',']}
                placeholder="Type a value and press Enter, e.g. 800ml"
                value={a.values}
                onChange={(vals: string[]) => updateAttr(a.id, { values: vals })}
              />
              <Button danger type="text" icon={<DeleteOutlined />} disabled={attrs.length === 1} onClick={() => removeAttr(a.id)} />
            </Flex>
          ))}
          <Button icon={<PlusOutlined />} onClick={addAttr} disabled={attrs.length >= MAX_ATTRS}>
            Add attribute
          </Button>

          <Divider titlePlacement="start">Variants</Divider>
          <Flex gap={8} wrap="wrap" align="center" style={{ marginBottom: 12 }}>
            <Button type="primary" ghost icon={<ThunderboltOutlined />} onClick={generate}>
              Generate variants from values
            </Button>
            <Button icon={<PlusOutlined />} onClick={() => setRows((prev) => [...prev, newRow()])}>
              Add blank variant
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Regenerating keeps the SKU, price and stock you already typed for combinations that still exist.
            </Typography.Text>
          </Flex>

          <Table<VariantRow>
            size="small"
            rowKey="key"
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'No variants yet' }}
          />

          <Button type="link" danger style={{ marginTop: 12, paddingLeft: 0 }} onClick={stopVariants}>
            Remove variants (make this a simple product)
          </Button>
        </>
      )}
    </Modal>
  );
};