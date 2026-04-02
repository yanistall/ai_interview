import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, FileText, History, Search, Upload, User } from 'lucide-react';
import { InterviewConfig, InterviewReport, JobProfile } from '../types';
import { getMe, updateMyProfile } from '../services/authService';
import { getJobs } from '../services/jobService';
import { getAllReports } from '../services/storageService';

interface ResumeData {
  fileName: string;
  mimeType: string;
  data: string;
}

interface CandidateProfile {
  displayName: string;
  resume?: ResumeData;
}

interface CandidateWorkspaceProps {
  userName: string;
  onStartInterview: (config: InterviewConfig) => void;
  onViewReport: (report: InterviewReport) => void;
}

const CandidateWorkspace: React.FC<CandidateWorkspaceProps> = ({
  userName,
  onStartInterview,
  onViewReport,
}) => {
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [profile, setProfile] = useState<CandidateProfile>({ displayName: userName });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const me = await getMe();
        setProfile({
          displayName: me.name || userName,
          resume:
            me.resumeData && me.resumeFileName && me.resumeMimeType
              ? {
                  fileName: me.resumeFileName,
                  mimeType: me.resumeMimeType,
                  data: me.resumeData,
                }
              : undefined,
        });
      } catch {
        setProfile({ displayName: userName });
      }
    };
    loadProfile();
  }, [userName]);

  useEffect(() => {
    const load = async () => {
      const [jobData, reportData] = await Promise.all([getJobs(), getAllReports()]);
      setJobs(jobData);
      setReports(reportData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    load();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.companyName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  const handleResumeUpload = async (file?: File) => {
    try {
      if (!file) return;
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('僅支援 PDF 或圖片格式 (JPG, PNG, WEBP)');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        alert('履歷檔案請控制在 8MB 內');
        return;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const nextResume = {
        fileName: file.name,
        mimeType: file.type,
        data: base64,
      };
      setProfile((prev) => ({
        ...prev,
        resume: nextResume,
      }));
      setIsSaving(true);
      await updateMyProfile({
        name: profile.displayName.trim() || userName,
        resume: nextResume,
      });
    } catch (e: any) {
      alert(e?.message || '更新個人檔案失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updated = await updateMyProfile({
        name: profile.displayName.trim() || userName,
        resume: profile.resume
          ? {
              fileName: profile.resume.fileName,
              mimeType: profile.resume.mimeType,
              data: profile.resume.data,
            }
          : null,
      });
      setProfile((prev) => ({
        ...prev,
        displayName: updated.name || prev.displayName,
      }));
    } catch (e: any) {
      alert(e?.message || '儲存個人資料失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const startInterviewWithJob = (job: JobProfile) => {
    const candidateName = profile.displayName.trim() || userName;
    if (!candidateName) {
      alert('請先在右側個人檔案填寫姓名');
      return;
    }

    const config: InterviewConfig = {
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      jobDescription: job.description,
      persona: job.persona,
      voiceName: job.voiceName,
      mandatoryQuestions: job.questions,
      candidateName,
      durationMinutes: 15,
      resume: profile.resume
        ? {
            mimeType: profile.resume.mimeType,
            data: profile.resume.data,
            fileName: profile.resume.fileName,
          }
        : undefined,
    };

    onStartInterview(config);
  };

  return (
    <div className="h-full bg-noir-950 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-2 glass-light rounded-2xl p-6 overflow-y-auto scroll-elegant">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-noir-100">職缺列表</h2>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-3.5 text-noir-600" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋公司或職稱..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-noir-900/50 border border-noir-700/40 text-noir-100 placeholder-noir-600 input-noir outline-none"
            />
          </div>

          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className="text-noir-600 text-center py-12">目前沒有可應徵職缺</div>
            ) : (
              filteredJobs.map((job) => (
                <div key={job.id} className="border border-noir-800/50 rounded-xl p-5 bg-noir-900/20">
                  <div className="text-xs text-amber-400 font-semibold mb-1">{job.companyName}</div>
                  <div className="text-lg font-bold text-noir-100">{job.title}</div>
                  <div className="text-sm text-noir-500 mt-2 line-clamp-3">{job.description}</div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => startInterviewWithJob(job)}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 font-bold text-sm"
                    >
                      立即面試
                    </button>
                    {profile.resume ? (
                      <button
                        onClick={() => startInterviewWithJob(job)}
                        className="px-4 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-sm"
                      >
                        使用履歷「{profile.resume.fileName}」快速應徵
                      </button>
                    ) : (
                      <span className="text-xs text-noir-600">先在右側上傳履歷可快速應徵</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-light rounded-2xl p-6 overflow-y-auto scroll-elegant">
          <h2 className="font-display text-2xl font-bold text-noir-100 mb-6">個人檔案</h2>

          <div className="space-y-4 mb-7">
            <label className="text-xs uppercase tracking-widest text-noir-500">姓名</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3.5 text-noir-600" />
              <input
                value={profile.displayName}
                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-noir-900/50 border border-noir-700/40 text-noir-100 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <label className="text-xs uppercase tracking-widest text-noir-500">履歷上傳</label>
            <label className="block border border-dashed border-noir-700/50 rounded-xl p-4 cursor-pointer hover:border-amber-500/30">
              <input
                type="file"
                className="hidden"
                accept="application/pdf,image/*"
                onChange={(e) => handleResumeUpload(e.target.files?.[0])}
              />
              <div className="flex items-center gap-2 text-noir-400 text-sm">
                <Upload size={16} />
                {profile.resume ? `已上傳：${profile.resume.fileName}` : '點擊上傳履歷（PDF/JPG/PNG/WEBP）'}
              </div>
            </label>
            {profile.resume && (
              <button
                onClick={async () => {
                  setProfile((p) => ({ ...p, resume: undefined }));
                  setIsSaving(true);
                  try {
                    await updateMyProfile({ resume: null });
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="text-xs text-red-400"
              >
                移除履歷
              </button>
            )}
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="mb-8 w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 font-bold text-sm disabled:opacity-60"
          >
            {isSaving ? '儲存中...' : '儲存個人資料'}
          </button>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-amber-400" />
              <h3 className="font-bold text-noir-200">歷史面試紀錄</h3>
            </div>
            <ul className="space-y-2 list-disc list-inside">
              {reports.length === 0 ? (
                <li className="text-noir-600 text-sm list-none">尚無面試紀錄</li>
              ) : (
                reports.map((r) => (
                  <li key={r.id} className="text-sm text-noir-400">
                    <button
                      onClick={() => onViewReport(r)}
                      className="text-left hover:text-amber-400 transition-colors"
                    >
                      {new Date(r.timestamp).toLocaleDateString()}｜{r.jobTitle}｜分數 {r.overallScore}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mt-8 text-xs text-noir-600 flex items-center gap-2">
            <FileText size={14} />
            點擊歷史紀錄可查看完整報告與錄影
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateWorkspace;
