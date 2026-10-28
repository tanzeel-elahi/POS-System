import { Alert, Button, Descriptions, Image, Modal, Table, Tag, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import type { Bill } from '@/types';

interface Props {
  bill: Bill | null;
  proofFailed: boolean;
  retrying: boolean;
  onRetryProof: () => void;
  onClose: () => void;
}

const money = (n: number) => n.toFixed(2);
const MODE_COLOR = { cash: 'green', credit: 'orange', online: 'blue' } as const;

export const BillReceiptModal = ({ bill, proofFailed, retrying, onRetryProof, onClose }: Props) => (
  <Modal
    title={bill ? `Bill #${bill.id}` : 'Bill'}
    open={!!bill}
    onCancel={onClose}
    width={640}
    footer={[
      <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
        Print
      </Button>,
      <Button key="new" type="primary" onClick={onClose}>
        New bill
      </Button>,
    ]}
  >
    <style>{`
      @media print {
        body * { visibility: hidden; }
        .receipt-print, .receipt-print * { visibility: visible; }
        .receipt-print { position: absolute; left: 0; top: 0; width: 100%; }
      }
    `}</style>

    {proofFailed && (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Bill saved, but the proof image upload failed"
        description="The bill is final. You can retry the upload now; closing this window discards the chosen image."
        action={
          <Button size="small" loading={retrying} onClick={onRetryProof}>
            Retry upload
          </Button>
        }
      />
    )}

    {bill && (
      <div className="receipt-print">
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Bill #">{bill.id}</Descriptions.Item>
          <Descriptions.Item label="Date">{new Date(bill.createdAt).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="Customer">{bill.customerName || 'Walk-in customer'}</Descriptions.Item>
          <Descriptions.Item label="Payment">
            <Tag color={MODE_COLOR[bill.paymentMode]}>{bill.paymentMode.toUpperCase()}</Tag>
          </Descriptions.Item>
          {bill.paymentProof && (
            <Descriptions.Item label="Proof">
              <Image src={bill.paymentProof} width={80} />
            </Descriptions.Item>
          )}
        </Descriptions>

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

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Typography.Text strong style={{ fontSize: 18 }}>
            Grand total: {money(bill.totalAmount)}
          </Typography.Text>
        </div>
      </div>
    )}
  </Modal>
);