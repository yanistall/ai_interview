import React, { useState, useEffect } from 'react';
import { JobProfile, InterviewConfig } from '../types';
import { getJobs } from '../services/jobService';
import { Building2, ChevronRight, User, Search, Briefcase, Upload, FileText, X } from 'lucide-react';

interface CandidateJobSelectorProps {
  onStartInterview: (config: InterviewConfig) => void;
  onBack: () => void;
}

const CandidateJobSelector: React.FC<CandidateJobSelectorProps> = ({ onStartInterview, onBack }) => {
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobProfile | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Resume State
  const [resumeFile, setResumeFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  useEffect(() => {
    setJobs(getJobs());
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert("僅支援 PDF 或圖片格式 (JPG, PNG)");
      return;
    }

    setIsProcessingFile(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
           const result = reader.result as string;
           // Remove data URL prefix (e.g., "data:application/pdf;base64,")
           const base64String = result.split(',')[1];
           resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setResumeFile({
        name: file.name,
        type: file.type,
        data: base64
      });
    } catch (err) {
      console.error("File processing failed", err);
      alert("檔案讀取失敗");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleStart = () => {
    if (!selectedJob) return;
    if (!candidateName.trim()) {
      alert("請輸入您的姓名以開始面試");
      return;
    }

    const config: InterviewConfig = {
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      companyName: selectedJob.companyName,
      jobDescription: selectedJob.description,
      persona: selectedJob.persona,
      voiceName: selectedJob.voiceName,
      mandatoryQuestions: selectedJob.questions,
      candidateName: candidateName,
      durationMinutes: 15, // Default duration
      resume: resumeFile ? {
        mimeType: resumeFile.type,
        data: resumeFile.data,
        fileName: resumeFile.name
      } : undefined
    };

    onStartInterview(config);
  };

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      {/* Modal for Name Input & Resume */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-2">準備開始面試</h3>
            <p className="text-slate-500 mb-6 text-sm">
              您即將應徵 <strong>{selectedJob.companyName}</strong> 的 <strong>{selectedJob.title}</strong> 職位。
            </p>
            
            <div className="space-y-6 mb-8">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">請問您的姓名是？</label>
                <input 
                  autoFocus
                  type="text" 
                  className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 王小明"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                />
              </div>

              {/* Resume Upload */}
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">上傳履歷 (選填)</label>
                 
                 {!resumeFile ? (
                   <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                      <input 
                        type="file" 
                        accept="application/pdf,image/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                      />
                      <div className="flex flex-col items-center justify-center text-slate-400">
                         {isProcessingFile ? (
                           <span>處理中...</span>
                         ) : (
                           <>
                             <Upload size={24} className="mb-2 text-slate-400" />
                             <span className="text-sm font-medium text-slate-600">點擊上傳檔案</span>
                             <span className="text-xs mt-1">支援 PDF 或 圖片 (JPG, PNG)</span>
                           </>
                         )}
                      </div>
                   </div>
                 ) : (
                   <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                          <FileText size={20} />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-sm font-bold text-slate-700 truncate">{resumeFile.name}</span>
                           <span className="text-xs text-slate-500">{resumeFile.type.split('/')[1].toUpperCase()}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setResumeFile(null)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <X size={18} />
                      </button>
                   </div>
                 )}
              </div>
            </div>

            <div className="flex gap-3 mt-auto">
              <button 
                onClick={() => setSelectedJob(null)}
                className="flex-1 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleStart}
                disabled={isProcessingFile}
                className="flex-1 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
              >
                進入面試室
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
           <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
             &larr; 返回首頁
           </button>
           <h1 className="text-2xl font-bold text-slate-800">職缺列表</h1>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="搜尋公司或職稱..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Job Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredJobs.length === 0 ? (
             <div className="col-span-full text-center py-20 text-slate-400">
                {jobs.length === 0 ? "目前沒有任何開放的職缺。" : "找不到符合的職缺。"}
             </div>
           ) : (
             filteredJobs.map(job => (
               <div 
                 key={job.id} 
                 onClick={() => setSelectedJob(job)}
                 className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-full"
               >
                 <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                       <Building2 size={24} />
                    </div>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                       {job.questions.length} 題
                    </span>
                 </div>
                 
                 <h3 className="text-lg font-bold text-slate-800 mb-1 line-clamp-1">{job.title}</h3>
                 <p className="text-sm text-blue-600 font-medium mb-4">{job.companyName}</p>
                 
                 <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-1">
                    {job.description}
                 </p>

                 <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
                    <span>立即應徵</span>
                    <ChevronRight size={16} />
                 </div>
               </div>
             ))
           )}
        </div>
      </div>
    </div>
  );
};

export default CandidateJobSelector;