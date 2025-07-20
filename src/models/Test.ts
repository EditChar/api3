import { Question } from './Question';
import { User } from './User'; // User modelini de import edelim

export interface Test {
  id?: number;
  title: string;
  description?: string | null;
  created_by?: number | null; // User ID
  created_at?: Date;
  questions?: Question[]; // Bir test setinin sorularını tutmak için (opsiyonel)
  creator?: User; // Testi oluşturan kullanıcı bilgisi (opsiyonel, join ile alınabilir)
} 