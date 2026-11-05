import { useState } from 'react';
import { Alert, Button, DatePicker, Descriptions, Flex, Modal, Statistic, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { BillingService } from '@services/billingService';
import { CreditService } from '@services/creditService';
import { getApiError } from '@/utils/apiError';
import type { Customer, StatementEntry } from '@/types';
import { BillReceiptModal } from '../billing/BillReceiptModal';

const money = (n: number) => n.toFixed(2);
const FMT = 'YYYY-MM-DD';

type Range = [Dayjs, Dayjs];
const preset = (label: string, a: Dayjs, b: Dayjs) => ({ label, value: [a, b] as Range });

interface Props {
  open: boolean;
  customer: Customer;
  onClose: () => void;
}

export const CreditStatementModal = ({ open, customer, onClose }: Props) => {
  // null = all time (no dates sent)
  const [range, setRange] = useState<Range | null>(() => [dayjs().startOf('month'), dayjs()]);
  const [viewBillId, setViewBillId] = useState<string | null>(null);

  // Dates are computed here; the backend reads them in the shop's timezone.
  const startDate = range?.[0].format(FMT);
  const endDate = range?.[1].format(FMT);

  const statementQuery = useQuery({
    queryKey: ['customers', customer.id, 'statement', startDate ?? null, endDate ?? null],
    queryFn: () => CreditService.getStatement(customer.id, { startDate, endDate }),
    enabled: open,
  });

  const billQuery = useQuery({
    queryKey: ['bills', viewBillId],
    queryFn: () => BillingService.getBill(viewBillId!),
    enabled: !!viewBillId,
  });

  const s = statementQuery.data;

  const columns: TableColumnsType<StatementEntry> = [
    { title: 'Date', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: 'Description',
      key: 'desc',
      render: (_, e) =>
        e.entryType === 'sale' ? (
          <span>
            Credit sale{' '}
            {e.bill && (
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setViewBillId(e.bill)}>
                Bill #{e.bill}
              </Button>
            )}
          </span>
        ) : (
          <span>
            Repayment {e.note && <Typography.Text type="secondary">· {e.note}</Typography.Text>}
          </span>
        ),
    },
    { title: 'Charges', key: 'charges', align: 'right', render: (_, e) => (e.entryType === 'sale' ? money(e.amount) : '') },
    { title: 'Payments', key: 'payments', align: 'right', render: (_, e) => (e.entryType === 'repayment' ? money(e.amount) : '') },
    { title: 'Balance', dataIndex: 'runningBalance', align: 'right', render: money },
  ];

  const periodText = s
    ? `${s.period.startDate ?? 'Beginning'} → ${s.period.endDate ?? 'Today'}`
    : '';

  return (
    <>
      <Modal
        title="Credit e-statement"
        open={open}
        onCancel={onClose}
        width={860}
        destroyOnHidden
        footer={[
          <Button key="print" icon={<PrinterOutlined />} disabled={!s} onClick={() => window.print()}>
            Print
          </Button>,
          <Button key="close" type="primary" onClick={onClose}>
            Close
          </Button>,
        ]}
      >
        {/* Print only the statement. Skipped while a bill is open on top, so two print rules never fight. */}
        {!viewBillId && (
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .statement-print, .statement-print * { visibility: visible; }
              .statement-print { position: absolute; left: 0; top: 0; width: 100%; }
            }
          `}</style>
        )}

        <Flex gap={8} wrap="wrap" align="center" style={{ marginBottom: 16 }}>
          <DatePicker.RangePicker
            value={range}
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            presets={[
              preset('Last 30 days', dayjs().subtract(29, 'day'), dayjs()),
              preset('This month', dayjs().startOf('month'), dayjs()),
              preset('Last month', dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')),
            ]}
            onChange={(v) => {
              if (v && v[0] && v[1]) setRange([v[0], v[1]]);
            }}
          />
          <Button type={range === null ? 'primary' : 'default'} onClick={() => setRange(null)}>
            All time
          </Button>
        </Flex>

        {statementQuery.isError && (
          <Alert type="error" showIcon message={getApiError(statementQuery.error, 'Failed to load statement')} />
        )}

        {statementQuery.isLoading && <Typography.Text type="secondary">Loading statement…</Typography.Text>}

        {s && (
          <div className="statement-print">
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Customer">{s.customer.name}</Descriptions.Item>
              <Descriptions.Item label="Phone">{s.customer.phone}</Descriptions.Item>
              <Descriptions.Item label="Period" span={2}>
                {periodText}
              </Descriptions.Item>
            </Descriptions>

            <Flex gap={32} wrap="wrap" style={{ marginBottom: 16 }}>
              <Statistic title="Opening balance" value={s.openingBalance} precision={2} />
              <Statistic title="Total charges" value={s.totalCharges} precision={2} />
              <Statistic title="Total payments" value={s.totalPayments} precision={2} />
              <Statistic
                title="Closing balance"
                value={s.closingBalance}
                precision={2}
                valueStyle={{ color: s.closingBalance > 0 ? '#cf1322' : '#3f8600' }}
              />
            </Flex>

            <Table<StatementEntry>
              size="small"
              rowKey="id"
              columns={columns}
              dataSource={s.entries}
              pagination={false}
              locale={{ emptyText: 'No activity in this period' }}
              scroll={{ x: 'max-content' }}
              summary={() =>
                s.entries.length > 0 ? (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Typography.Text strong>Totals</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Typography.Text strong>{money(s.totalCharges)}</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Typography.Text strong>{money(s.totalPayments)}</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Tag color={s.closingBalance > 0 ? 'red' : 'green'}>{money(s.closingBalance)}</Tag>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                ) : null
              }
            />
          </div>
        )}
      </Modal>

      <BillReceiptModal
        bill={viewBillId ? (billQuery.data ?? null) : null}
        proofFailed={false}
        retrying={false}
        onRetryProof={() => {}}
        closeLabel="Close"
        onClose={() => setViewBillId(null)}
      />
    </>
  );
};