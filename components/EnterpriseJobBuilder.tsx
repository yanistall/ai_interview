import React, { useState, useEffect } from 'react';
import { JobProfile, Persona, PRESET_QUESTIONS, AVAILABLE_VOICES } from '../types';
import { saveJob, getJobs, getMyJobs, deleteJob } from '../services/jobService';
import { Plus, Trash2, Save, Mic, User } from 'lucide-react';

interface EnterpriseJobBuilderProps {
  onBack: () => void;
  defaultCompanyName?: string;
  canManageAll?: boolean;
}

const EnterpriseJobBuilder: React.FC<EnterpriseJobBuilderProps> = ({ onBack, defaultCompanyName = '', canManageAll = false }) => {
  const [jobs, setJobs] = useState<JobProfile[]>([]);
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
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [draggingQuestionIndex, setDraggingQuestionIndex] = useState<number | null>(null);

  const loadJobs = async () => {
    const data = canManageAll ? await getJobs() : await getMyJobs();
    setJobs(data);
  };

  useEffect(() => {
    loadJobs();
  }, [canManageAll]);

  useEffect(() => {
    if (!isEditing || editId) return;
    if (!companyName && defaultCompanyName) {
      setCompanyName(defaultCompanyName);
    }
  }, [defaultCompanyName, isEditing, editId, companyName]);

  const resetForm = () => {
    setEditId(null);
    setCompanyName(defaultCompanyName || '');
    setTitle('');
    setDescription('');
    setPersona(Persona.FRIENDLY_HR);
    setVoiceName('Kore');
    setQuestions([PRESET_QUESTIONS[0], PRESET_QUESTIONS[1]]);
    setEditingQuestionIndex(null);
    setEditingQuestionText('');
    setDraggingQuestionIndex(null);
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

  const handleDelete = async (id: string) => {
    if (confirm("確定要刪除這個職缺嗎？")) {
      await deleteJob(id);
      await loadJobs();
    }
  };

  const handleSave = async () => {
    if (!companyName || !title || !description) {
      alert("請填寫完整職缺資訊");
      return;
    }

    await saveJob({
      id: editId || undefined,
      companyName,
      title,
      description,
      persona,
      voiceName,
      questions,
    });
    await loadJobs();
    resetForm();
  };

  const addQuestion = () => {
    if (newQuestion.trim()) {
      setQuestions([...questions, newQuestion.trim()]);
      setNewQuestion('');
    }
  };

  const startEditQuestion = (index: number) => {
    setEditingQuestionIndex(index);
    setEditingQuestionText(questions[index] || '');
  };

  const saveEditQuestion = () => {
    if (editingQuestionIndex === null) return;
    const text = editingQuestionText.trim();
    if (!text) {
      alert('題目內容不能為空');
      return;
    }
    setQuestions((prev) => prev.map((q, i) => (i === editingQuestionIndex ? text : q)));
    setEditingQuestionIndex(null);
    setEditingQuestionText('');
  };

  const cancelEditQuestion = () => {
    setEditingQuestionIndex(null);
    setEditingQuestionText('');
  };

  const reorderQuestions = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    setQuestions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    if (editingQuestionIndex !== null) {
      if (editingQuestionIndex === fromIndex) {
        setEditingQuestionIndex(toIndex);
      } else if (fromIndex < toIndex && editingQuestionIndex > fromIndex && editingQuestionIndex <= toIndex) {
        setEditingQuestionIndex(editingQuestionIndex - 1);
      } else if (fromIndex > toIndex && editingQuestionIndex >= toIndex && editingQuestionIndex < fromIndex) {
        setEditingQuestionIndex(editingQuestionIndex + 1);
      }
    }
  };

  return (
    <div className="glass-light rounded-xl p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="font-display text-2xl font-bold text-noir-100">職缺管理與發布</h2>
        {!isEditing && (
          <button
            onClick={() => {
              setIsEditing(true);
              if (!companyName && defaultCompanyName) {
                setCompanyName(defaultCompanyName);
              }
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 px-5 py-2.5 rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all duration-300 font-bold text-sm shadow-lg shadow-amber-500/10"
          >
            <Plus size={18} /> 新增職缺
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-6 bg-noir-900/30 p-6 rounded-xl border border-amber-500/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">公司名稱</label>
              <input
                className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
                value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Google Taiwan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">職位名稱</label>
              <input
                className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
                value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Senior Frontend Engineer"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">職位描述 (JD)</label>
              <textarea
                className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 h-32 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30 resize-none"
                value={description} onChange={e => setDescription(e.target.value)} placeholder="請貼上詳細的工作內容與要求..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase flex items-center gap-2">
                   <User size={14} /> 面試官性格
                </label>
                <select
                  className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 transition-all duration-300 input-noir focus:border-amber-500/30"
                  value={persona} onChange={e => setPersona(e.target.value as Persona)}
                >
                 <option value={Persona.FRIENDLY_HR}>引導式</option>
                  <option value={Persona.STRICT_MANAGER}>嚴謹</option>
                  <option value={Persona.TECHNICAL_LEAD}>專注專業能力</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase flex items-center gap-2">
                   <Mic size={14} /> 面試官聲音
                </label>
                <select
                  className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 transition-all duration-300 input-noir focus:border-amber-500/30"
                  value={voiceName} onChange={e => setVoiceName(e.target.value)}
                >
                  {AVAILABLE_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
             </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-noir-400 mb-3 tracking-widest uppercase">面試題庫設定</label>
             <div className="space-y-2 mb-3">
               {questions.map((q, i) => (
                 <div
                   key={i}
                   draggable
                   onDragStart={() => setDraggingQuestionIndex(i)}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={() => {
                     if (draggingQuestionIndex === null) return;
                     reorderQuestions(draggingQuestionIndex, i);
                     setDraggingQuestionIndex(null);
                   }}
                   onDragEnd={() => setDraggingQuestionIndex(null)}
                   className={`flex gap-2 items-center bg-noir-900/40 p-3 rounded-lg border transition-colors ${
                     draggingQuestionIndex === i
                       ? 'border-amber-500/50 opacity-70'
                       : 'border-noir-800/50'
                   }`}
                 >
                   <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-xs font-mono font-bold">{i+1}</span>
                   <span className="text-noir-600 text-xs cursor-move select-none" title="拖曳排序">⋮⋮</span>
                   {editingQuestionIndex === i ? (
                     <>
                       <input
                         className="flex-1 bg-noir-900/60 border border-noir-700/50 rounded-lg p-2 text-sm outline-none text-noir-100"
                         value={editingQuestionText}
                         onChange={(e) => setEditingQuestionText(e.target.value)}
                       />
                       <button onClick={saveEditQuestion} className="px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded">
                         儲存
                       </button>
                       <button onClick={cancelEditQuestion} className="px-2 py-1 text-xs text-noir-500 hover:bg-noir-800/60 rounded">
                         取消
                       </button>
                     </>
                   ) : (
                     <>
                       <span className="flex-1 text-sm text-noir-300">{q}</span>
                       <button onClick={() => startEditQuestion(i)} className="text-noir-500 hover:text-amber-400 transition-colors text-xs px-2 py-1 rounded hover:bg-amber-500/10">
                         編輯
                       </button>
                       <button onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))} className="text-noir-600 hover:text-red-400 transition-colors">
                         <Trash2 size={14} />
                       </button>
                     </>
                   )}
                 </div>
               ))}
             </div>
             <div className="flex gap-2">
               <input
                 className="flex-1 bg-noir-900/50 border border-noir-700/50 rounded-lg p-2.5 text-sm outline-none text-noir-100 placeholder-noir-600 input-noir focus:border-amber-500/30"
                 value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder="新增自訂問題..."
                 onKeyDown={e => e.key === 'Enter' && addQuestion()}
               />
               <button onClick={addQuestion} className="bg-noir-800 hover:bg-noir-700 border border-noir-700/50 px-4 rounded-lg text-noir-400 hover:text-amber-400 text-sm transition-all duration-300">新增</button>
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-noir-800/50">
            <button onClick={resetForm} className="px-6 py-2.5 text-noir-400 hover:text-noir-200 hover:bg-noir-800/50 rounded-lg transition-all duration-300">取消</button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-lg hover:from-amber-400 hover:to-amber-500 flex items-center gap-2 transition-all duration-300 font-bold shadow-lg shadow-amber-500/10">
              <Save size={16} /> 發布職缺
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.length === 0 ? (
            <div className="text-center py-16 text-noir-600 bg-noir-900/20 rounded-xl border border-dashed border-noir-700/30">
              尚無已發布的職缺，請點擊上方按鈕新增。
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="flex justify-between items-start p-5 border border-noir-800/50 rounded-xl hover:bg-noir-900/30 hover:border-amber-500/10 transition-all duration-300 group">
                <div>
                   <div className="text-xs text-amber-400 font-bold mb-1 tracking-wide">{job.companyName}</div>
                   <h3 className="font-bold text-noir-100 text-lg">{job.title}</h3>
                   <div className="flex gap-4 text-xs text-noir-500 mt-2">
                      <span className="flex items-center gap-1"><User size={11}/> {job.persona}</span>
                      <span className="flex items-center gap-1"><Mic size={11}/> {job.voiceName}</span>
                      <span className="font-mono">{job.questions.length} 個問題</span>
                   </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(job)} className="px-3 py-1.5 text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg text-sm transition-all duration-300">編輯</button>
                  <button onClick={() => handleDelete(job.id)} className="px-3 py-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all duration-300">刪除</button>
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
