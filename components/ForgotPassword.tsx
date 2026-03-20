import React, { useState } from 'react';
import { Mail, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { forgotPassword, resetPassword } from '../services/authService';

interface ForgotPasswordProps {
  onGoToLogin: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onGoToLogin }) => {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
      setStep('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('密碼至少需要 6 個字元');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      setMessage('密碼重設成功！請重新登入。');
      setTimeout(onGoToLogin, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-noir-400 text-sm tracking-widest uppercase">
            {step === 'email' ? '忘記密碼' : '重設密碼'}
          </p>
        </div>

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-lg text-sm mb-4">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleForgot} className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">Email</label>
              <input
                type="email"
                required
                className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-lg font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/10 tracking-wide"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
              {loading ? '處理中...' : '發送重設連結'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">重設 Token</label>
              <input
                type="text"
                required
                className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30 font-mono"
                value={resetToken}
                onChange={e => setResetToken(e.target.value)}
                placeholder="貼上重設 token"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">新密碼</label>
              <input
                type="password"
                required
                className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="至少 6 個字元"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-lg font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/10 tracking-wide"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <KeyRound size={20} />}
              {loading ? '處理中...' : '重設密碼'}
            </button>
          </form>
        )}

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
