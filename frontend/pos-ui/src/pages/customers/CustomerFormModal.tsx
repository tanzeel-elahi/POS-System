import { useEffect, useState } from 'react';
import { Alert, App, Divider, Form, Input, InputNumber, Modal, Select, Spin } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CustomerService } from '@services/customerService';
import { useDebounce } from '@/utils/useDebounce';
import { getApiError } from '@/utils/apiError';
import type { Customer, CustomerPayload } from '@/types';
import {cnicDigits, formatCnic } from '@/utils/format';

interface FormValues {
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  occupation?: string;
  employer?: string;
  monthlySalary?: number | null;
  creditLimit?: number | null;
  cnic?: string;
  notes?: string;
  manager?: { value: string; label: string } | null;
}

interface Props {
  open: boolean;
  editing: Customer | null; // basic record from the list
  onClose: () => void;
  onSuccess: () => void;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Business errors arrive as { detail }; route the ones we recognise to the field they belong to.
const fieldForDetail = (msg: string): keyof FormValues | null => {
  if (/cnic/i.test(msg)) return 'cnic';
  if (/phone/i.test(msg)) return 'phone';
  if (/manager/i.test(msg)) return 'manager';
  return null;
};

const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' } as const;

export const CustomerFormModal = ({ open, editing, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const isEditing = !!editing;

  /* ---------- load the full record when editing (list rows don't carry the new fields) ---------- */

  const detailQuery = useQuery({
    queryKey: ['customers', 'detail', editing?.id],
    queryFn: () => CustomerService.getCustomer(editing!.id),
    enabled: open && isEditing,
    gcTime: 0, // sensitive fields: drop from the cache as soon as nothing is using them
  });

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      form.resetFields();
      return;
    }
    const d = detailQuery.data;
    if (!d) return;
    form.setFieldsValue({
      name: d.name,
      phone: d.phone,
      alternatePhone: d.alternatePhone,
      email: d.email ?? '',
      address: d.address ?? '',
      city: d.city ?? '',
      occupation: d.occupation,
      employer: d.employer,
      monthlySalary: d.monthlySalary,
      creditLimit: d.creditLimit,
      cnic: formatCnic(d.cnic),
      notes: d.notes,
      manager: d.manager ? { value: d.manager, label: d.managerName ?? `Customer #${d.manager}` } : undefined,
    });
  }, [open, editing, detailQuery.data, form]);

  /* ---------- manager picker (remote search) ---------- */

  const [mgrSearch, setMgrSearch] = useState('');
  const debouncedMgr = useDebounce(mgrSearch.trim(), 250);
  const mgrQuery = useQuery({
    queryKey: ['customers', 'manager-search', debouncedMgr],
    queryFn: () => CustomerService.getCustomers({ search: debouncedMgr || undefined, take: 8 }),
    enabled: open,
  });
  const managerOptions = (mgrQuery.data?.data ?? [])
    .filter((c) => c.id !== editing?.id) // a customer can't manage themselves
    .map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }));

  /* ---------- save ---------- */

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
      phone: v.phone,
      alternatePhone: v.alternatePhone,
      email: v.email,
      address: v.address,
      city: v.city,
      occupation: v.occupation,
      employer: v.employer,
      notes: v.notes,
      monthlySalary: v.monthlySalary,
      creditLimit: v.creditLimit,
      cnic: v.cnic,
      manager: v.manager?.value ?? null,
    });

  const loadingDetail = isEditing && detailQuery.isLoading;

  return (
    <Modal
      title={isEditing ? 'Edit Customer' : 'Add Customer'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={isEditing ? 'Save' : 'Create'}
      okButtonProps={{ disabled: loadingDetail || (isEditing && detailQuery.isError) }}
      confirmLoading={mutation.isPending}
      destroyOnHidden
      width={720}
    >
      {isEditing && detailQuery.isError && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={getApiError(detailQuery.error, 'Failed to load customer')} />
      )}

      <Spin spinning={loadingDetail}>
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Divider titlePlacement="start" style={{ marginTop: 0 }}>Contact</Divider>
          <div style={grid}>
            <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true, message: 'Please enter a name' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Phone" name="phone" rules={[{ required: true, whitespace: true, message: 'Please enter a phone number' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Alternate phone" name="alternatePhone">
              <Input />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Invalid email' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="City" name="city">
              <Input />
            </Form.Item>
            <Form.Item label="Address" name="address">
              <Input />
            </Form.Item>
          </div>

          <Divider titlePlacement="start">Work &amp; finance</Divider>
          <div style={grid}>
            <Form.Item label="Occupation" name="occupation">
              <Input />
            </Form.Item>
            <Form.Item label="Employer" name="employer">
              <Input />
            </Form.Item>
            <Form.Item label="Monthly salary" name="monthlySalary">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Credit limit" name="creditLimit">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="CNIC"
              name="cnic"
              extra="With or without dashes: 35202-1234567-1"
              rules={[
                {
                  validator: (_, v) =>
                    !v || cnicDigits(v).length === 13 ? Promise.resolve() : Promise.reject(new Error('CNIC must be exactly 13 digits')),
                },
              ]}
            >
              <Input maxLength={15} placeholder="35202-1234567-1" />
            </Form.Item>
            <Form.Item label="Manager" name="manager">
              <Select
                labelInValue
                showSearch
                allowClear
                filterOption={false}
                placeholder="Search customer by name or phone"
                onSearch={setMgrSearch}
                loading={mgrQuery.isFetching}
                options={managerOptions}
                notFoundContent="No customers found"
              />
            </Form.Item>
          </div>

          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
};