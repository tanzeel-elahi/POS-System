import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Flex, List, Modal, Spin, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { ProductService } from '@services/productService';
import type { BulkChange, BulkUpdateResult, BulkUpdateRow } from '@/types';
import { newBatchId, parseBulkErrors } from './bulkUtils';
import type { BulkErrorInfo } from './bulkUtils';

const money = (n: number) => n.toFixed(2);

const Arrow = ({ from, to, fmt = String }: { from: number; to: number; fmt?: (n: number) => string }) =>
  from === to ? (
    <span>{fmt(from)}</span>
  ) : (
    <span>
      {fmt(from)} → <Typography.Text strong type={to > from ? 'success' : 'danger'}>{fmt(to)}</Typography.Text>
    </span>
  );

const columns: TableColumnsType<BulkChange> = [
  {
    title: 'Product',
    key: 'product',
    render: (_, c) => (
      <div>
        <div>{c.displayName}</div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.sku}</Typography.Text>
      </div>
    ),
  },
  { title: 'Price', key: 'price', align: 'right', render: (_, c) => <Arrow from={c.oldPrice} to={c.newPrice} fmt={money} /> },
  { title: 'Stock', key: 'stock', align: 'right', render: (_, c) => <Arrow from={c.oldStock} to={c.newStock} /> },
];

interface ContentProps {
  updates: BulkUpdateRow[];
  nameOf: (id: string) => string;
  onClose: () => void;
  onApplied: (r: BulkUpdateResult | null) => void;
}

const ReviewContent = ({ updates, nameOf, onClose, onApplied }: ContentProps) => {
  const { message } = App.useApp();
  const [batchId] = useState(newBatchId); // generated ONCE when the review opens
  const [result, setResult] = useState<BulkUpdateResult | null>(null);
  const [errorInfo, setErrorInfo] = useState<BulkErrorInfo | null>(null);

  const dryRun = useMutation({
    mutationFn: () => ProductService.bulkUpdate(updates, { dryRun: true }),
    onSuccess: (r) => {
      setResult(r);
      setErrorInfo(null);
    },
    onError: (e) => {
      setResult(null);
      setErrorInfo(parseBulkErrors(e, updates));
    },
  });

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dryRun.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useMutation({
    mutationFn: () => ProductService.bulkUpdate(updates, { dryRun: false, batchId }),
    onSuccess: (r) => onApplied(r),
    onError: (e: any) => {
      if (e?.response?.status === 409) {
        message.info('This batch was already applied. Refreshing the grid.');
        onApplied(null);
        return;
      }
      if (!e?.response) {
        message.error('No response from the server. Press Confirm again — the same batch ID is reused, so it cannot be applied twice.');
        return;
      }
      // 400: nothing was saved (for example stock changed since the check)
      setResult(null);
      setErrorInfo(parseBulkErrors(e, updates));
    },
  });

  const busy = dryRun.isPending || save.isPending;

  return (
    <>
      <Spin spinning={dryRun.isPending}>
        <div style={{ minHeight: 120 }}>
          {errorInfo && (
            <>
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                message={errorInfo.general ?? 'Some rows have errors. Nothing was saved.'}
              />
              {errorInfo.rows.length > 0 && (
                <List
                  size="small"
                  bordered
                  dataSource={errorInfo.rows}
                  renderItem={(r) => (
                    <List.Item>
                      <div>
                        <Typography.Text strong>{r.id ? nameOf(r.id) : `Row ${r.index + 1}`}</Typography.Text>
                        {r.messages.map((m, i) => (
                          <div key={i}>
                            <Typography.Text type="danger">{m}</Typography.Text>
                          </div>
                        ))}
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </>
          )}

          {result && (
            <>
              <Alert
                type={result.changed > 0 ? 'info' : 'warning'}
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  result.changed > 0
                    ? `${result.changed} ${result.changed === 1 ? 'product' : 'products'} will change, ${result.unchanged} unchanged.`
                    : 'Nothing would change.'
                }
                description="Old values are what is stored right now, which may differ slightly from what the grid showed."
              />
              <Table<BulkChange>
                size="small"
                rowKey="id"
                columns={columns}
                dataSource={result.changes}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: 'max-content' }}
              />
            </>
          )}
        </div>
      </Spin>

      <Flex justify="end" gap={8} style={{ marginTop: 16 }}>
        {errorInfo && (
          <Button
            disabled={busy}
            onClick={() => {
              setErrorInfo(null);
              dryRun.mutate();
            }}
          >
            Check again
          </Button>
        )}
        <Button disabled={save.isPending} onClick={onClose}>
          Back to grid
        </Button>
        <Button
          type="primary"
          loading={save.isPending}
          disabled={busy || !result || result.changed === 0 || !!errorInfo}
          onClick={() => save.mutate()}
        >
          Confirm and save
        </Button>
      </Flex>
    </>
  );
};

interface Props extends Omit<ContentProps, 'onClose'> {
  open: boolean;
  onClose: () => void;
}

export const BulkReviewModal = ({ open, onClose, ...rest }: Props) => (
  <Modal title="Review changes" open={open} onCancel={onClose} footer={null} width={860} destroyOnHidden maskClosable={false}>
    {/* Mounted only while open, so each review gets a fresh batch ID and a fresh dry run */}
    {open && <ReviewContent onClose={onClose} {...rest} />}
  </Modal>
);