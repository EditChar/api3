import { Answer } from './Answer';

export interface Question {
  id?: number;
  test_id: number; // Hangi ana teste (test setine) ait olduğu
  question_text: string;
  created_at?: Date;
  answers?: Answer[]; // Bir sorunun cevaplarını tutmak için (opsiyonel)
} 