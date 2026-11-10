import { Button, Modal, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import type { Product } from '@/types';

interface Props {
  product: Product | null;
  onClose: () => void;
}

export const ProductQrModal = ({ product, onClose }: Props) => {
  const value = product ? product.qrCode || product.sku : '';

  return (
    <Modal
      title="Product QR code"
      open={!!product}
      onCancel={onClose}
      width={360}
      destroyOnHidden
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Print
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-print, .qr-print * { visibility: visible; }
          .qr-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {product && (
        <div className="qr-print" style={{ textAlign: 'center' }}>
          <div style={{ background: '#fff', padding: 12, display: 'inline-block' }}>
            <QRCodeSVG value={value} size={200} level="M" />
          </div>
          <div style={{ marginTop: 8 }}>
            <Typography.Text strong>{product.displayName}</Typography.Text>
          </div>
          <Typography.Text type="secondary">{value}</Typography.Text>
          {!product.qrCode && (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                No QR code set, so this encodes the SKU
              </Typography.Text>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};