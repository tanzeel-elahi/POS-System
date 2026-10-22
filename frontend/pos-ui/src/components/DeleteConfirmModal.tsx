import { useEffect, useState } from 'react';
import { Alert, Input, Modal, Typography } from 'antd';

interface Props {
  open: boolean;
  itemLabel: string; // user must type this to confirm
  title: string;
  warningMessage?: string;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal = ({ open, itemLabel, title, warningMessage, confirmLoading, onCancel, onConfirm }: Props) => {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (open) setTyped('');
  }, [open]);
  const isMatch = typed.trim() === itemLabel;

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => isMatch && onConfirm()}
      okText="Delete"
      okType="danger"
      okButtonProps={{ disabled: !isMatch, loading: confirmLoading }}
      destroyOnHidden
    >
      {warningMessage && <Alert type="warning" showIcon message={warningMessage} style={{ marginBottom: 16 }} />}
      <Typography.Paragraph>
        Type <Typography.Text code>{itemLabel}</Typography.Text> to confirm deletion.
      </Typography.Paragraph>
      <Input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={itemLabel}
        status={typed && !isMatch ? 'error' : undefined}
        onPressEnter={() => isMatch && onConfirm()}
      />
    </Modal>
  );
};
