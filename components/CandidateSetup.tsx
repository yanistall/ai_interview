import React, { useState } from 'react';
import { InterviewConfig, Persona, DEFAULT_MANDATORY_QUESTIONS } from '../types';
import { User, Briefcase, ChevronRight } from 'lucide-react';

interface CandidateSetupProps {
  onStart: (config: InterviewConfig) => void;
  onBack: () => void;
}

const CandidateSetup: React.FC<CandidateSetupProps> = ({ onStart, onBack }) => {
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('Frontend Engineer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = () => {
    if (!name.trim()) {
      alert("請輸入您的姓名");
      return;
    }
    setIsSubmitting(true);

    // Create a standardized config for the candidate
    const config: InterviewConfig = {
      jobId: crypto.randomUUID(),
      candidateName: name,
      jobTitle: jobTitle,
      jobDescription: "Standard technical role requirements including problem solving, communication, and domain expertise.",
      durationMinutes: 10, // Default 10 mins
      persona: Persona.FRIENDLY_HR, // Default friendly
      mandatoryQuestions: DEFAULT_MANDATORY_QUESTIONS,
      companyName: 'Demo Corp',
      voiceName: 'Kore'
    };

    // Simulate "Uploading CV" delay
    setTimeout(() => {
        onStart(config);
    }, 1500);
  };

  return (
    <div className="h-full bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 relative">
        <button onClick={onBack} className="absolute top-6 left-6 text-slate-400 hover:text-slate-600">
            &larr; 返回
        </button>

        <div className="text-center mb-8 mt-4">
          <h2 className="text-2xl font-bold text-slate-800">歡迎來到 AI 面試</h2>
          <p className="text-slate-500 mt-2">請填寫基本資料，AI 面試官將即刻準備就緒。</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <User size={16} className="text-blue-600" /> 您的真實姓名
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Ex: 王大明"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <Briefcase size={16} className="text-blue-600" /> 應徵職位
            </label>
            <select
              className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            >
              <option value="Frontend Engineer">Frontend Engineer (前端工程師)</option>
              <option value="Backend Engineer">Backend Engineer (後端工程師)</option>
              <option value="Product Manager">Product Manager (產品經理)</option>
              <option value="Digital Marketing">Digital Marketing (數位行銷)</option>
              <option value="Sales Representative">Sales Representative (業務代表)</option>
            </select>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
             <strong>提示：</strong> 面試過程中請保持攝像頭開啟，AI 將會觀察您的表情與非語言溝通技巧並給予即時反饋。
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={isSubmitting}
          className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '系統準備中...' : (
            <>
              進入面試室 <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CandidateSetup;