import { Alert, Form, InputNumber, Modal, Select } from 'antd';

export type BulkAction = 'percent' | 'setPrice' | 'addStock' | 'setStock';

export interface BulkActionValue {
  action: BulkAction;
  value: number;
}

interface Props {
  open: boolean;
  count: number;
  onApply: (v: BulkActionValue) => void;
  onClose: () => void;
}

const ACTIONS = [
  { value: 'percent', label: 'Raise / lower price by %' },
  { value: 'setPrice', label: 'Set price to' },
  { value: 'addStock', label: 'Add to / remove from stock' },
  { value: 'setStock', label: 'Set stock to an exact count' },
];

export const BulkActionModal = ({ open, count, onApply, onClose }: Props) => {
  const [form] = Form.useForm<BulkActionValue>();
  const action = Form.useWatch('action', form) ?? 'percent';

  return (
    <Modal
      title={`Apply to ${count} selected ${count === 1 ? 'product' : 'products'}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Apply to rows"
      destroyOnHidden
      width={440}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{ action: 'percent' }}
        onValuesChange={(changed) => {
          if ('action' in changed) form.setFieldValue('value', undefined);
        }}
        onFinish={(v) => onApply(v)}
      >
        <Form.Item label="Action" name="action">
          <Select options={ACTIONS} />
        </Form.Item>

        {action === 'percent' && (
          <Form.Item
            label="Percent"
            name="value"
            extra="10 raises prices by 10%, -5 lowers them by 5%. The server does the rounding."
            rules={[{ required: true, message: 'Enter a percent' }]}
          >
            <InputNumber min={-99.99} max={1000} precision={2} addonAfter="%" style={{ width: '100%' }} />
          </Form.Item>
        )}

        {action === 'setPrice' && (
          <Form.Item label="New price" name="value" rules={[{ required: true, message: 'Enter a price' }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        )}

        {action === 'addStock' && (
          <Form.Item
            label="Quantity to add"
            name="value"
            extra="Use a negative number to remove stock."
            rules={[
              { required: true, message: 'Enter a quantity' },
              { validator: (_, v) => (v === 0 ? Promise.reject(new Error('Enter a non-zero number')) : Promise.resolve()) },
            ]}
          >
            <InputNumber precision={0} style={{ width: '100%' }} />
          </Form.Item>
        )}

        {action === 'setStock' && (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Use this only for a stock count. It overwrites any sales made since this grid loaded."
            />
            <Form.Item label="Exact stock count" name="value" rules={[{ required: true, message: 'Enter a count' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};