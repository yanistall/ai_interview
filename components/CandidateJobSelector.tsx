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
    const loadJobs = async () => {
      const data = await getJobs();
      setJobs(data);
    };
    loadJobs();
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
      durationMinutes: 15,
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
    <div className="h-full bg-noir-950 overflow-y-auto scroll-elegant">
      {/* Modal for Name Input & Resume */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-noir-950/80 p-4 backdrop-blur-lg">
          <div className="glass glow-amber rounded-2xl p-8 max-w-md w-full animate-fade-up flex flex-col max-h-[90vh] overflow-y-auto scroll-elegant">
            <div className="absolute top-0 left-6 right-6 h-px shimmer-border"></div>

            <h3 className="font-display text-2xl font-bold text-noir-50 mb-2">準備開始面試</h3>
            <p className="text-noir-400 mb-8 text-sm">
              您即將應徵 <span className="text-amber-400 font-medium">{selectedJob.companyName}</span> 的 <span className="text-amber-400 font-medium">{selectedJob.title}</span> 職位。
            </p>

            <div className="space-y-6 mb-8">
              {/* Name Input */}
              <div>
                <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">請問您的姓名是？</label>
                <input
                  autoFocus
                  type="text"
                  className="w-full bg-noir-900/50 border border-noir-700/50 rounded-lg p-3.5 outline-none text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30"
                  placeholder="Ex: 王小明"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                />
              </div>

              {/* Resume Upload */}
              <div>
                 <label className="block text-xs font-medium text-noir-400 mb-2 tracking-widest uppercase">上傳履歷 (選填)</label>

                 {!resumeFile ? (
                   <div className="border border-dashed border-noir-600/50 rounded-xl p-8 text-center hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300 relative cursor-pointer">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                      />
                      <div className="flex flex-col items-center justify-center text-noir-500">
                         {isProcessingFile ? (
                           <span className="text-amber-400">處理中...</span>
                         ) : (
                           <>
                             <Upload size={24} className="mb-3 text-noir-500" />
                             <span className="text-sm font-medium text-noir-300">點擊上傳檔案</span>
                             <span className="text-xs mt-1 text-noir-600">支援 PDF 或 圖片 (JPG, PNG)</span>
                           </>
                         )}
                      </div>
                   </div>
                 ) : (
                   <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-amber-500/20 p-2 rounded-lg text-amber-400">
                          <FileText size={20} />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-sm font-bold text-noir-200 truncate">{resumeFile.name}</span>
                           <span className="text-xs text-noir-500">{resumeFile.type.split('/')[1].toUpperCase()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setResumeFile(null)}
                        className="text-noir-500 hover:text-red-400 p-1 transition-colors"
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
                className="flex-1 py-3.5 text-noir-400 bg-noir-800/50 hover:bg-noir-700/50 border border-noir-700/50 rounded-xl font-semibold transition-all duration-300"
              >
                取消
              </button>
              <button
                onClick={handleStart}
                disabled={isProcessingFile}
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 hover:from-amber-400 hover:to-amber-500 rounded-xl font-bold shadow-lg shadow-amber-500/10 transition-all duration-300 disabled:opacity-50"
              >
                進入面試室
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center gap-4 mb-10">
           <button onClick={onBack} className="p-2 hover:bg-noir-800/50 rounded-full transition-colors text-noir-500 hover:text-amber-400">
             &larr; 返回首頁
           </button>
           <h1 className="font-display text-3xl font-bold text-noir-50">職缺列表</h1>
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <Search className="absolute left-4 top-3.5 text-noir-600" size={20} />
          <input
            type="text"
            placeholder="搜尋公司或職稱..."
            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-noir-900/50 border border-noir-700/30 text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Job Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {filteredJobs.length === 0 ? (
             <div className="col-span-full text-center py-20 text-noir-600">
                {jobs.length === 0 ? "目前沒有任何開放的職缺。" : "找不到符合的職缺。"}
             </div>
           ) : (
             filteredJobs.map((job, index) => (
               <div
                 key={job.id}
                 onClick={() => setSelectedJob(job)}
                 className="group glass-light rounded-2xl p-6 hover:bg-white/[0.06] transition-all duration-500 cursor-pointer flex flex-col h-full animate-fade-up"
                 style={{ animationDelay: `${index * 0.05}s` }}
               >
                 <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 group-hover:bg-amber-500/15 transition-all duration-500">
                       <Building2 size={22} />
                    </div>
                    <span className="text-xs font-mono font-medium bg-noir-800/50 text-noir-400 px-2.5 py-1 rounded-full border border-noir-700/30">
                       {job.questions.length} 題
                    </span>
                 </div>

                 <h3 className="text-lg font-bold text-noir-100 mb-1 line-clamp-1">{job.title}</h3>
                 <p className="text-sm text-amber-400 font-medium mb-4">{job.companyName}</p>

                 <p className="text-noir-500 text-sm mb-6 line-clamp-3 flex-1 leading-relaxed">
                    {job.description}
                 </p>

                 <div className="pt-4 border-t border-noir-800/50 flex items-center justify-between text-amber-400 font-medium text-sm group-hover:translate-x-1 transition-transform duration-500">
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
