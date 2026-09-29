import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ForgotPasswordProps {
  onGoToLogin: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onGoToLogin }) => {
  return (
    <div className="min-h-full flex items-center justify-center bg-noir-950 p-6 relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-1/3 -left-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="glass glow-amber rounded-2xl p-10 w-full max-w-md relative animate-fade-up">
        <div className="absolute top-0 left-8 right-8 h-px shimmer-border"></div>

        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-noir-50 mb-2 tracking-tight">
            AI Talent <span className="text-amber-400 italic">interview</span>
          </h1>
          <p className="text-noir-400 text-sm tracking-widest uppercase">忘記密碼</p>
        </div>

        <div role="status" className="bg-amber-500/10 border border-amber-500/20 text-amber-200 px-4 py-3 rounded-lg text-sm">
          目前暫停自助密碼重設，請聯絡系統管理員。
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onGoToLogin}
            className="text-sm text-noir-500 hover:text-amber-400 flex items-center gap-1 justify-center transition-colors duration-300"
          >
            <ArrowLeft size={14} /> 返回登入
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
