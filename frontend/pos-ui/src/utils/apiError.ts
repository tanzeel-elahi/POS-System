// Django's str(ValidationError) looks like "['message']" — strip that wrapper.
const cleanMsg = (s: string) => s.replace(/^\[['"]/, '').replace(/['"]\]$/, '');

const collect = (v: unknown, label: string, out: string[]) => {
  if (typeof v === 'string') out.push(label ? `${label.replace(/_/g, ' ')}: ${v}` : v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, label, out));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => collect(x, k, out));
};

export const getApiError = (e: any, fallback = 'Something went wrong'): string => {
  const data = e?.response?.data;
  if (!data || typeof data === 'string') return fallback; // network / CORS / HTML error page
  if (data.detail) return cleanMsg(String(data.detail));
  const parts: string[] = [];
  collect(data, '', parts);
  return parts.length ? parts.join(' · ') : fallback;
};