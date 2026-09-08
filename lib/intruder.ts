export type IntruderQuestion = { edition: "intrus-v1"; index: number; total: number; words: string[] };
export type IntruderAnswer = IntruderQuestion & { choice: number; correct: boolean; answer: number; explanation: string };
export type IntruderAttempt = { edition: "intrus-v1"; index: number; choice: number; occurredAt: string };
