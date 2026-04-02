import React, { useEffect, useState, useRef } from 'react';
import { InterviewReport, NonVerbalSnapshot } from '../types';
import { CheckCircle, AlertTriangle, ArrowLeft, ScanFace, Smile, Video as VideoIcon, User, Bot } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { fetchVideoBlobUrl } from '../services/db';

interface ReportViewProps {
  report: InterviewReport;
  onBack: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<NonVerbalSnapshot | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    const loadVideo = async () => {
      if (!report.videoPath) {
        setVideoUrl(null);
        setVideoError(null);
        return;
      }

      try {
        setVideoError(null);
        const blobUrl = await fetchVideoBlobUrl(report.videoPath);
        if (!mounted) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        objectUrl = blobUrl;
        setVideoUrl(blobUrl);
      } catch (e) {
        console.error('Load video failed', e);
        if (mounted) {
          setVideoUrl(null);
          setVideoError('影片載入失敗，請稍後重試');
        }
      }
    };

    loadVideo();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report.videoPath]);

  // Auto-scroll to active item when index changes
  useEffect(() => {
    if (activeIndex !== -1 && transcriptContainerRef.current) {
        const activeElement = document.getElementById(`transcript-item-${activeIndex}`);
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
    }
  }, [activeIndex]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;

    if (report.fullTranscript && report.fullTranscript.length > 0) {
      const index = report.fullTranscript.findIndex((item, idx) => {
        const nextItem = report.fullTranscript[idx + 1];
        return t >= item.relativeTime && (!nextItem || t < nextItem.relativeTime);
      });
      setActiveIndex((prev) => (prev === index ? prev : index));
    }

    // Find the closest non-verbal snapshot within the last 4 seconds
    if (report.nonVerbalLog) {
      const snap = report.nonVerbalLog.find(s => t >= s.relativeTime && t < s.relativeTime + 4);
      setCurrentSnapshot((prev) => {
        const next = snap || null;
        if (!prev && !next) return prev;
        if (prev && next && prev.timestamp === next.timestamp) return prev;
        return next;
      });
    }
  };

  const jumpToTime = (time: number) => {
    if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, time - 0.5);
        videoRef.current.play();
    }
  };

  // Chart Data Preparation
  const dim = report.dimensionScores;
  const chartData = dim ? [
    { subject: '回答品質', A: dim.answerQuality, fullMark: 100 },
    { subject: '溝通流暢', A: dim.communicationSkill, fullMark: 100 },
    { subject: '職位匹配', A: dim.jobFit, fullMark: 100 },
    { subject: '專業深度', A: dim.professionalDepth, fullMark: 100 },
    { subject: '非語言表現', A: dim.nonVerbalPresence, fullMark: 100 },
  ] : [
    { subject: '回答品質', A: report.overallScore, fullMark: 100 },
    { subject: '溝通流暢', A: report.overallScore, fullMark: 100 },
    { subject: '職位匹配', A: report.overallScore, fullMark: 100 },
    { subject: '專業深度', A: report.questionAnalysis.reduce((acc, q) => acc + q.score, 0) / (report.questionAnalysis.length || 1), fullMark: 100 },
    { subject: '非語言表現', A: report.nonVerbalAnalysis?.bodyLanguageScore || 50, fullMark: 100 },
  ];

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'HIRE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'CONSIDER': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'NO_HIRE': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-noir-400 bg-noir-800';
    }
  };

  const getRecommendationText = (rec: string) => {
    switch (rec) {
      case 'HIRE': return '建議錄用';
      case 'CONSIDER': return '列入考慮';
      case 'NO_HIRE': return '不予錄用';
      default: return rec;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-noir-950 p-4 md:p-8 scroll-elegant">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex justify-between items-center animate-fade-up">
          <div>
            <h1 className="font-display text-3xl font-bold text-noir-50">面試分析報告</h1>
            <p className="text-noir-500 mt-1">{report.candidateName} — {report.jobTitle} ({new Date(report.timestamp).toLocaleDateString()})</p>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 text-noir-400 hover:text-amber-400 transition-colors duration-300 glass-light px-4 py-2 rounded-lg text-sm">
            <ArrowLeft size={18} /> 返回列表
          </button>
        </div>

        {/* Media & Transcript Split View */}
        <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-up animate-fade-up-delay-1">
            {/* Left: Video Player */}
            <div className="w-full lg:w-2/3">
                 {report.videoPath ? (
                    <div className="bg-noir-900 rounded-2xl overflow-hidden border border-noir-800/50 relative group flex flex-col w-full aspect-video glow-amber">
                        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-noir-950/80 to-transparent px-6 py-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                            <VideoIcon size={16} className="text-amber-400" />
                            <span className="text-noir-200 font-medium text-sm">面試錄影回放</span>
                        </div>

                        <div className="flex-1 w-full h-full relative bg-noir-950 flex items-center justify-center">
                            {videoUrl ? (
                                <video
                                    ref={videoRef}
                                    controls
                                    className="w-full h-full object-contain"
                                    src={videoUrl}
                                    onTimeUpdate={handleTimeUpdate}
                                />
                            ) : (
                                <div className="text-noir-600">{videoError || '影片載入中...'}</div>
                            )}

                            {/* Emotion Sync HUD */}
                            {currentSnapshot && (
                                <div className="absolute top-4 right-4 glass text-white p-3 rounded-xl max-w-[200px] z-20 pointer-events-none animate-fade-up">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ScanFace size={14} className="text-amber-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400/80">AI 即時偵測</span>
                                    </div>
                                    <div className="text-lg font-bold text-noir-100 mb-1">{currentSnapshot.expression}</div>
                                    <div className="text-xs text-noir-400 leading-tight">{currentSnapshot.feedback}</div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-noir-900 rounded-2xl w-full aspect-video flex items-center justify-center text-noir-600 border border-noir-800/50">
                        無錄影檔案
                    </div>
                )}
            </div>

            {/* Right: Transcript */}
            <div className="w-full lg:w-1/3 glass-light rounded-2xl flex flex-col overflow-hidden h-[500px] lg:h-[600px]">
                <div className="shrink-0 p-4 border-b border-noir-800/50 font-bold text-noir-300 flex justify-between items-center">
                    <span className="text-sm tracking-wide">逐字稿紀錄</span>
                    <span className="text-xs font-normal text-noir-600">點擊文字跳轉</span>
                </div>
                <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 relative scroll-smooth scroll-elegant">
                    {report.fullTranscript && report.fullTranscript.length > 0 ? (
                        report.fullTranscript.map((item, idx) => {
                             const isActive = idx === activeIndex;

                             return (
                                <div
                                    key={idx}
                                    id={`transcript-item-${idx}`}
                                    onClick={() => jumpToTime(item.relativeTime)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all duration-300 border ${
                                        isActive
                                        ? 'bg-amber-500/5 border-amber-500/20 shadow-sm'
                                        : 'bg-transparent border-transparent hover:bg-noir-800/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {item.role === 'model' ? (
                                            <Bot size={13} className="text-amber-400" />
                                        ) : (
                                            <User size={13} className="text-noir-400" />
                                        )}
                                        <span className={`text-xs font-bold uppercase tracking-wider ${item.role === 'model' ? 'text-amber-400/80' : 'text-noir-500'}`}>
                                            {item.role === 'model' ? 'AI 面試官' : '候選人'}
                                        </span>
                                        <span className="text-xs text-noir-700 ml-auto font-mono">
                                            {Math.floor(item.relativeTime / 60)}:{Math.floor(item.relativeTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <p className={`text-sm leading-relaxed ${isActive ? 'text-noir-200 font-medium' : 'text-noir-500'}`}>
                                        {item.text}
                                    </p>
                                </div>
                             );
                        })
                    ) : (
                        <div className="text-center text-noir-600 mt-10">無逐字稿資料</div>
                    )}
                </div>
            </div>
        </div>

        {/* Top Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up animate-fade-up-delay-2">
          <div className="col-span-1 glass-light p-8 rounded-2xl flex flex-col items-center justify-center">
            <div className="text-xs text-noir-500 mb-3 tracking-widest uppercase">綜合評分</div>
            <div className="text-6xl font-display font-bold text-amber-400">{report.overallScore}</div>
            <div className={`mt-4 px-4 py-1.5 rounded-full border text-sm font-bold ${getRecommendationColor(report.hiringRecommendation)}`}>
              {getRecommendationText(report.hiringRecommendation)}
            </div>
          </div>

          <div className="col-span-2 glass-light p-8 rounded-2xl">
             <h3 className="font-display text-lg font-bold text-noir-100 mb-3">面試官總結</h3>
             <p className="text-noir-400 leading-relaxed">{report.hiringReason}</p>

             <div className="mt-6 grid grid-cols-2 gap-6">
                <div>
                   <h4 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-1 tracking-widest uppercase"><CheckCircle size={13}/> 優勢</h4>
                   <ul className="space-y-1.5">
                     {report.strengths.map((s, i) => <li key={i} className="text-sm text-noir-400 flex gap-2"><span className="text-emerald-500/50 mt-1.5">&#8226;</span> {s}</li>)}
                   </ul>
                </div>
                <div>
                   <h4 className="text-xs font-bold text-red-400 mb-3 flex items-center gap-1 tracking-widest uppercase"><AlertTriangle size={13}/> 待改進</h4>
                   <ul className="space-y-1.5">
                     {report.weaknesses.map((w, i) => <li key={i} className="text-sm text-noir-400 flex gap-2"><span className="text-red-500/50 mt-1.5">&#8226;</span> {w}</li>)}
                   </ul>
                </div>
             </div>
          </div>
        </div>

        {/* Detailed Analysis & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-up animate-fade-up-delay-3">
          {/* Radar Chart */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-light p-6 rounded-2xl min-h-[300px]">
              <h3 className="font-display text-lg font-bold text-noir-100 mb-4 text-center">能力維度分析</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="rgba(196, 154, 61, 0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#8a7f6e', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                    <Radar name="Candidate" dataKey="A" stroke="#d4a857" fill="#d4a857" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-2xl">
                <h4 className="text-xs font-bold text-amber-400 mb-3 tracking-widest uppercase">整體改進建議</h4>
                <p className="text-sm text-noir-400 leading-relaxed">{report.improvementPlan}</p>
            </div>
          </div>

          {/* Right Column: Q&A + Non-Verbal */}
          <div className="lg:col-span-2 space-y-8">

             {/* Non-Verbal Analysis Section */}
             {report.nonVerbalAnalysis && (
               <div className="glass-light p-8 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <ScanFace className="text-amber-400" size={22} />
                    <h3 className="font-display text-xl font-bold text-noir-100">非語言溝通分析</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                     <div className="bg-noir-900/30 p-4 rounded-xl text-center border border-noir-800/30">
                        <div className="text-xs text-noir-500 uppercase tracking-wider mb-1">平均表情狀態</div>
                        <div className="text-lg font-bold text-noir-200">{report.nonVerbalAnalysis.averageExpression}</div>
                     </div>
                     <div className="bg-noir-900/30 p-4 rounded-xl text-center border border-noir-800/30">
                        <div className="text-xs text-noir-500 uppercase tracking-wider mb-1">儀態評分</div>
                        <div className="text-lg font-bold text-amber-400">{report.nonVerbalAnalysis.bodyLanguageScore}<span className="text-noir-600 text-sm">/100</span></div>
                     </div>
                     <div className="bg-noir-900/30 p-4 rounded-xl flex flex-col justify-center border border-noir-800/30">
                         <div className="text-xs text-noir-500 uppercase tracking-wider mb-1 text-center">AI 觀察重點</div>
                         <div className="text-xs text-noir-400 text-center italic">"{report.nonVerbalAnalysis.observations[0]}"</div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <h4 className="text-xs font-bold text-noir-400 mb-3 tracking-widest uppercase">觀察紀錄</h4>
                       <ul className="space-y-2">
                         {report.nonVerbalAnalysis.observations.map((obs, i) => (
                           <li key={i} className="flex gap-2 text-sm text-noir-400">
                             <div className="min-w-[3px] h-3 bg-amber-500/30 rounded-full mt-1.5"></div>
                             {obs}
                           </li>
                         ))}
                       </ul>
                    </div>
                    <div>
                       <h4 className="text-xs font-bold text-noir-400 mb-3 tracking-widest uppercase">改善建議</h4>
                       <ul className="space-y-2">
                         {report.nonVerbalAnalysis.tips.map((tip, i) => (
                           <li key={i} className="flex gap-2 text-sm text-noir-400">
                             <Smile size={13} className="text-amber-500/50 mt-0.5 shrink-0" />
                             {tip}
                           </li>
                         ))}
                       </ul>
                    </div>
                  </div>
               </div>
             )}

             {/* Q&A List */}
             <div className="space-y-4">
               <h3 className="font-display text-xl font-bold text-noir-100">問答詳細分析</h3>
               {report.questionAnalysis.map((qa, idx) => (
                 <div key={idx} className="glass-light p-6 rounded-2xl">
                   <div className="flex justify-between items-start mb-4">
                     <h4 className="font-bold text-noir-200 text-lg flex-1">
                       <span className="text-amber-400 font-mono text-sm mr-2">Q{idx + 1}</span>
                       {qa.question}
                     </h4>
                     <span className={`px-3 py-1 rounded-lg font-mono font-bold text-sm ${qa.score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : (qa.score >= 60 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20')}`}>
                       {qa.score}
                     </span>
                   </div>

                   <div className="mb-4">
                     <div className="text-xs font-bold text-noir-600 uppercase tracking-widest mb-2">您的回答摘要</div>
                     <p className="text-noir-400 bg-noir-900/30 p-3 rounded-lg text-sm border border-noir-800/30">{qa.answerSummary}</p>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-noir-600 uppercase tracking-widest mb-2">AI 點評</div>
                        <p className="text-sm text-noir-400">{qa.feedback}</p>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-noir-600 uppercase tracking-widest mb-2">建議回答方向</div>
                        <p className="text-sm text-amber-400/80 italic">{qa.suggestedAnswer}</p>
                      </div>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportView;
