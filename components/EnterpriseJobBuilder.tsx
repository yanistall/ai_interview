import React, { useState } from 'react';
import { JobProfile, Persona, PRESET_QUESTIONS, AVAILABLE_VOICES } from '../types';
import { saveJob, getJobs, deleteJob } from '../services/jobService';
import { Plus, Trash2, Save, Building, Briefcase, Mic, User } from 'lucide-react';

interface EnterpriseJobBuilderProps {
  onBack: () => void;
}

const EnterpriseJobBuilder: React.FC<EnterpriseJobBuilderProps> = ({ onBack }) => {
  const [jobs, setJobs] = useState<JobProfile[]>(getJobs());
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState<Persona>(Persona.FRIENDLY_HR);
  const [voiceName, setVoiceName] = useState('Kore');
  const [questions, setQuestions] = useState<string[]>([PRESET_QUESTIONS[0], PRESET_QUESTIONS[1]]);
  const [newQuestion, setNewQuestion] = useState('');

  const resetForm = () => {
    setEditId(null);
    setCompanyName('');
    setTitle('');
    setDescription('');
    setPersona(Persona.FRIENDLY_HR);
    setVoiceName('Kore');
    setQuestions([PRESET_QUESTIONS[0], PRESET_QUESTIONS[1]]);
    setIsEditing(false);
  };

  const handleEdit = (job: JobProfile) => {
    setEditId(job.id);
    setCompanyName(job.companyName);
    setTitle(job.title);
    setDescription(job.description);
    setPersona(job.persona);
    setVoiceName(job.voiceName);
    setQuestions(job.questions);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("確定要刪除這個職缺嗎？")) {
      deleteJob(id);
      setJobs(getJobs());
    }
  };

  const handleSave = () => {
    if (!companyName || !title || !description) {
      alert("請填寫完整職缺資訊");
      return;
    }

    const job: JobProfile = {
      id: editId || crypto.randomUUID(),
      companyName,
      title,
      description,
      persona,
      voiceName,
      questions,
      createdAt: Date.now()
    };

    saveJob(job);
    setJobs(getJobs());
    resetForm();
  };

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setQuestions([...questions, newQuestion.trim()]);
      setNewQuestion('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">職缺管理與發布</h2>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} /> 新增職缺
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-6 bg-slate-50 p-6 rounded-xl border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">公司名稱</label>
              <input 
                className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Google Taiwan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">職位名稱</label>
              <input 
                className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Senior Frontend Engineer"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">職位描述 (JD)</label>
              <textarea 
                className="w-full border border-slate-300 rounded-lg p-3 h-32 outline-none focus:ring-2 focus:ring-blue-500"
                value={description} onChange={e => setDescription(e.target.value)} placeholder="請貼上詳細的工作內容與要求..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                   <User size={16} /> 面試官性格 (Persona)
                </label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={persona} onChange={e => setPersona(e.target.value as Persona)}
                >
                  <option value={Persona.FRIENDLY_HR}>親切 HR (輕鬆、引導式)</option>
                  <option value={Persona.STRICT_MANAGER}>嚴格經理 (高壓、追問細節)</option>
                  <option value={Persona.TECHNICAL_LEAD}>技術主管 (專注專業能力)</option>
                  <option value={Persona.EXECUTIVE}>公司高層 (關注宏觀願景)</option>
                </select>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                   <Mic size={16} /> 面試官聲音 (AI Voice)
                </label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={voiceName} onChange={e => setVoiceName(e.target.value)}
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
             </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-2">面試題庫設定</label>
             <div className="space-y-2 mb-3">
               {questions.map((q, i) => (
                 <div key={i} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200">
                   <span className="bg-blue-100 text-blue-700 px-2 rounded text-xs">{i+1}</span>
                   <span className="flex-1 text-sm text-slate-700">{q}</span>
                   <button onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                     <Trash2 size={16} />
                   </button>
                 </div>
               ))}
             </div>
             <div className="flex gap-2">
               <input 
                 className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                 value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="新增自訂問題..."
                 onKeyDown={e => e.key === 'Enter' && addQuestion()}
               />
               <button onClick={addQuestion} className="bg-slate-200 hover:bg-slate-300 px-4 rounded-lg text-slate-600 text-sm">新增</button>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button onClick={resetForm} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors">
              <Save size={18} /> 發布職缺
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              尚無已發布的職缺，請點擊上方按鈕新增。
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="flex justify-between items-start p-4 border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                <div>
                   <div className="text-xs text-blue-600 font-bold mb-1">{job.companyName}</div>
                   <h3 className="font-bold text-slate-800 text-lg">{job.title}</h3>
                   <div className="flex gap-3 text-xs text-slate-500 mt-2">
                      <span className="flex items-center gap-1"><User size={12}/> {job.persona}</span>
                      <span className="flex items-center gap-1"><Mic size={12}/> {job.voiceName}</span>
                      <span>{job.questions.length} 個問題</span>
                   </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(job)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">編輯</button>
                  <button onClick={() => handleDelete(job.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">刪除</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default EnterpriseJobBuilder;