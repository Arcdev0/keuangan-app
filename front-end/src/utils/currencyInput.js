export const formatMoneyInput = (value) => {
  const normalizedValue = String(value || '');
  const sourceValue = /^\d+\.\d{1,2}$/.test(normalizedValue) && Number(normalizedValue) < 1000
    ? normalizedValue.split('.')[0]
    : normalizedValue;
  const digits = sourceValue.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return Number(digits).toLocaleString('id-ID');
};

export const parseMoneyInput = (value) => String(value || '').replace(/\D/g, '');

export const moneyInputToNumber = (value) => Number(parseMoneyInput(value) || 0);
