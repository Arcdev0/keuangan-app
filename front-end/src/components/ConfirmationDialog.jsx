import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const toneStyles = {
  danger: {
    icon: AlertTriangle,
    iconWrap: 'bg-red-50 text-red-600',
    confirm: 'bg-red-600 text-white active:bg-red-700',
  },
  primary: {
    icon: CheckCircle2,
    iconWrap: 'bg-blue-50 text-[#0056b3]',
    confirm: 'bg-[#0056b3] text-white active:bg-[#064da3]',
  },
  neutral: {
    icon: Info,
    iconWrap: 'bg-gray-100 text-gray-700',
    confirm: 'bg-gray-900 text-white active:bg-gray-800',
  },
};

const ConfirmationDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger',
  loading = false,
  onCancel,
  onConfirm,
}) => {
  if (!open) {
    return null;
  }

  const style = toneStyles[tone] || toneStyles.danger;
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-0 sm:items-center sm:px-4">
      <div className="w-full max-w-md rounded-t-[22px] bg-white p-5 shadow-2xl sm:rounded-[22px]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}>
              <Icon size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-950">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup konfirmasi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`h-11 rounded-lg text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:bg-gray-400 ${style.confirm}`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
