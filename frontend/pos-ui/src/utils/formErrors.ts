import type { FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { getApiError } from './apiError';

type FieldName = string | (string | number)[];
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const applyApiErrors = (
  form: FormInstance<any>,
  e: any,
  message: MessageInstance,
  routeDetail?: (msg: string) => FieldName | null, // maps a { detail } message to the field it belongs to
  fallback = 'Something went wrong',
) => {
  const data = e?.response?.data;
  if (e?.response?.status !== 400 || !data || typeof data !== 'object') {
    message.error(getApiError(e, fallback));
    return;
  }

  const fields: { name: FieldName; errors: string[] }[] = [];
  Object.entries(data).forEach(([key, errs]) => {
    if (key === 'detail' || key === 'non_field_errors') return;
    if (Array.isArray(errs) && errs.every((x) => typeof x === 'string')) {
      fields.push({ name: camel(key), errors: errs as string[] });
    }
  });

  if (data.detail || data.non_field_errors) {
    const msg = getApiError(e, fallback);
    const target = routeDetail?.(msg);
    if (target) fields.push({ name: target, errors: [msg] });
    else message.error(msg);
  } else if (fields.length === 0) {
    message.error(getApiError(e, fallback));
  }

  form.setFields(fields as Parameters<FormInstance['setFields']>[0]);
};