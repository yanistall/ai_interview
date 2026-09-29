import React from 'react';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

export type InterviewCompletionStatus = 'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR';

interface InterviewCompletionNoticeProps {
  status: InterviewCompletionStatus;
  onDismiss?: () => void;
}

const content = {
  SAVING: {
    title: '面試資料正在背景儲存',
    detail: '完成前請勿關閉或重新整理此頁面；你仍可繼續瀏覽職缺。',
  },
  SUCCESS: {
    title: '面試資料已完成儲存',
    detail: '錄影與分析報告已安全送出。',
  },
  ERROR: {
    title: '面試資料儲存失敗',
    detail: '請保持登入並稍後重試，或聯絡系統管理員。',
  },
} as const;

const InterviewCompletionNotice: React.FC<InterviewCompletionNoticeProps> = ({ status, onDismiss }) => {
  if (status === 'IDLE') return null;

  const message = content[status];
  const isError = status === 'ERROR';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`fixed bottom-5 right-5 z-[60] w-[min(24rem,calc(100vw-2.5rem))] rounded-xl border p-4 shadow-2xl backdrop-blur-md ${
        isError
          ? 'border-red-500/40 bg-red-950/95 text-red-100'
          : 'border-amber-500/30 bg-noir-900/95 text-noir-100'
      }`}
    >
      <div className="flex items-start gap-3">
        {status === 'SAVING' && <Loader2 className="mt-0.5 shrink-0 animate-spin text-amber-400" size={20} />}
        {status === 'SUCCESS' && <CheckCircle className="mt-0.5 shrink-0 text-emerald-400" size={20} />}
        {status === 'ERROR' && <AlertCircle className="mt-0.5 shrink-0 text-red-300" size={20} />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{message.title}</p>
          <p className="mt-1 text-sm opacity-75">{message.detail}</p>
        </div>
        {status !== 'SAVING' && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="關閉通知"
            className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default InterviewCompletionNotice;
