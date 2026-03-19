import React, { useState } from 'react';
import { InterviewConfig, Persona, PRESET_QUESTIONS } from '../types';
import { Briefcase, User, Clock, CheckCircle, Plus, X } from 'lucide-react';

interface SetupFormProps {
  onStart: (config: InterviewConfig) => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onStart }) => {
  const [jobTitle, setJobTitle] = useState('Frontend Engineer');
  const [jobDescription, setJobDescription] = useState('React, TypeScript, TailwindCSS expertise required.');
  const [duration, setDuration] = useState(15);
  const [candidateName, setCandidateName] = useState('');
  const [persona, setPersona] = useState<Persona>(Persona.FRIENDLY_HR);
  const [mandatoryQuestions, setMandatoryQuestions] = useState<string[]>([PRESET_QUESTIONS[0]]);
  const [newQuestion, setNewQuestion] = useState('');

  const handleAddQuestion = () => {
    if (newQuestion.trim()) {
      setMandatoryQuestions([...mandatoryQuestions, newQuestion.trim()]);
      setNewQuestion('');
    }
  };

  const handleRemoveQuestion = (index: number) => {
    setMandatoryQuestions(mandatoryQuestions.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    onStart({
      jobId: crypto.randomUUID(),
      jobTitle,
      jobDescription,
      durationMinutes: duration,
      persona,
      mandatoryQuestions,
      candidateName: candidateName || '候選人',
      companyName: 'Demo Corp',
      voiceName: 'Kore'
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl mt-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800">AI 面試模擬系統</h1>
        <p className="text-slate-500 mt-2">設定您的職位與面試偏好，開始一對一模擬面試</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <User size={16} /> 您的稱呼
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="王小明"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <Briefcase size={16} /> 應徵職位
            </label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">職位要求 (Job Description)</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <Clock size={16} /> 預計時長 (分鐘)
            </label>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              className="w-full accent-blue-600"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
            <div className="text-right text-sm text-slate-500">{duration} 分鐘</div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">選擇面試官風格</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: Persona.FRIENDLY_HR, label: '親切 HR', desc: '輕鬆、引導式' },
                { id: Persona.STRICT_MANAGER, label: '嚴格經理', desc: '高壓、追問細節' },
                { id: Persona.TECHNICAL_LEAD, label: '技術主管', desc: '專注專業能力' },
                { id: Persona.EXECUTIVE, label: '公司高層', desc: '關注宏觀願景' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id as Persona)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    persona === p.id 
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                    : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-800">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <CheckCircle size={16} /> 必問問題設定
            </label>
            <div className="flex gap-2 mb-2">
              <select 
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                onChange={(e) => {
                  if(e.target.value && !mandatoryQuestions.includes(e.target.value)) {
                    setMandatoryQuestions([...mandatoryQuestions, e.target.value]);
                  }
                }}
                value=""
              >
                <option value="" disabled>選擇範本問題...</option>
                {PRESET_QUESTIONS.map((q, i) => (
                  <option key={i} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                placeholder="輸入自定義問題..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
              />
              <button 
                onClick={handleAddQuestion}
                className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg text-slate-600"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {mandatoryQuestions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded text-sm group">
                  <span className="bg-blue-100 text-blue-700 px-1.5 rounded text-xs mt-0.5">{idx + 1}</span>
                  <span className="flex-1 text-slate-700">{q}</span>
                  <button 
                    onClick={() => handleRemoveQuestion(idx)}
                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
        <button
          onClick={handleStart}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-blue-200 transition-all transform hover:scale-105"
        >
          開始面試模擬
        </button>
      </div>
    </div>
  );
};

export default SetupForm;