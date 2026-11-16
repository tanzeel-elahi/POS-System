import { Alert, App, Form, Input, InputNumber, Modal, Divider, Spin } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProductGroupService } from '@services/productGroupService';
import { ProductService } from '@services/productService';
import { applyApiErrors } from '@/utils/formErrors';
import { getApiError } from '@/utils/apiError';
import type { Product, VariantInput } from '@/types';

interface FormValues {
  sku: string;
  qrCode?: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, string>;
}

interface Props {
  open: boolean;
  editing: Product | null; // set = edit this variant; null = add a new variant to groupId
  groupId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const routeDetail = (msg: string) => {
  if (/qr code/i.test(msg)) return 'qrCode';
  if (/sku/i.test(msg)) return 'sku';
  const m = msg.match(/Attribute '([^']+)'/i);
  if (m) return ['attributes', m[1]];
  return null;
};

const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' } as const;

export const VariantFormModal = ({ open, editing, groupId, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const isEditing = !!editing;
  const gid = editing?.group ?? groupId;

  // Key starts with 'products', so any products invalidation refreshes this too.
  const groupQuery = useQuery({
    queryKey: ['products', 'group', gid],
    queryFn: () => ProductGroupService.getGroup(gid!),
    enabled: open && !!gid,
  });
  const group = groupQuery.data;
  const attributeNames = group?.attributeNames ?? (editing ? Object.keys(editing.attributes) : []);

  const mutation = useMutation({
    mutationFn: async (v: VariantInput) => {
      if (editing) await ProductService.updateVariant(editing.id, v);
      else await ProductGroupService.addVariant(gid!, v);
    },
    onSuccess: () => {
      message.success(isEditing ? 'Variant updated' : 'Variant added');
      onSuccess();
    },
    onError: (e) => applyApiErrors(form, e, message, routeDetail),
  });

  const handleFinish = (v: FormValues) =>
    mutation.mutate({
      sku: v.sku,
      price: v.price,
      stockQuantity: v.stockQuantity,
      qrCode: v.qrCode,
      // Always the COMPLETE object, one value per attribute
      attributes: Object.fromEntries(attributeNames.map((n) => [n, (v.attributes?.[n] ?? '').trim()])),
    });

  const ready = !groupQuery.isLoading && (!!group || (isEditing && groupQuery.isError));

  return (
    <Modal
      title={isEditing ? 'Edit Variant' : 'Add Variant'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={isEditing ? 'Save' : 'Add variant'}
      okButtonProps={{ disabled: !ready || (!isEditing && groupQuery.isError) }}
      confirmLoading={mutation.isPending}
      destroyOnHidden
      width={640}
    >
      {groupQuery.isError && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={getApiError(groupQuery.error, 'Failed to load product')} />
      )}

      <Spin spinning={groupQuery.isLoading}>
        {ready && (
          <Form
            key={editing?.id ?? `new-${gid}`}
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            initialValues={{
              sku: editing?.sku ?? '',
              qrCode: editing?.qrCode ?? '',
              price: editing?.price,
              stockQuantity: editing?.stockQuantity ?? 0,
              attributes: editing?.attributes ?? {},
            }}
          >
            <div style={grid}>
              <Form.Item label="Product name">
                <Input disabled value={group?.name ?? editing?.name} />
              </Form.Item>
              <Form.Item label="Category">
                <Input disabled value={group?.categoryName ?? editing?.categoryName ?? '-'} />
              </Form.Item>
            </div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
              message="Name and category belong to the whole product. Use “Edit product” to change them."
            />

            <Divider titlePlacement="start">Attributes</Divider>
            <div style={grid}>
              {attributeNames.map((n) => (
                <Form.Item
                  key={n}
                  label={n}
                  name={['attributes', n]}
                  rules={[{ required: true, whitespace: true, message: `Enter ${n}` }]}
                >
                  <Input />
                </Form.Item>
              ))}
            </div>

            <Divider titlePlacement="start">Stock keeping</Divider>
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
          </Form>
        )}
      </Spin>
    </Modal>
  );
};