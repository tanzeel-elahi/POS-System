export const cnicDigits = (v?: string | null) => (v ?? '').replace(/\D/g, '');

export const formatCnic = (v?: string | null) => {
  const d = cnicDigits(v);
  return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : (v ?? '');
};