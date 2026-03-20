import React, { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onGoToRegister, onGoToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-noir-950 p-6 relative">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-500/3 rounded-full blur-3xl"></div>
      </div>

      <div className="glass glow-amber rounded-2xl p-10 w-full max-w-md relative animate-fade-up">
        {/* Decorative top line */}
        <div className="absolute top-0 left-8 right-8 h-px shimmer-border"></div>

        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-noir-50 mb-2 tracking-tight">
            AI  <span className="text-amber-400 italic">interview</span>
          </h1>
          <p className="text-noir-400 text-sm tracking-widest uppercase">登入您的帳號</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="animate-fade-up animate-fade-up-delay-1">
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

          <div className="animate-fade-up animate-fade-up-delay-2">
            <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">密碼</label>
            <input
              type="password"
              required
              className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="請輸入密碼"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="animate-fade-up animate-fade-up-delay-3 w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-lg font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 tracking-wide"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="mt-8 text-center space-y-3">
          <button
            onClick={onGoToForgotPassword}
            className="text-sm text-noir-500 hover:text-amber-400 transition-colors duration-300"
          >
            忘記密碼？
          </button>
          <div className="text-sm text-noir-500">
            還沒有帳號？{' '}
            <button onClick={onGoToRegister} className="text-amber-400 hover:text-amber-300 font-medium transition-colors duration-300">
              立即註冊
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
