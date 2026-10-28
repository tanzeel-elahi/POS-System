import { useState } from 'react';
import { Alert, App, Button, Descriptions, Drawer, Flex, Form, Input, InputNumber, Modal, Statistic, Table, Tabs, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BillingService } from '@services/billingService';
import { CreditService } from '@services/creditService';
import { getApiError } from '@/utils/apiError';
import type { Bill, CreditEntry, Customer } from '@/types';

const money = (n: number) => n.toFixed(2);
const MODE_COLOR = { cash: 'green', credit: 'orange', online: 'blue' } as const;

/* ---------------- Credit tab ---------------- */

const CreditTab = ({ customer }: { customer: Customer }) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<{ amount: number; note?: string }>();
  const [repayOpen, setRepayOpen] = useState(false);

  const creditQuery = useQuery({
    queryKey: ['customers', customer.id, 'credit'],
    queryFn: () => CreditService.getCredit(customer.id),
  });
  const balance = creditQuery.data?.balance ?? 0;

  const repayMutation = useMutation({
    mutationFn: (v: { amount: number; note?: string }) => CreditService.recordRepayment(customer.id, v),
    onSuccess: () => {
      message.success('Repayment recorded');
      setRepayOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customers', customer.id, 'credit'] });
    },
    onError: (e) => message.error(getApiError(e, 'Failed to record repayment')),
  });

  const columns: TableColumnsType<CreditEntry> = [
    { title: 'Date', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: 'Type',
      dataIndex: 'entryType',
      render: (v: CreditEntry['entryType']) =>
        v === 'sale' ? <Tag color="red">Sale (owes more)</Tag> : <Tag color="green">Repayment</Tag>,
    },
    { title: 'Amount', dataIndex: 'amount', align: 'right', render: money },
    { title: 'Bill', dataIndex: 'bill', render: (v: string | null) => (v ? `#${v}` : '-') },
    { title: 'Note', dataIndex: 'note', render: (v: string) => v || '-' },
  ];

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Statistic title="Outstanding balance" value={balance} precision={2} valueStyle={{ color: balance > 0 ? '#cf1322' : '#3f8600' }} />
        <Button
          type="primary"
          disabled={balance <= 0}
          onClick={() => {
            form.resetFields();
            setRepayOpen(true);
          }}
        >
          Record repayment
        </Button>
      </Flex>

      <Table<CreditEntry>
        size="small"
        rowKey="id"
        loading={creditQuery.isLoading}
        columns={columns}
        dataSource={creditQuery.data?.entries ?? []}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
      />

      <Modal
        title="Record repayment"
        open={repayOpen}
        onCancel={() => setRepayOpen(false)}
        onOk={() => form.submit()}
        okText="Record"
        confirmLoading={repayMutation.isPending}
        destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`Outstanding balance: ${money(balance)}`} />
        <Form form={form} layout="vertical" onFinish={(v) => repayMutation.mutate(v)}>
          <Form.Item label="Amount" name="amount" rules={[{ required: true, message: 'Enter an amount' }]}>
            <InputNumber min={0.01} max={balance} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Note" name="note">
            <Input maxLength={200} placeholder="e.g. Cash received" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

/* ---------------- Bills tab ---------------- */

const BillsTab = ({ customer }: { customer: Customer }) => {
  const billsQuery = useQuery({
    queryKey: ['customers', customer.id, 'bills'],
    queryFn: () => BillingService.getCustomerBills(customer.id),
  });

  const columns: TableColumnsType<Bill> = [
    { title: 'Bill #', dataIndex: 'id' },
    { title: 'Date', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: 'Payment',
      dataIndex: 'paymentMode',
      render: (v: Bill['paymentMode']) => <Tag color={MODE_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    { title: 'Total', dataIndex: 'totalAmount', align: 'right', render: money },
    {
      title: 'Proof',
      dataIndex: 'paymentProof',
      render: (v: string | null) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer">
            View
          </a>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Table<Bill>
      size="small"
      rowKey="id"
      loading={billsQuery.isLoading}
      columns={columns}
      dataSource={billsQuery.data ?? []}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      locale={{ emptyText: 'No bills yet' }}
      expandable={{
        expandedRowRender: (bill) => (
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={bill.items}
            columns={[
              { title: 'Item', dataIndex: 'name' },
              { title: 'Price', dataIndex: 'unitPrice', align: 'right', render: money },
              { title: 'Qty', dataIndex: 'quantity', align: 'right' },
              { title: 'Total', dataIndex: 'lineTotal', align: 'right', render: money },
            ]}
          />
        ),
      }}
    />
  );
};

/* ---------------- Drawer ---------------- */

interface Props {
  customer: Customer | null;
  onClose: () => void;
}

export const CustomerDetailsDrawer = ({ customer, onClose }: Props) => (
  <Drawer title={customer?.name} open={!!customer} onClose={onClose} width={720} destroyOnHidden>
    {customer && (
      <>
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Phone">{customer.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Address" span={2}>
            {customer.address || '-'}
          </Descriptions.Item>
        </Descriptions>
        <Tabs
          items={[
            { key: 'credit', label: 'Credit', children: <CreditTab customer={customer} /> },
            { key: 'bills', label: 'Bills', children: <BillsTab customer={customer} /> },
          ]}
        />
      </>
    )}
  </Drawer>
);