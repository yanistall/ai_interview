import React, { useEffect, useState } from 'react';
import { getAllReports, deleteReport } from '../services/storageService';
import { deleteVideo } from '../services/db';
import { InterviewReport } from '../types';
import EnterpriseJobBuilder from './EnterpriseJobBuilder';
import { Trash2, Eye, User, Calendar, LogOut, Search, Briefcase, FileText } from 'lucide-react';

interface AdminDashboardProps {
  onViewReport: (report: InterviewReport) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewReport, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'JOBS'>('JOBS');
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setReports(getAllReports().sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  const handleDelete = async (id: string, recordingId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這筆面試紀錄與相關影片嗎？')) {
      deleteReport(id);
      if (recordingId) {
        try {
            await deleteVideo(recordingId);
        } catch (err) {
            console.warn("Could not delete video blob", err);
        }
      }
      setReports(reports.filter(r => r.id !== id));
    }
  };

  const filteredReports = reports.filter(r => 
    r.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.jobTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      {/* Navbar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-purple-600 text-white p-2 rounded-lg font-bold">Ent</div>
            <h1 className="text-xl font-bold text-slate-800">企業招聘管理平台</h1>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={onLogout} className="flex items-center gap-1 text-slate-600 hover:text-red-600 transition-colors text-sm font-medium">
                <LogOut size={16} /> 登出
            </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
            <button 
                onClick={() => setActiveTab('JOBS')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                    activeTab === 'JOBS' 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
                <Briefcase size={18} /> 職缺管理
            </button>
            <button 
                onClick={() => setActiveTab('REPORTS')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                    activeTab === 'REPORTS' 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
                <FileText size={18} /> 面試紀錄
            </button>
        </div>

        {activeTab === 'JOBS' ? (
            <EnterpriseJobBuilder onBack={() => {}} />
        ) : (
            <>
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-1">總面試人數</div>
                        <div className="text-3xl font-bold text-slate-800">{reports.length}</div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-1">平均得分</div>
                        <div className="text-3xl font-bold text-blue-600">
                            {reports.length > 0 ? Math.round(reports.reduce((acc, r) => acc + r.overallScore, 0) / reports.length) : 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm mb-1">建議錄取率</div>
                        <div className="text-3xl font-bold text-green-600">
                            {reports.length > 0 ? Math.round((reports.filter(r => r.hiringRecommendation === 'HIRE').length / reports.length) * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="搜尋候選人姓名或職位..." 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Candidates List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">候選人</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">應徵職位</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">面試時間</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">AI 評分</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">建議</th>
                                <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        尚無面試資料
                                    </td>
                                </tr>
                            ) : (
                                filteredReports.map((report) => (
                                    <tr 
                                        key={report.id} 
                                        onClick={() => onViewReport(report)}
                                        className="hover:bg-purple-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                                                    <User size={16} />
                                                </div>
                                                <span className="font-medium text-slate-900">{report.candidateName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{report.jobTitle}</td>
                                        <td className="px-6 py-4 text-slate-500 text-sm">
                                            <div className="flex items-center gap-1">
                                                <Calendar size={14} />
                                                {new Date(report.timestamp).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded font-bold text-sm ${getScoreColor(report.overallScore)}`}>
                                                {report.overallScore}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                                                report.hiringRecommendation === 'HIRE' ? 'border-green-200 text-green-700 bg-green-50' :
                                                report.hiringRecommendation === 'CONSIDER' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                                                'border-red-200 text-red-700 bg-red-50'
                                            }`}>
                                                {report.hiringRecommendation}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={(e) => handleDelete(report.id, report.recordingId, e)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;