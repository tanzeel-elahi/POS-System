import { Table } from 'antd';
import type { TableProps } from 'antd';
import { NO_DATA_TEXT } from '@/utils/constants';

/**
 * Thin wrapper over antd Table with the project defaults (server-side pagination, total text).
 * If you want ProTable like the CRM project, install @ant-design/pro-components and swap it in here —
 * pages only talk to this wrapper.
 */
export function GenericTable<T extends object>({ pagination, ...rest }: TableProps<T>) {
  return (
    <Table<T>
      size="middle"
      rowKey="id"
      locale={{ emptyText: NO_DATA_TEXT }}
      scroll={{ x: 'max-content' }}
      pagination={
        pagination === false
          ? false
          : {
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              ...pagination,
            }
      }
      {...rest}
    />
  );
}
