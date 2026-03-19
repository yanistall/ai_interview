import Anthropic from "@anthropic-ai/sdk";
import { InterviewReport, TranscriptItem, NonVerbalSnapshot } from "../types";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

export const generateInterviewReport = async (
  transcript: TranscriptItem[],
  nonVerbalSnapshots: NonVerbalSnapshot[],
  jobTitle: string,
  candidateName: string
): Promise<InterviewReport> => {
  const client = new Anthropic({
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true, // 前端直接呼叫需要此設定
  });

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
    
    You MUST return ONLY a valid JSON object with no extra text, no markdown code blocks, no preamble.
    The JSON must match this exact structure:
    {
      "overallScore": <integer 0-100>,
      "hiringRecommendation": <"HIRE" | "CONSIDER" | "NO_HIRE">,
      "hiringReason": <string>,
      "strengths": [<string>, ...],
      "weaknesses": [<string>, ...],
      "improvementPlan": <string>,
      "questionAnalysis": [
        {
          "question": <string>,
          "answerSummary": <string>,
          "score": <integer 0-100>,
          "feedback": <string>,
          "suggestedAnswer": <string>
        },
        ...
      ],
      "nonVerbalAnalysis": {
        "averageExpression": <string>,
        "bodyLanguageScore": <integer 0-100>,
        "observations": [<string>, ...],
        "tips": [<string>, ...]
      }
    }
  `;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    // Extract text from response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    if (!responseText) {
      throw new Error("No response text generated");
    }

    // Strip markdown code fences if present
    const cleaned = responseText.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      ...result,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      candidateName,
      jobTitle,
      fullTranscript: transcript,
      nonVerbalLog: nonVerbalSnapshots
    } as InterviewReport;

  } catch (error) {
    console.error("Analysis failed", error);
    throw error;
  }
};