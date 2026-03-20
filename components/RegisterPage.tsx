import React, { useState } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';

interface RegisterPageProps {
  onRegister: (email: string, password: string, name: string, role: 'CANDIDATE' | 'ADMIN') => Promise<void>;
  onGoToLogin: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onRegister, onGoToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'CANDIDATE' | 'ADMIN'>('CANDIDATE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('請輸入有效的 Email 地址');
      return;
    }

    if (!name.trim()) {
      setError('請輸入姓名');
      return;
    }

    if (password !== confirmPassword) {
      setError('兩次密碼輸入不一致');
      return;
    }

    if (password.length < 6) {
      setError('密碼至少需要 6 個字元');
      return;
    }

    setLoading(true);
    try {
      await onRegister(email, password, name, role);
    } catch (err: any) {
      setError(err.message || '註冊失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-noir-950 p-6 relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="glass glow-amber rounded-2xl p-10 w-full max-w-md relative animate-fade-up">
        <div className="absolute top-0 left-8 right-8 h-px shimmer-border"></div>

        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-noir-50 mb-2 tracking-tight">
            AI  <span className="text-amber-400 italic">interview</span>
          </h1>
          <p className="text-noir-400 text-sm tracking-widest uppercase">建立新帳號</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">姓名</label>
            <input
              type="text"
              required
              className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="王小明"
            />
          </div>

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

          <div>
            <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">密碼</label>
            <input
              type="password"
              required
              className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">確認密碼</label>
            <input
              type="password"
              required
              className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="再次輸入密碼"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">角色</label>
            <select
              className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 transition-all duration-300 input-noir focus:border-amber-500/30"
              value={role}
              onChange={e => setRole(e.target.value as 'CANDIDATE' | 'ADMIN')}
            >
              <option value="CANDIDATE">求職者</option>
              <option value="ADMIN">企業管理員</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-lg font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 tracking-wide"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
            {loading ? '註冊中...' : '註冊'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-noir-500">
          已有帳號？{' '}
          <button onClick={onGoToLogin} className="text-amber-400 hover:text-amber-300 font-medium transition-colors duration-300">
            登入
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
