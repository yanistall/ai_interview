import React from 'react';
import { User, Building2 } from 'lucide-react';

interface LandingPageProps {
  onSelectRole: (role: 'CANDIDATE' | 'ENTERPRISE') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-white tracking-tight mb-4">
          AI Talent <span className="text-blue-500">Scout</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-lg mx-auto">
          下一代智慧面試平台。結合 Gemini 即時視訊分析與情感辨識，為企業挖掘最合適的人才。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Candidate Card */}
        <button
          onClick={() => onSelectRole('CANDIDATE')}
          className="group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-8 transition-all hover:scale-[1.02] text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <User size={120} />
          </div>
          <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mb-6 shadow-lg shadow-blue-900/50">
            <User className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">我是求職者</h2>
          <p className="text-slate-400">
            參加 AI 模擬面試，展示您的專業能力與溝通技巧。系統將自動記錄您的表現。
          </p>
          <div className="mt-6 flex items-center text-blue-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            開始面試 &rarr;
          </div>
        </button>

        {/* Enterprise Card */}
        <button
          onClick={() => onSelectRole('ENTERPRISE')}
          className="group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-8 transition-all hover:scale-[1.02] text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Building2 size={120} />
          </div>
          <div className="bg-purple-600 w-12 h-12 rounded-lg flex items-center justify-center mb-6 shadow-lg shadow-purple-900/50">
            <Building2 className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">企業後台管理</h2>
          <p className="text-slate-400">
            查看候選人面試報告、AI 情感分析數據與綜合評分，協助您做出最佳錄用決策。
          </p>
          <div className="mt-6 flex items-center text-purple-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            進入儀表板 &rarr;
          </div>
        </button>
      </div>
      
      <div className="mt-16 text-slate-600 text-sm">
        Powered by Google Gemini Live API
      </div>
    </div>
  );
};

export default LandingPage;