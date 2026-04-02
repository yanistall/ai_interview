import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Calendar, FileText, Search, User } from 'lucide-react';
import { getMe, updateMyProfile } from '../services/authService';
import { deleteVideo } from '../services/db';
import { getJobs } from '../services/jobService';
import { deleteReport, getAllReports } from '../services/storageService';
import { InterviewReport, JobProfile } from '../types';
import EnterpriseJobBuilder from './EnterpriseJobBuilder';

interface EnterpriseWorkspaceProps {
  onViewReport: (report: InterviewReport) => void;
  mode?: 'admin' | 'enterprise';
}

const EnterpriseWorkspace: React.FC<EnterpriseWorkspaceProps> = ({ onViewReport, mode = 'enterprise' }) => {
  const [jobs, setJobs] = useState<JobProfile[]>([]);
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'JOBS' | 'REPORTS'>('JOBS');
  const [companyNameSetting, setCompanyNameSetting] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const loadData = async () => {
    const [jobData, reportData] = await Promise.all([getJobs(), getAllReports()]);
    setJobs(jobData);
    setReports(reportData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const me = await getMe();
        setCompanyNameSetting(me.companyName || '');
      } catch {
        setCompanyNameSetting('');
      }
    };
    loadProfile();
  }, []);

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
          j.companyName.toLowerCase().includes(jobSearch.toLowerCase())
      ),
    [jobs, jobSearch]
  );

  const filteredReports = useMemo(
    () =>
      reports.filter(
        (r) =>
          r.candidateName.toLowerCase().includes(reportSearch.toLowerCase()) ||
          r.jobTitle.toLowerCase().includes(reportSearch.toLowerCase())
      ),
    [reports, reportSearch]
  );

  const handleDeleteReport = async (report: InterviewReport, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('確定刪除此面試紀錄？')) return;
    await deleteReport(report.id);
    if (report.videoPath) {
      try {
        await deleteVideo(report.videoPath);
      } catch {
        // ignore video delete errors
      }
    }
    await loadData();
  };

  const saveCompanyNameSetting = async () => {
    setIsSavingCompany(true);
    try {
      await updateMyProfile({ companyName: companyNameSetting.trim() });
      alert('企業名稱設定已儲存');
    } catch (e: any) {
      alert(e?.message || '儲存企業名稱失敗');
    } finally {
      setIsSavingCompany(false);
    }
  };

  return (
    <div className="h-full bg-noir-950 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-1 glass-light rounded-2xl p-6 overflow-y-auto scroll-elegant">
          <div className="flex items-center gap-2 mb-5">
            <Briefcase size={18} className="text-amber-400" />
            <h2 className="font-display text-2xl font-bold text-noir-100">職缺列表</h2>
          </div>
          <div className="relative mb-5">
            <Search size={16} className="absolute left-3 top-3.5 text-noir-600" />
            <input
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder="搜尋公司或職缺..."
              className="w-full pl-10 pr-3 py-3 rounded-xl bg-noir-900/50 border border-noir-700/40 text-noir-100 outline-none"
            />
          </div>

          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-noir-800/40 p-4 bg-noir-900/20">
                <div className="text-xs text-amber-400 font-semibold">{job.companyName}</div>
                <div className="text-noir-100 font-bold mt-1">{job.title}</div>
                <div className="text-xs text-noir-500 mt-2 line-clamp-2">{job.description}</div>
              </div>
            ))}
            {filteredJobs.length === 0 && <div className="text-noir-600 text-sm">找不到職缺</div>}
          </div>
        </div>

        <div className="lg:col-span-2 glass-light rounded-2xl p-6 overflow-y-auto scroll-elegant">
          <div className="mb-6 p-4 rounded-xl border border-noir-800/40 bg-noir-900/20">
            <div className="text-xs text-noir-500 tracking-widest uppercase mb-2">企業名稱設定</div>
            <div className="flex gap-2">
              <input
                value={companyNameSetting}
                onChange={(e) => setCompanyNameSetting(e.target.value)}
                placeholder="請輸入企業名稱（新增職缺會自動帶入）"
                className="flex-1 px-3 py-2.5 rounded-lg bg-noir-900/50 border border-noir-700/40 text-noir-100 outline-none"
              />
              <button
                onClick={saveCompanyNameSetting}
                disabled={isSavingCompany}
                className="px-4 py-2.5 rounded-lg bg-amber-500 text-noir-950 font-bold text-sm disabled:opacity-60"
              >
                {isSavingCompany ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setActiveTab('JOBS')}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'JOBS' ? 'bg-amber-500 text-noir-950' : 'bg-noir-900/40 text-noir-400'}`}
            >
              發佈職缺
            </button>
            <button
              onClick={() => setActiveTab('REPORTS')}
              className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'REPORTS' ? 'bg-amber-500 text-noir-950' : 'bg-noir-900/40 text-noir-400'}`}
            >
              查看面試紀錄
            </button>
          </div>

          {activeTab === 'JOBS' ? (
            <EnterpriseJobBuilder
              onBack={() => {}}
              defaultCompanyName={companyNameSetting}
              canManageAll={mode === 'admin'}
            />
          ) : (
            <div>
              <div className="relative mb-5">
                <Search size={16} className="absolute left-3 top-3.5 text-noir-600" />
                <input
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="搜尋候選人或職缺..."
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-noir-900/50 border border-noir-700/40 text-noir-100 outline-none"
                />
              </div>
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => onViewReport(report)}
                    className="p-4 rounded-xl border border-noir-800/40 bg-noir-900/20 cursor-pointer hover:border-amber-500/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-noir-200 font-semibold">
                          <User size={14} className="text-noir-500" />
                          {report.candidateName}
                        </div>
                        <div className="text-noir-500 text-sm mt-1">{report.jobTitle}</div>
                        <div className="text-noir-600 text-xs mt-1 flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(report.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-400 font-bold">Score {report.overallScore}</div>
                        <button
                          onClick={(e) => handleDeleteReport(report, e)}
                          className="text-xs text-red-400 mt-2"
                        >
                          刪除紀錄
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredReports.length === 0 && (
                  <div className="text-noir-600 text-sm flex items-center gap-2">
                    <FileText size={14} /> 目前沒有可查看的面試紀錄
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseWorkspace;
