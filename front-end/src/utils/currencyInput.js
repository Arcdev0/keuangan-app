export const formatMoneyInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return Number(digits).toLocaleString('id-ID');
};

export const parseMoneyInput = (value) => String(value || '').replace(/\D/g, '');

export const moneyInputToNumber = (value) => Number(parseMoneyInput(value) || 0);
