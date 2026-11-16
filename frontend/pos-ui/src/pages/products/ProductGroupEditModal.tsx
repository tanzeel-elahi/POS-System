import { Alert, App, Descriptions, Form, Input, Modal, Select, Spin, Tag } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProductGroupService } from '@services/productGroupService';
import { applyApiErrors } from '@/utils/formErrors';
import { getApiError } from '@/utils/apiError';
import { useCategories } from './useCategories';

interface FormValues {
  name: string;
  description?: string;
  category?: string | null;
}

interface Props {
  groupId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const routeDetail = (msg: string) => (/category/i.test(msg) ? 'category' : /name/i.test(msg) ? 'name' : null);

export const ProductGroupEditModal = ({ groupId, onClose, onSuccess }: Props) => {
  const [form] = Form.useForm<FormValues>();
  const { message } = App.useApp();
  const open = !!groupId;
  const categoriesQuery = useCategories(open);

  const groupQuery = useQuery({
    queryKey: ['products', 'group', groupId],
    queryFn: () => ProductGroupService.getGroup(groupId!),
    enabled: open,
  });
  const group = groupQuery.data;

  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  // A deactivated category isn't listed, but the product keeps it — keep showing its name.
  if (group?.category && !categoryOptions.some((o) => o.value === group.category)) {
    categoryOptions.push({ value: group.category, label: group.categoryName ?? `Category #${group.category}` });
  }

  const mutation = useMutation({
    mutationFn: (v: FormValues) => ProductGroupService.updateGroup(groupId!, v),
    onSuccess: () => {
      message.success('Product updated for all its variants');
      onSuccess();
    },
    onError: (e) => applyApiErrors(form, e, message, routeDetail),
  });

  return (
    <Modal
      title="Edit Product"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save"
      okButtonProps={{ disabled: !group }}
      confirmLoading={mutation.isPending}
      destroyOnHidden
    >
      {groupQuery.isError && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={getApiError(groupQuery.error, 'Failed to load product')} />
      )}

      <Spin spinning={groupQuery.isLoading}>
        {group && (
          <Form
            key={group.id}
            form={form}
            layout="vertical"
            onFinish={(v) => mutation.mutate(v)}
            initialValues={{ name: group.name, description: group.description, category: group.category ?? undefined }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Changes apply to all ${group.variants.length} variants of this product.`}
            />
            <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true, message: 'Please enter a name' }]}>
              <Input />
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
            <Form.Item label="Description" name="description">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Attributes">
                {group.attributeNames.map((n) => (
                  <Tag key={n}>{n}</Tag>
                ))}
              </Descriptions.Item>
            </Descriptions>
          </Form>
        )}
      </Spin>
    </Modal>
  );
};