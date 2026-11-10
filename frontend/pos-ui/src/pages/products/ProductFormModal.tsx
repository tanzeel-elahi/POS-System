import { useEffect } from 'react';
import { App, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { ProductService } from '@services/productService';
import { getApiError } from '@/utils/apiError';
import type { Product, ProductPayload } from '@/types';
import { useCategories } from './useCategories';

interface FormValues {
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  category?: string | null;
  qrCode?: string;
  size?: string;
  variant?: string;
}

interface Props {
  open: boolean;
  editing: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Business errors arrive as { detail }; route the ones we recognise to their field.
const fieldForDetail = (msg: string): keyof FormValues | null => {
  if (/price/i.test(msg)) return 'price';
  if (/category/i.test(msg)) return 'category';
  return null;
};

const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' } as const;

export const ProductFormModal = ({ open, editing, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const isEditing = !!editing;
  const categoriesQuery = useCategories(open);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        sku: editing.sku,
        price: editing.price,
        stockQuantity: editing.stockQuantity,
        category: editing.category ?? undefined,
        qrCode: editing.qrCode ?? '',
        size: editing.size,
        variant: editing.variant,
      });
    } else {
      form.resetFields();
    }
  }, [open, editing, form]);

  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  // A deactivated category isn't listed, but the product keeps it — keep showing its name.
  if (editing?.category && !categoryOptions.some((o) => o.value === editing.category)) {
    categoryOptions.push({ value: editing.category, label: editing.categoryName ?? `Category #${editing.category}` });
  }

  const mutation = useMutation({
    mutationFn: (values: ProductPayload) =>
      isEditing ? ProductService.updateProduct(editing!.id, values) : ProductService.createProduct(values),
    onSuccess: () => {
      message.success(`Product ${isEditing ? 'updated' : 'created'} successfully`);
      onSuccess();
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      if (e?.response?.status === 400 && data && typeof data === 'object') {
        const fields: { name: keyof FormValues; errors: string[] }[] = Object.entries(data)
          .filter(([key]) => key !== 'detail' && key !== 'non_field_errors')
          .map(([key, errs]) => ({
            name: camel(key) as keyof FormValues,
            errors: ([] as string[]).concat(errs as any),
          }));

        if (data.detail || data.non_field_errors) {
          const msg = getApiError(e);
          const target = fieldForDetail(msg);
          if (target) fields.push({ name: target, errors: [msg] });
          else message.error(msg);
        }
        form.setFields(fields);
      } else {
        message.error(getApiError(e, 'Something went wrong'));
      }
    },
  });

  const handleFinish = (v: FormValues) =>
    mutation.mutate({
      name: v.name,
      sku: v.sku,
      price: v.price,
      stockQuantity: v.stockQuantity,
      category: v.category ?? null,
      qrCode: v.qrCode,
      size: v.size,
      variant: v.variant,
    });

  return (
    <Modal
      title={isEditing ? 'Edit Product' : 'Add Product'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={isEditing ? 'Save' : 'Create'}
      confirmLoading={mutation.isPending}
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical" initialValues={{ stockQuantity: 0 }} onFinish={handleFinish}>
        <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true, message: 'Please enter a name' }]}>
          <Input />
        </Form.Item>

        <div style={grid}>
          <Form.Item label="SKU" name="sku" rules={[{ required: true, whitespace: true, message: 'Please enter a SKU' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="QR code" name="qrCode">
            <Input maxLength={100} />
          </Form.Item>

          <Form.Item label="Category" name="category">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="No category"
              loading={categoriesQuery.isLoading}
              options={categoryOptions}
            />
          </Form.Item>
          <div />

          <Form.Item label="Size" name="size">
            <Input maxLength={50} placeholder="e.g. M" />
          </Form.Item>
          <Form.Item label="Variant" name="variant">
            <Input maxLength={100} placeholder="e.g. Red" />
          </Form.Item>

          <Form.Item label="Price" name="price" rules={[{ required: true, message: 'Please enter a price' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Stock quantity" name="stockQuantity" rules={[{ required: true, message: 'Please enter stock' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};