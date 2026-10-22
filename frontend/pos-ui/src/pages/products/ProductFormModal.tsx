import { useEffect } from 'react';
import { App, Form, Input, InputNumber, Modal } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { ProductService } from '@services/productService';
import type { Product, ProductPayload } from '@/types';

interface Props {
  open: boolean;
  editing: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductFormModal = ({ open, editing, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<ProductPayload>();
  const { message } = App.useApp();
  const isEditing = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) form.setFieldsValue(editing);
    else form.resetFields();
  }, [open, editing, form]);

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
        const fields = Object.entries(data)
          .filter(([key]) => key !== 'detail' && key !== 'non_field_errors')
          .map(([key, errs]) => ({
            name: key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof ProductPayload,
            errors: ([] as string[]).concat(errs as any),
          }));
        form.setFields(fields);

        const general = data.detail ?? data.non_field_errors;
        if (general) message.error(String(general));
      } else {
        message.error('Something went wrong');
      }
    },
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
    >
      <Form form={form} layout="vertical" initialValues={{ price: 0, stockQuantity: 0 }} onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter a name' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="SKU" name="sku" rules={[{ required: true, message: 'Please enter a SKU' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Price" name="price" rules={[{ required: true, message: 'Please enter a price' }]}>
          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Stock Quantity" name="stockQuantity" rules={[{ required: true, message: 'Please enter stock' }]}>
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};