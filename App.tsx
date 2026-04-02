import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import ForgotPassword from './components/ForgotPassword';
import LiveSession from './components/LiveSession';
import ReportView from './components/ReportView';
import CandidateWorkspace from './components/CandidateWorkspace';
import EnterpriseWorkspace from './components/EnterpriseWorkspace';
import { InterviewConfig, TranscriptItem, InterviewReport, NonVerbalSnapshot } from './types';
import { generateInterviewReport } from './services/claudeService';
import { saveReport } from './services/storageService';
import { saveVideo } from './services/db';
import { Loader2, CheckCircle, LogOut, User, Building2 } from 'lucide-react';

type AppState = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD' | 'PORTAL' | 'SESSION' | 'THANKS' | 'PROCESSING' | 'REPORT_DETAIL';

const AppContent: React.FC = () => {
  const { user, isLoading, login, register, logout } = useAuth();
  const [currentState, setCurrentState] = useState<AppState>(user ? 'PORTAL' : 'LOGIN');
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [selectedReport, setSelectedReport] = useState<InterviewReport | null>(null);
  const [adminPortalMode, setAdminPortalMode] = useState<'PICK' | 'CANDIDATE' | 'ENTERPRISE'>('PICK');

  // Sync auth state
  React.useEffect(() => {
    if (!isLoading) {
      if (user && (currentState === 'LOGIN' || currentState === 'REGISTER' || currentState === 'FORGOT_PASSWORD')) {
        setCurrentState('PORTAL');
        if (user.role === 'ADMIN') setAdminPortalMode('PICK');
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

  const handleRegister = async (email: string, password: string, name: string, role: 'CANDIDATE' | 'ENTERPRISE') => {
    await register(email, password, name, role);
  };

  const handleLogout = () => {
    logout();
    setConfig(null);
    setSelectedReport(null);
    setAdminPortalMode('PICK');
    setCurrentState('LOGIN');
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
      setCurrentState('PORTAL');
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
      setCurrentState('PORTAL');
    }
  };

  const handleAdminViewReport = (report: InterviewReport) => {
    setSelectedReport(report);
    setCurrentState('REPORT_DETAIL');
  };

  const handleBackToDashboard = () => {
    setSelectedReport(null);
    setCurrentState('PORTAL');
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

      {currentState === 'PORTAL' && user?.role === 'CANDIDATE' && (
        <CandidateWorkspace
          userName={user.name}
          onStartInterview={handleCandidateStart}
          onViewReport={handleAdminViewReport}
        />
      )}

      {currentState === 'PORTAL' && user?.role === 'ENTERPRISE' && (
        <EnterpriseWorkspace onViewReport={handleAdminViewReport} mode="enterprise" />
      )}

      {currentState === 'PORTAL' && user?.role === 'ADMIN' && adminPortalMode === 'PICK' && (
        <div className="min-h-full flex flex-col items-center justify-center bg-noir-950 p-6 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-amber-600/3 rounded-full blur-[100px]"></div>
          </div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent"></div>

          <div className="text-center mb-14 relative animate-fade-up">
            <div className="text-amber-400/60 text-xs tracking-[0.4em] uppercase mb-4 font-medium">Admin Control Center</div>
            <h1 className="font-display text-6xl md:text-7xl font-bold text-noir-50 tracking-tight mb-4">
              AI <span className="text-amber-400 italic">Interview</span> 管理台
            </h1>
            <p className="text-noir-400 text-lg">請選擇要進入的端別</p>
          </div>

          <div className="max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <button
              onClick={() => setAdminPortalMode('CANDIDATE')}
              className="group relative overflow-hidden glass-light rounded-2xl p-10 transition-all duration-500 hover:bg-white/[0.06] text-left animate-fade-up animate-fade-up-delay-1"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 to-transparent"></div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <User className="text-amber-400" size={22} />
              </div>
              <h2 className="font-display text-3xl font-bold text-noir-100 mb-3">求職端入口</h2>
              <p className="text-noir-400 leading-relaxed text-sm">以候選人視角查看職缺、個人檔案與歷史面試紀錄。</p>
              <div className="mt-8 flex items-center text-amber-400 font-medium text-sm group-hover:translate-x-2 transition-transform duration-500 tracking-wide">
                進入求職端 <span className="ml-2">&rarr;</span>
              </div>
            </button>

            <button
              onClick={() => setAdminPortalMode('ENTERPRISE')}
              className="group relative overflow-hidden glass-light rounded-2xl p-10 transition-all duration-500 hover:bg-white/[0.06] text-left animate-fade-up animate-fade-up-delay-2"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 to-transparent"></div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <Building2 className="text-amber-400" size={22} />
              </div>
              <h2 className="font-display text-3xl font-bold text-noir-100 mb-3">企業端入口</h2>
              <p className="text-noir-400 leading-relaxed text-sm">管理職缺、檢視面試紀錄與企業後台資料。</p>
              <div className="mt-8 flex items-center text-amber-400 font-medium text-sm group-hover:translate-x-2 transition-transform duration-500 tracking-wide">
                進入企業端 <span className="ml-2">&rarr;</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {currentState === 'PORTAL' && user?.role === 'ADMIN' && adminPortalMode === 'CANDIDATE' && (
        <div className="h-full">
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => setAdminPortalMode('PICK')}
              className="px-3 py-1.5 rounded-lg bg-noir-800/70 border border-noir-700/50 text-noir-300 text-sm"
            >
              返回入口選擇
            </button>
          </div>
          <CandidateWorkspace
            userName={user.name}
            onStartInterview={handleCandidateStart}
            onViewReport={handleAdminViewReport}
          />
        </div>
      )}

      {currentState === 'PORTAL' && user?.role === 'ADMIN' && adminPortalMode === 'ENTERPRISE' && (
        <div className="h-full">
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => setAdminPortalMode('PICK')}
              className="px-3 py-1.5 rounded-lg bg-noir-800/70 border border-noir-700/50 text-noir-300 text-sm"
            >
              返回入口選擇
            </button>
          </div>
          <EnterpriseWorkspace onViewReport={handleAdminViewReport} mode="admin" />
        </div>
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
              onClick={() => setCurrentState('PORTAL')}
              className="px-10 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-noir-950 rounded-full font-bold hover:from-amber-400 hover:to-amber-500 transition-all duration-300 shadow-lg shadow-amber-500/10"
            >
              返回工作台
            </button>
          </div>
        </div>
      )}

      {currentState === 'REPORT_DETAIL' && selectedReport && (
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
