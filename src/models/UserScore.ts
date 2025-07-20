export interface UserScore {
  id: number;
  user_id: number;
  total_score: number;
  completed_tests_count: number;
  last_updated: Date;
} 