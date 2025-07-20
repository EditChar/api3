export interface UserQuestionResponse {
  id: number;
  user_id: number;
  question_id: number;
  answer_id: number;
  response_score: number;
  created_at: Date;
} 