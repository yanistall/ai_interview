import React, { useEffect, useState, useRef } from 'react';
import { InterviewReport, NonVerbalSnapshot } from '../types';
import { CheckCircle, AlertTriangle, ArrowLeft, ScanFace, Smile, Video as VideoIcon, User, Bot } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { getVideo } from '../services/db';

interface ReportViewProps {
  report: InterviewReport;
  onBack: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSnapshot, setCurrentSnapshot] = useState<NonVerbalSnapshot | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadVideo = async () => {
      if (report.recordingId) {
        try {
          const blob = await getVideo(report.recordingId);
          if (blob) {
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
          }
        } catch (e) {
          console.error("Failed to load video", e);
        }
      }
    };
    loadVideo();

    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [report.recordingId]);

  // Determine active transcript index based on current time
  useEffect(() => {
    if (!report.fullTranscript) return;
    const index = report.fullTranscript.findIndex((item, idx) => {
        const nextItem = report.fullTranscript[idx + 1];
        return currentTime >= item.relativeTime && (!nextItem || currentTime < nextItem.relativeTime);
    });
    setActiveIndex(index);
  }, [currentTime, report.fullTranscript]);

  // Auto-scroll to active item when index changes
  useEffect(() => {
    if (activeIndex !== -1 && transcriptContainerRef.current) {
        const activeElement = document.getElementById(`transcript-item-${activeIndex}`);
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [activeIndex]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    setCurrentTime(t);

    // Find the closest non-verbal snapshot within the last 4 seconds
    if (report.nonVerbalLog) {
      const snap = report.nonVerbalLog.find(s => t >= s.relativeTime && t < s.relativeTime + 4);
      setCurrentSnapshot(snap || null);
    }
  };

  const jumpToTime = (time: number) => {
    if (videoRef.current) {
        // Add a small buffer to ensure we hear the start of the sentence
        videoRef.current.currentTime = Math.max(0, time - 0.5);
        videoRef.current.play();
    }
  };

  // Chart Data Preparation
  const chartData = [
    { subject: '回答品質', A: report.overallScore, fullMark: 100 },
    { subject: '溝通流暢', A: Math.min(100, report.overallScore + (Math.random() * 10 - 5)), fullMark: 100 },
    { subject: '職位匹配', A: report.hiringRecommendation === 'HIRE' ? 90 : (report.hiringRecommendation === 'CONSIDER' ? 70 : 50), fullMark: 100 },
    { subject: '專業深度', A: report.questionAnalysis.reduce((acc, q) => acc + q.score, 0) / report.questionAnalysis.length, fullMark: 100 },
    { subject: '非語言表現', A: report.nonVerbalAnalysis?.bodyLanguageScore || 75, fullMark: 100 },
  ];

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'HIRE': return 'text-green-600 bg-green-100 border-green-200';
      case 'CONSIDER': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'NO_HIRE': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-slate-600 bg-slate-100';
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
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">面試分析報告</h1>
            <p className="text-slate-500 mt-1">{report.candidateName} - {report.jobTitle} ({new Date(report.timestamp).toLocaleDateString()})</p>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
            <ArrowLeft size={20} /> 返回列表
          </button>
        </div>
        
        {/* Media & Transcript Split View - New Flex Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left: Video Player (16:9 Aspect Ratio enforced) */}
            <div className="w-full lg:w-2/3">
                 {report.recordingId ? (
                    <div className="bg-black rounded-2xl shadow-lg overflow-hidden border border-slate-800 relative group flex flex-col w-full aspect-video">
                        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent px-6 py-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <VideoIcon size={18} className="text-blue-400" />
                            <span className="text-white font-semibold">面試錄影回放</span>
                        </div>
                        
                        <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
                            {videoUrl ? (
                                <video 
                                    ref={videoRef}
                                    controls 
                                    className="w-full h-full object-contain" 
                                    src={videoUrl} 
                                    onTimeUpdate={handleTimeUpdate}
                                />
                            ) : (
                                <div className="text-slate-500">影片載入中...</div>
                            )}

                            {/* Emotion Sync HUD (Only visible here for Enterprise) */}
                            {currentSnapshot && (
                                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white p-3 rounded-xl border border-white/10 animate-in fade-in slide-in-from-right duration-300 max-w-[200px] z-20 pointer-events-none">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ScanFace size={16} className="text-blue-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-200">AI 即時偵測</span>
                                    </div>
                                    <div className="text-xl font-bold mb-1">{currentSnapshot.expression}</div>
                                    <div className="text-xs text-slate-300 leading-tight">{currentSnapshot.feedback}</div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-200 rounded-2xl w-full aspect-video flex items-center justify-center text-slate-500">
                        無錄影檔案
                    </div>
                )}
            </div>

            {/* Right: Transcript (Fixed height with scrollbar) */}
            <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[500px] lg:h-[600px]">
                <div className="shrink-0 p-4 border-b border-slate-100 font-bold text-slate-700 bg-slate-50 flex justify-between items-center">
                    <span>逐字稿紀錄</span>
                    <span className="text-xs font-normal text-slate-400">點擊文字跳轉</span>
                </div>
                <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative scroll-smooth">
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
                                        ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' 
                                        : 'bg-transparent border-transparent hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {item.role === 'model' ? (
                                            <Bot size={14} className="text-purple-600" />
                                        ) : (
                                            <User size={14} className="text-blue-600" />
                                        )}
                                        <span className={`text-xs font-bold uppercase ${item.role === 'model' ? 'text-purple-600' : 'text-blue-600'}`}>
                                            {item.role === 'model' ? 'AI 面試官' : '候選人'}
                                        </span>
                                        <span className="text-xs text-slate-400 ml-auto">
                                            {Math.floor(item.relativeTime / 60)}:{Math.floor(item.relativeTime % 60).toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${isActive ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
                                        {item.text}
                                    </p>
                                </div>
                             );
                        })
                    ) : (
                        <div className="text-center text-slate-400 mt-10">無逐字稿資料</div>
                    )}
                </div>
            </div>
        </div>

        {/* Top Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <div className="text-sm text-slate-500 mb-2">綜合評分</div>
            <div className="text-6xl font-black text-blue-600">{report.overallScore}</div>
            <div className={`mt-4 px-4 py-1.5 rounded-full border text-sm font-bold ${getRecommendationColor(report.hiringRecommendation)}`}>
              {getRecommendationText(report.hiringRecommendation)}
            </div>
          </div>
          
          <div className="col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-800 mb-3">面試官總結</h3>
             <p className="text-slate-600 leading-relaxed">{report.hiringReason}</p>
             
             <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                   <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1"><CheckCircle size={14}/> 優勢</h4>
                   <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                     {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
                   </ul>
                </div>
                <div>
                   <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle size={14}/> 待改進</h4>
                   <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                     {report.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                   </ul>
                </div>
             </div>
          </div>
        </div>

        {/* Detailed Analysis & Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Radar Chart */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]">
              <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">能力維度分析</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                    <Radar name="Candidate" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100">
                <h4 className="text-sm font-bold text-blue-900 mb-2">整體改進建議</h4>
                <p className="text-sm text-blue-800 leading-relaxed">{report.improvementPlan}</p>
            </div>
          </div>

          {/* Right Column: Q&A + Non-Verbal */}
          <div className="lg:col-span-2 space-y-8">
             
             {/* Non-Verbal Analysis Section */}
             {report.nonVerbalAnalysis && (
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <ScanFace className="text-blue-600" size={24} />
                    <h3 className="text-xl font-bold text-slate-800">非語言溝通分析 (Body Language)</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                     <div className="bg-slate-50 p-4 rounded-xl text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">平均表情狀態</div>
                        <div className="text-lg font-bold text-slate-800">{report.nonVerbalAnalysis.averageExpression}</div>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl text-center">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">儀態評分</div>
                        <div className="text-lg font-bold text-blue-600">{report.nonVerbalAnalysis.bodyLanguageScore}/100</div>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl flex flex-col justify-center">
                         <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 text-center">AI 觀察重點</div>
                         <div className="text-xs text-slate-700 text-center italic">"{report.nonVerbalAnalysis.observations[0]}"</div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">觀察紀錄</h4>
                       <ul className="space-y-2">
                         {report.nonVerbalAnalysis.observations.map((obs, i) => (
                           <li key={i} className="flex gap-2 text-sm text-slate-600">
                             <div className="min-w-[4px] h-4 bg-blue-300 rounded-full mt-1"></div>
                             {obs}
                           </li>
                         ))}
                       </ul>
                    </div>
                    <div>
                       <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">改善建議</h4>
                       <ul className="space-y-2">
                         {report.nonVerbalAnalysis.tips.map((tip, i) => (
                           <li key={i} className="flex gap-2 text-sm text-slate-600">
                             <Smile size={14} className="text-orange-400 mt-0.5 shrink-0" />
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
               <h3 className="text-xl font-bold text-slate-800">問答詳細分析</h3>
               {report.questionAnalysis.map((qa, idx) => (
                 <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <div className="flex justify-between items-start mb-3">
                     <h4 className="font-bold text-slate-800 text-lg flex-1">Q{idx + 1}: {qa.question}</h4>
                     <span className={`px-3 py-1 rounded text-sm font-bold ${qa.score >= 80 ? 'bg-green-100 text-green-700' : (qa.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}`}>
                       {qa.score}分
                     </span>
                   </div>
                   
                   <div className="mb-4">
                     <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">您的回答摘要</div>
                     <p className="text-slate-600 bg-slate-50 p-3 rounded-lg text-sm">{qa.answerSummary}</p>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">AI 點評</div>
                        <p className="text-sm text-slate-700">{qa.feedback}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">建議回答方向</div>
                        <p className="text-sm text-blue-700 italic">{qa.suggestedAnswer}</p>
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