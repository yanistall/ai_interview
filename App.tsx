import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ForgotPassword from './components/ForgotPassword';
import LandingPage from './components/LandingPage';
import CandidateJobSelector from './components/CandidateJobSelector';
import LiveSession from './components/LiveSession';
import AdminDashboard from './components/AdminDashboard';
import ReportView from './components/ReportView';
import { InterviewConfig, TranscriptItem, InterviewReport, NonVerbalSnapshot } from './types';
import { generateInterviewReport } from './services/claudeService';
import { saveReport } from './services/storageService';
import { saveVideo } from './services/db';
import { Loader2, CheckCircle, LogOut } from 'lucide-react';

type AppState = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'HOME' | 'CANDIDATE_JOB_LIST' | 'SESSION' | 'THANKS' | 'PROCESSING' | 'ADMIN_DASHBOARD' | 'ADMIN_REPORT_DETAIL';

const AppContent: React.FC = () => {
  const { user, isLoading, login, register, logout } = useAuth();
  const [currentState, setCurrentState] = useState<AppState>(user ? 'HOME' : 'LOGIN');
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [selectedReport, setSelectedReport] = useState<InterviewReport | null>(null);

  // Sync auth state
  React.useEffect(() => {
    if (!isLoading) {
      if (user && (currentState === 'LOGIN' || currentState === 'REGISTER' || currentState === 'FORGOT_PASSWORD')) {
        setCurrentState('HOME');
      } else if (!user && currentState !== 'REGISTER' && currentState !== 'FORGOT_PASSWORD') {
        setCurrentState('LOGIN');
      }
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-noir-950">
        <Loader2 size={48} className="animate-spin text-amber-400" />
      </div>
    );
  }

  // --- Auth Handlers ---
  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
  };

  const handleRegister = async (email: string, password: string, name: string, role: 'CANDIDATE' | 'ADMIN') => {
    await register(email, password, name, role);
  };

  const handleLogout = () => {
    logout();
    setConfig(null);
    setSelectedReport(null);
    setCurrentState('LOGIN');
  };

  // --- Navigation Handlers ---
  const handleSelectRole = (role: 'CANDIDATE' | 'ENTERPRISE') => {
    if (role === 'CANDIDATE') {
      setCurrentState('CANDIDATE_JOB_LIST');
    } else {
      if (user?.role !== 'ADMIN') {
        alert('您沒有管理員權限');
        return;
      }
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
      // 1. Upload video if exists
      let videoPath: string | undefined = undefined;
      if (videoBlob) {
        videoPath = await saveVideo(videoBlob);
      }

      // 2. Generate report using Claude (via backend)
      const generatedReport = await generateInterviewReport(
        transcript,
        nonVerbalSnapshots,
        config.jobTitle,
        config.candidateName,
        config.jobDescription
      );

      // 3. Save report to DB (with video path)
      await saveReport({
        ...generatedReport,
        videoPath,
        jobProfileId: config.jobId,
      });

      // 4. Show Thanks screen
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

  const isLoggedIn = user && !['LOGIN', 'REGISTER', 'FORGOT_PASSWORD'].includes(currentState);

  // --- Views ---
  return (
    <div className="w-full h-full relative">
      {isLoggedIn && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <span className="text-noir-400 text-sm">{user.name}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-noir-800/60 border border-noir-700/40 text-noir-400 hover:text-amber-400 hover:border-amber-500/30 transition-all duration-300 text-sm"
          >
            <LogOut size={14} />
            登出
          </button>
        </div>
      )}

      {currentState === 'LOGIN' && (
        <LoginPage
          onLogin={handleLogin}
          onGoToRegister={() => setCurrentState('REGISTER')}
          onGoToForgotPassword={() => setCurrentState('FORGOT_PASSWORD')}
        />
      )}

      {currentState === 'REGISTER' && (
        <RegisterPage
          onRegister={handleRegister}
          onGoToLogin={() => setCurrentState('LOGIN')}
        />
      )}

      {currentState === 'FORGOT_PASSWORD' && (
        <ForgotPassword onGoToLogin={() => setCurrentState('LOGIN')} />
      )}

      {currentState === 'HOME' && (
        <LandingPage onSelectRole={handleSelectRole} />
      )}

      {currentState === 'CANDIDATE_JOB_LIST' && (
        <CandidateJobSelector onStartInterview={handleCandidateStart} onBack={() => setCurrentState('HOME')} />
      )}

      {currentState === 'SESSION' && config && (
        <LiveSession config={config} onEndSession={handleEndSession} />
      )}

      {currentState === 'PROCESSING' && (
        <div className="flex flex-col items-center justify-center h-full bg-noir-950 text-white relative">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]"></div>
          </div>
          <div className="relative animate-fade-up">
            <Loader2 size={56} className="animate-spin text-amber-400 mb-8 mx-auto" />
            <h2 className="font-display text-3xl font-bold text-noir-50 text-center">正在將您的面試資料傳送至人資部門...</h2>
            <p className="text-noir-500 mt-3 text-center">AI 正在整理對話紀錄、影片存檔與表情分析數據</p>
          </div>
        </div>
      )}

      {currentState === 'THANKS' && (
        <div className="flex flex-col items-center justify-center h-full bg-noir-950 p-8 text-center relative">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]"></div>
          </div>
          <div className="relative animate-fade-up">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-8 mx-auto">
              <CheckCircle size={44} className="text-emerald-400" />
            </div>
            <h2 className="font-display text-4xl font-bold mb-4 text-noir-50">面試已完成！</h2>
            <p className="text-lg text-noir-400 mb-10 max-w-lg leading-relaxed">
              感謝您的參與。您的面試錄影與 AI 分析報告已成功上傳至企業人才庫。HR 部門將在近期與您聯繫。
            </p>
            <button
              onClick={() => setCurrentState('HOME')}
              className="px-10 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-full font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300 shadow-lg shadow-amber-500/10"
            >
              返回首頁
            </button>
          </div>
        </div>
      )}

      {currentState === 'ADMIN_DASHBOARD' && (
        <AdminDashboard onViewReport={handleAdminViewReport} onLogout={handleLogout} />
      )}

      {currentState === 'ADMIN_REPORT_DETAIL' && selectedReport && (
        <ReportView report={selectedReport} onBack={handleBackToDashboard} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
