import React, { useEffect, useState } from 'react';
import { getAllReports, deleteReport } from '../services/storageService';
import { InterviewReport } from '../types';
import EnterpriseJobBuilder from './EnterpriseJobBuilder';
import { Trash2, User, Calendar, LogOut, Search, Briefcase, FileText } from 'lucide-react';

interface AdminDashboardProps {
  onViewReport: (report: InterviewReport) => void;
  onLogout: () => void;
}

export const AdminReportsPanel = ({ reports, searchTerm, setSearchTerm, onViewReport, handleDelete }: {
  reports: InterviewReport[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onViewReport: (report: InterviewReport) => void;
  handleDelete: (id: string, videoPath: string | undefined, event: React.MouseEvent) => void;
}) => {
  const filteredReports = reports.filter(report =>
    report.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const completedReports = reports.filter(report => report.assessmentVersion === 'candidate-bplus-v1');
  const reportsNeedingEvidence = reports.filter(report => report.assessment.dimensions.some(dimension =>
    dimension.status === 'NOT_ASSESSABLE' || dimension.evidenceSufficiency === 'PARTIAL' || dimension.evidenceSufficiency === 'INSUFFICIENT'
  ));
  return (
    <>
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="glass-light rounded-xl p-6">
                <div className="text-noir-500 text-xs tracking-widest uppercase mb-2">總面試人數</div>
                <div className="text-4xl font-display font-bold text-noir-100">{reports.length}</div>
            </div>
            <div className="glass-light rounded-xl p-6">
                <div className="text-noir-500 text-xs tracking-widest uppercase mb-2">完成四級評測</div>
                <div className="text-4xl font-display font-bold text-amber-400">
                    {completedReports.length}
                </div>
            </div>
            <div className="glass-light rounded-xl p-6">
                <div className="text-noir-500 text-xs tracking-widest uppercase mb-2">證據待補充</div>
                <div className="text-4xl font-display font-bold text-emerald-400">
                    {reportsNeedingEvidence.length}
                </div>
            </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 relative">
            <Search className="absolute left-4 top-3.5 text-noir-600" size={20} />
            <input
                type="text"
                placeholder="搜尋候選人姓名或職位..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-noir-900/50 border border-noir-700/30 text-noir-100 placeholder-noir-600 transition-all duration-300 input-noir focus:border-amber-500/30 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Candidates List */}
        <div className="glass-light rounded-xl overflow-hidden">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-noir-800/50">
                        <th className="px-6 py-4 font-medium text-noir-500 text-xs tracking-widest uppercase">候選人</th>
                        <th className="px-6 py-4 font-medium text-noir-500 text-xs tracking-widest uppercase">應徵職位</th>
                        <th className="px-6 py-4 font-medium text-noir-500 text-xs tracking-widest uppercase">面試時間</th>
                        <th className="px-6 py-4 font-medium text-noir-500 text-xs tracking-widest uppercase">報告</th>
                        <th className="px-6 py-4 font-medium text-noir-500 text-xs tracking-widest uppercase text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-noir-800/30">
                    {filteredReports.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-16 text-center text-noir-600">
                                尚無面試資料
                            </td>
                        </tr>
                    ) : (
                        filteredReports.map((report) => (
                            <tr
                                key={report.id}
                                onClick={() => onViewReport(report)}
                                className="hover:bg-amber-500/5 cursor-pointer transition-colors duration-300 group"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-noir-800 border border-noir-700/50 flex items-center justify-center text-noir-400 group-hover:border-amber-500/30 transition-colors">
                                            <User size={14} />
                                        </div>
                                        <span className="font-medium text-noir-200">{report.candidateName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-noir-400">{report.jobTitle}</td>
                                <td className="px-6 py-4 text-noir-500 text-sm">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={13} />
                                        {new Date(report.timestamp).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-bold px-3 py-1 rounded-full text-noir-300 bg-noir-800/50">
                                        四級能力報告
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={(e) => handleDelete(report.id, report.videoPath, e)}
                                        className="p-2 text-noir-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-300"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewReport, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'JOBS'>('JOBS');
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadReports = async () => {
      const data = await getAllReports();
      setReports(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    };
    loadReports();
  }, []);

  const handleDelete = async (id: string, _videoPath: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這筆面試紀錄與相關影片嗎？')) {
      try {
        await deleteReport(id);
        setReports(reports.filter(r => r.id !== id));
      } catch (error) {
        alert(error instanceof Error ? error.message : '刪除面試紀錄失敗');
      }
    }
  };

  return (
    <div className="h-full bg-noir-950 overflow-y-auto scroll-elegant">
      {/* Navbar */}
      <div className="glass sticky top-0 z-10 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-noir-950 w-9 h-9 rounded-lg font-bold flex items-center justify-center text-sm">E</div>
            <h1 className="text-lg font-bold text-noir-100">企業招聘管理平台</h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={onLogout} className="flex items-center gap-2 text-noir-500 hover:text-red-400 transition-colors text-sm font-medium">
                <LogOut size={16} /> 登出
            </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">

        {/* Tabs */}
        <div className="flex gap-3 mb-10">
            <button
                onClick={() => setActiveTab('JOBS')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                    activeTab === 'JOBS'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 shadow-lg shadow-amber-500/10'
                    : 'glass-light text-noir-400 hover:text-noir-200 hover:bg-white/[0.06]'
                }`}
            >
                <Briefcase size={18} /> 職缺管理
            </button>
            <button
                onClick={() => setActiveTab('REPORTS')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                    activeTab === 'REPORTS'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 shadow-lg shadow-amber-500/10'
                    : 'glass-light text-noir-400 hover:text-noir-200 hover:bg-white/[0.06]'
                }`}
            >
                <FileText size={18} /> 面試紀錄
            </button>
        </div>

        {activeTab === 'JOBS' ? (
            <EnterpriseJobBuilder onBack={() => {}} />
        ) : (
            <AdminReportsPanel reports={reports} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onViewReport={onViewReport} handleDelete={handleDelete} />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
