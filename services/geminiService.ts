import { GoogleGenAI, Type } from "@google/genai";
import { InterviewReport, TranscriptItem, NonVerbalSnapshot } from "../types";

const API_KEY = process.env.API_KEY || '';

export const generateInterviewReport = async (
  transcript: TranscriptItem[],
  nonVerbalSnapshots: NonVerbalSnapshot[],
  jobTitle: string,
  candidateName: string
): Promise<InterviewReport> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Format transcript for the prompt
  const conversationText = transcript
    .map((t) => `${t.role === 'model' ? 'Interviewer' : 'Candidate'}: ${t.text}`)
    .join('\n');

  // Format non-verbal logs
  const nonVerbalLog = nonVerbalSnapshots
    .map(s => `[Time: ${s.relativeTime.toFixed(1)}s] Expression: ${s.expression}, Feedback: ${s.feedback}`)
    .join('\n');

  const prompt = `
    You are an expert HR Interview Specialist for a top-tier Taiwanese company.
    Analyze the following interview transcript and non-verbal cues for the position of "${jobTitle}".
    Candidate Name: "${candidateName}"
    
    Transcript:
    ${conversationText}

    Non-Verbal Observations Log (Snapshots taken during interview):
    ${nonVerbalLog}

    Please provide a detailed structured evaluation in Traditional Chinese (Taiwanese context).
    
    Important:
    1. Base the 'questionAnalysis' on the text transcript.
    2. Base the 'nonVerbalAnalysis' on the provided Non-Verbal Observations Log.
    
    Return the response in strictly valid JSON format matching the schema provided.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER, description: "Score from 0-100" },
            hiringRecommendation: { type: Type.STRING, enum: ["HIRE", "CONSIDER", "NO_HIRE"] },
            hiringReason: { type: Type.STRING, description: "Short summary of why this decision was made." },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvementPlan: { type: Type.STRING, description: "Detailed advice for improvement." },
            questionAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answerSummary: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  feedback: { type: Type.STRING },
                  suggestedAnswer: { type: Type.STRING },
                },
                required: ["question", "answerSummary", "score", "feedback", "suggestedAnswer"]
              }
            },
            nonVerbalAnalysis: {
              type: Type.OBJECT,
              properties: {
                averageExpression: { type: Type.STRING, description: "E.g., Confident, Nervous, Serious" },
                bodyLanguageScore: { type: Type.INTEGER, description: "0-100 score on presentation/demeanor" },
                observations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific observations about expressions" },
                tips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tips to improve body language" }
              },
              required: ["averageExpression", "bodyLanguageScore", "observations", "tips"]
            }
          },
          required: ["overallScore", "hiringRecommendation", "hiringReason", "strengths", "weaknesses", "improvementPlan", "questionAnalysis", "nonVerbalAnalysis"]
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      // Append Metadata and RAW logs locally
      return {
        ...result,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        candidateName,
        jobTitle,
        fullTranscript: transcript, // Save raw transcript
        nonVerbalLog: nonVerbalSnapshots // Save raw snapshots
      } as InterviewReport;
    }
    throw new Error("No response text generated");
  } catch (error) {
    console.error("Analysis failed", error);
    throw error;
  }
};