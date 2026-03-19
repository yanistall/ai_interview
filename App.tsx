import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import CandidateJobSelector from './components/CandidateJobSelector';
import LiveSession from './components/LiveSession';
import AdminDashboard from './components/AdminDashboard';
import ReportView from './components/ReportView';
import { InterviewConfig, TranscriptItem, InterviewReport, NonVerbalSnapshot } from './types';
import { generateInterviewReport } from './services/claudeService';
import { saveReport } from './services/storageService';
import { saveVideo } from './services/db';
import { Loader2, CheckCircle } from 'lucide-react';

type AppState = 'HOME' | 'CANDIDATE_JOB_LIST' | 'SESSION' | 'THANKS' | 'PROCESSING' | 'ADMIN_DASHBOARD' | 'ADMIN_REPORT_DETAIL';

const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<AppState>('HOME');
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [selectedReport, setSelectedReport] = useState<InterviewReport | null>(null);

  // --- Navigation Handlers ---
  const handleSelectRole = (role: 'CANDIDATE' | 'ENTERPRISE') => {
    if (role === 'CANDIDATE') {
      setCurrentState('CANDIDATE_JOB_LIST');
    } else {
      setCurrentState('ADMIN_DASHBOARD');
    }
  };

  const handleCandidateStart = (newConfig: InterviewConfig) => {
    setConfig(newConfig);
    setCurrentState('SESSION');
  };

  const handleEndSession = async (
    transcript: TranscriptItem[], 
    nonVerbalSnapshots: NonVerbalSnapshot[], 
    videoBlob: Blob | null
  ) => {
    if (!config) return;

    if (transcript.length === 0) {
      alert("沒有檢測到對話內容，面試已取消。");
      setCurrentState('HOME');
      return;
    }

    setCurrentState('PROCESSING');
    try {
      // 1. Save Video if exists
      let recordingId: string | undefined = undefined;
      if (videoBlob) {
        recordingId = await saveVideo(videoBlob);
      }

      // 2. Generate report using Gemini
      // Note: generateInterviewReport now expects the same arguments but handles saving them to the report object internally
      const generatedReport = await generateInterviewReport(
        transcript, 
        nonVerbalSnapshots, 
        config.jobTitle, 
        config.candidateName
      );
      
      // 3. Attach recording ID to report
      if (recordingId) {
        generatedReport.recordingId = recordingId;
      }
      
      // 4. Save to "Mock DB"
      saveReport(generatedReport);
      
      // 5. Show Thanks screen
      setCurrentState('THANKS');
    } catch (error) {
      console.error("Report generation failed", error);
      alert("資料處理失敗，請重試。");
      setCurrentState('HOME');
    }
  };

  const handleAdminViewReport = (report: InterviewReport) => {
    setSelectedReport(report);
    setCurrentState('ADMIN_REPORT_DETAIL');
  };

  const handleBackToDashboard = () => {
    setSelectedReport(null);
    setCurrentState('ADMIN_DASHBOARD');
  };

  const handleLogout = () => {
    setConfig(null);
    setSelectedReport(null);
    setCurrentState('HOME');
  };

  // --- Views ---

  return (
    <div className="w-full h-full">
      {/* 1. Home / Landing */}
      {currentState === 'HOME' && (
        <LandingPage onSelectRole={handleSelectRole} />
      )}

      {/* 2. Candidate Flow: Job Selection */}
      {currentState === 'CANDIDATE_JOB_LIST' && (
        <CandidateJobSelector onStartInterview={handleCandidateStart} onBack={() => setCurrentState('HOME')} />
      )}

      {/* 3. Candidate Flow: Live Session */}
      {currentState === 'SESSION' && config && (
        <LiveSession config={config} onEndSession={handleEndSession} />
      )}

      {/* 4. Candidate Flow: Processing */}
      {currentState === 'PROCESSING' && (
        <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white">
          <Loader2 size={64} className="animate-spin text-blue-500 mb-6" />
          <h2 className="text-3xl font-bold">正在將您的面試資料傳送至人資部門...</h2>
          <p className="text-slate-400 mt-2">AI 正在整理對話紀錄、影片存檔與表情分析數據</p>
        </div>
      )}

      {/* 5. Candidate Flow: Thanks */}
      {currentState === 'THANKS' && (
        <div className="flex flex-col items-center justify-center h-full bg-white text-slate-800 p-8 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={48} className="text-green-600" />
          </div>
          <h2 className="text-4xl font-bold mb-4">面試已完成！</h2>
          <p className="text-xl text-slate-600 mb-8 max-w-lg">
            感謝您的參與。您的面試錄影與 AI 分析報告已成功上傳至企業人才庫。HR 部門將在近期與您聯繫。
          </p>
          <button 
            onClick={handleLogout}
            className="px-8 py-3 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-700 transition-colors"
          >
            返回首頁
          </button>
        </div>
      )}

      {/* 6. Admin Flow: Dashboard */}
      {currentState === 'ADMIN_DASHBOARD' && (
        <AdminDashboard onViewReport={handleAdminViewReport} onLogout={handleLogout} />
      )}

      {/* 7. Admin Flow: Report Detail */}
      {currentState === 'ADMIN_REPORT_DETAIL' && selectedReport && (
        <ReportView report={selectedReport} onBack={handleBackToDashboard} />
      )}
    </div>
  );
};

export default App;