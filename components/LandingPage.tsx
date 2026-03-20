import React from 'react';
import { User, Building2 } from 'lucide-react';

interface LandingPageProps {
  onSelectRole: (role: 'CANDIDATE' | 'ENTERPRISE') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-noir-950 p-6 relative overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-amber-600/3 rounded-full blur-[100px]"></div>
      </div>

      {/* Decorative lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"></div>

      <div className="text-center mb-16 relative animate-fade-up">
        <div className="text-amber-400/60 text-xs tracking-[0.4em] uppercase mb-4 font-medium">Next-Gen Interview Platform</div>
        <h1 className="font-display text-6xl md:text-7xl font-bold text-noir-50 tracking-tight mb-6">
          AI Talent <span className="text-amber-400 italic">Scout</span>
        </h1>
        <p className="text-noir-400 text-lg max-w-xl mx-auto leading-relaxed">
          下一代智慧面試平台。結合即時視訊分析與情感辨識，為企業挖掘最合適的人才。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative">
        {/* Candidate Card */}
        <button
          onClick={() => onSelectRole('CANDIDATE')}
          className="group relative overflow-hidden glass-light rounded-2xl p-10 transition-all duration-500 hover:bg-white/[0.06] text-left animate-fade-up animate-fade-up-delay-1"
        >
          {/* Hover glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 to-transparent"></div>

          <div className="absolute top-0 right-0 p-6 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
            <User size={140} strokeWidth={1} />
          </div>

          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 group-hover:bg-amber-500/15 transition-all duration-500">
              <User className="text-amber-400" size={24} />
            </div>
            <h2 className="font-display text-2xl font-bold text-noir-50 mb-3">我是求職者</h2>
            <p className="text-noir-400 leading-relaxed text-sm">
              參加 AI 模擬面試，展示您的專業能力與溝通技巧。系統將自動記錄您的表現。
            </p>
            <div className="mt-8 flex items-center text-amber-400 font-medium text-sm group-hover:translate-x-2 transition-transform duration-500 tracking-wide">
              開始面試 <span className="ml-2">&rarr;</span>
            </div>
          </div>
        </button>

        {/* Enterprise Card */}
        <button
          onClick={() => onSelectRole('ENTERPRISE')}
          className="group relative overflow-hidden glass-light rounded-2xl p-10 transition-all duration-500 hover:bg-white/[0.06] text-left animate-fade-up animate-fade-up-delay-2"
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 to-transparent"></div>

          <div className="absolute top-0 right-0 p-6 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
            <Building2 size={140} strokeWidth={1} />
          </div>

          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 group-hover:bg-amber-500/15 transition-all duration-500">
              <Building2 className="text-amber-400" size={24} />
            </div>
            <h2 className="font-display text-2xl font-bold text-noir-50 mb-3">企業後台管理</h2>
            <p className="text-noir-400 leading-relaxed text-sm">
              查看候選人面試報告、AI 情感分析數據與綜合評分，協助您做出最佳錄用決策。
            </p>
            <div className="mt-8 flex items-center text-amber-400 font-medium text-sm group-hover:translate-x-2 transition-transform duration-500 tracking-wide">
              進入儀表板 <span className="ml-2">&rarr;</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
