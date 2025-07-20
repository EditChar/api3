export interface Answer {
  id?: number;
  question_id: number;
  answer_text: string;
  score: number;
  created_at?: Date;
} 