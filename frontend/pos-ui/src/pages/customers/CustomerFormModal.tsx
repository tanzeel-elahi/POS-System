import { useEffect } from 'react';
import { App, Form, Input, Modal } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { CustomerService } from '@services/customerService';
import type { Customer, CustomerPayload } from '@/types';

interface Props {
  open: boolean;
  editing: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerFormModal = ({ open, editing, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<CustomerPayload>();
  const { message } = App.useApp();
  const isEditing = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) form.setFieldsValue(editing);
    else form.resetFields();
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (values: CustomerPayload) =>
      isEditing ? CustomerService.updateCustomer(editing!.id, values) : CustomerService.createCustomer(values),
    onSuccess: () => {
      message.success(`Customer ${isEditing ? 'updated' : 'created'} successfully`);
      onSuccess();
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      if (e?.response?.status === 400 && data && typeof data === 'object') {
        const fields = Object.entries(data)
          .filter(([key]) => key !== 'detail' && key !== 'non_field_errors')
          .map(([key, errs]) => ({
            name: key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof CustomerPayload,
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
      title={isEditing ? 'Edit Customer' : 'Add Customer'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={isEditing ? 'Save' : 'Create'}
      confirmLoading={mutation.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
        <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter a name' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Phone" name="phone" rules={[{ required: true, message: 'Please enter a phone number' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Invalid email' }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Address" name="address">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};