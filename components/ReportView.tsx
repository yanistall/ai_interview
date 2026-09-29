import React, { useEffect, useState, useRef } from 'react';
import { InterviewReport, AssessmentLevel, DimensionCode, EvidenceReference, EvidenceSufficiency, TechnicalQualityStatus, TranscriptItem } from '../types';
import { ArrowLeft, Video as VideoIcon, User, Bot } from 'lucide-react';
import { fetchVideoToken } from '../services/db';

interface ReportViewProps {
  report: InterviewReport;
  onBack: () => void;
}

const dimensionLabels: Record<DimensionCode, string> = {
  ANSWER_EVIDENCE: '回答具體度與證據',
  CONTENT_CLARITY: '內容組織與可理解性',
  JOB_COMPETENCY_MATCH: '職務能力匹配',
  PROFESSIONAL_DEPTH: '專業深度與問題解決',
};
const dimensionOrder: DimensionCode[] = ['ANSWER_EVIDENCE', 'CONTENT_CLARITY', 'JOB_COMPETENCY_MATCH', 'PROFESSIONAL_DEPTH'];
const levelLabels: Record<AssessmentLevel, string> = {
  DEVELOPING: '發展中', BASIC: '基本達標', PROFICIENT: '穩定展現', DISTINCT_STRENGTH: '明確優勢',
};
const sufficiencyLabels: Record<EvidenceSufficiency, string> = {
  SUFFICIENT: '充分', PARTIAL: '部分', INSUFFICIENT: '不足',
};
const technicalQualityLabels: Record<TechnicalQualityStatus, string> = {
  CLEAR: '未發現明顯干擾', MINOR_ISSUES: '疑似局部技術或轉錄干擾',
  PARTIAL: '部分內容無法可靠判定', SEVERE: '整體資訊不足，建議重新練習',
};

export const findEvidenceTranscriptIndex = (transcript: TranscriptItem[], time: number, itemId?: string): number => {
  if (itemId) {
    const index = transcript.findIndex(item => item.itemId === itemId);
    if (index >= 0) return index;
  }
  // Preserve exact timestamps; do not infer another turn from quoted words.
  return transcript.reduce((closest, item, index) => (
    closest === -1 || Math.abs(item.relativeTime - time) < Math.abs(transcript[closest].relativeTime - time)
      ? index : closest
  ), -1);
};

const ReportView: React.FC<ReportViewProps> = ({ report, onBack }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadVideo = async () => {
      if (!report.videoPath) {
        setVideoUrl(null);
        setVideoError(null);
        return;
      }

      try {
        setVideoError(null);
        const token = await fetchVideoToken(report.videoPath);
        if (!mounted) return;
        setVideoUrl(`/api/videos/${report.videoPath}?token=${token}`);
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

  };

  const jumpToTime = (time: number, itemId?: string) => {
    const index = findEvidenceTranscriptIndex(report.fullTranscript, time, itemId);
    setActiveIndex(index);
    if (index >= 0) {
      transcriptContainerRef.current?.querySelector(`#transcript-item-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, time);
        void videoRef.current.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
    }
  };

  const { assessment } = report;
  const renderEvidence = (references: EvidenceReference[]) => references.length ? (
    <ul className="space-y-3">
      {references.map((evidence, index) => (
        <li key={index} className="border-l-2 border-amber-500/30 pl-3">
          <blockquote className="text-noir-200 text-sm leading-relaxed">「{evidence.quote}」</blockquote>
          <p className="text-sm text-noir-400 mt-1">{evidence.rationale}</p>
          <button type="button" onClick={() => jumpToTime(evidence.relativeTime, evidence.transcriptItemId)} className="text-sm text-amber-400 mt-2 hover:underline">
            {report.videoPath ? '播放／查看逐字稿' : '查看逐字稿'} {Math.floor(evidence.relativeTime / 60)}:{Math.floor(evidence.relativeTime % 60).toString().padStart(2, '0')}
          </button>
        </li>
      ))}
    </ul>
  ) : <p className="text-sm text-noir-500">目前沒有可引用的回答證據。</p>;

  return (
    <div className="h-full overflow-y-auto bg-noir-950 p-4 md:p-8 scroll-elegant">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex justify-between items-center animate-fade-up">
          <div>
            <h1 className="font-display text-3xl font-bold text-noir-50">四級能力報告</h1>
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
                            {activeIndex >= 0 && report.fullTranscript[activeIndex] && (
                                <div className="absolute bottom-14 left-4 right-4 z-10 text-center pointer-events-none">
                                    <span className="inline-block max-w-full px-3 py-1.5 rounded bg-black/85 text-white text-sm md:text-base leading-relaxed break-words">
                                        {report.fullTranscript[activeIndex].text}
                                    </span>
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
                                    onClick={() => jumpToTime(item.relativeTime, item.itemId)}
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

        <section className="glass-light p-6 md:p-8 rounded-2xl animate-fade-up animate-fade-up-delay-2" aria-labelledby="practice-summary">
          <h2 id="practice-summary" className="font-display text-xl font-bold text-noir-100 mb-3">本次練習摘要</h2>
          <p className="text-noir-300 leading-relaxed">{assessment.summary}</p>
        </section>

        <section className="glass-light p-6 rounded-2xl space-y-3" aria-labelledby="technical-quality">
          <h2 id="technical-quality" className="font-display text-lg font-bold text-noir-100">錄音與逐字稿品質提醒</h2>
          <p className="text-sm text-noir-300">{technicalQualityLabels[assessment.technicalQuality.status]}</p>
          <p className="text-sm text-noir-500">疑似技術或轉錄干擾僅作資料品質提醒，不代表能力不足，也不影響能力等級。</p>
          {assessment.technicalQuality.notes.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-noir-400 space-y-1">
              {assessment.technicalQuality.notes.map((note, index) => <li key={index}>{note}</li>)}
            </ul>
          )}
          {assessment.technicalQuality.affectedTranscriptRefs.length > 0 && renderEvidence(assessment.technicalQuality.affectedTranscriptRefs)}
        </section>

        <section aria-label="四項能力評測" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dimensionOrder.map(code => {
            const dimension = assessment.dimensions.find(item => item.code === code)!;
            return (
              <article key={code} className="glass-light p-6 rounded-2xl space-y-5" aria-labelledby={`dimension-${code}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 id={`dimension-${code}`} className="font-display text-lg font-bold text-noir-100">{dimensionLabels[code]}</h2>
                  {dimension.status === 'NOT_ASSESSABLE' ? (
                    <span className="text-sm text-noir-400">無法判定</span>
                  ) : dimension.level && (
                    <span className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">{levelLabels[dimension.level]}</span>
                  )}
                </div>
                <p className="text-sm text-noir-400">證據充分度：{sufficiencyLabels[dimension.evidenceSufficiency]}</p>
                <div>
                  <h3 className="text-sm font-bold text-noir-200 mb-2">判定證據</h3>
                  {renderEvidence(dimension.evidence)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-noir-200 mb-2">缺少內容</h3>
                  {dimension.missingEvidence.length ? (
                    <ul className="list-disc pl-5 text-sm text-noir-400 space-y-1">
                      {dimension.missingEvidence.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  ) : <p className="text-sm text-noir-500">本次未列出需補充的內容。</p>}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-400 mb-2">下一步行動</h3>
                  {dimension.nextActions.length ? (
                    <ul className="list-disc pl-5 text-sm text-noir-300 space-y-1">
                      {dimension.nextActions.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  ) : <p className="text-sm text-noir-500">本次未列出其他行動。</p>}
                </div>
              </article>
            );
          })}
        </section>

        <section className="space-y-4" aria-labelledby="question-analysis">
          <h2 id="question-analysis" className="font-display text-xl font-bold text-noir-100">問答詳細分析</h2>
          {assessment.questionAnalyses.map((qa, index) => (
            <article key={index} className="glass-light p-6 rounded-2xl space-y-4">
              <h3 className="font-bold text-noir-200 text-lg"><span className="text-amber-400 font-mono text-sm mr-2">Q{index + 1}</span>{qa.question}</h3>
              <div>
                <h4 className="text-sm font-bold text-noir-200 mb-2">您的回答摘要</h4>
                <p className="text-noir-400 text-sm leading-relaxed">{qa.answerSummary}</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="職務能力標籤">
                {qa.competencyTags.map((tag, tagIndex) => <span key={tagIndex} className="text-xs text-noir-300 bg-noir-800/50 px-3 py-1 rounded-full">{tag}</span>)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-noir-200 mb-2">回答證據</h4>
                {renderEvidence(qa.evidence)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-400 mb-2">下一步行動</h4>
                <p className="text-sm text-noir-300">{qa.nextAction}</p>
              </div>
            </article>
          ))}
          {assessment.questionAnalyses.length === 0 && <p className="text-sm text-noir-500">本次沒有可分析的完整問答。</p>}
        </section>
      </div>
    </div>
  );
};

export default ReportView;
