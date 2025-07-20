export interface User {
  id?: number;
  username: string;
  password?: string; // Password field is optional here as it won't always be sent to the client
  email?: string;
  first_name?: string; // Ad
  last_name?: string; // Soyad
  age?: number;
  country?: string;
  residence_country?: string; // Yaşadığı ülke
  residence_city?: string; // Yaşadığı şehir
  languages?: string[];
  gender?: string;
  role?: string;
  created_at?: Date;
  last_active_at?: Date;
  avatar_url?: string;
  weight?: number; // Kilo bilgisi (kg cinsinden)
  height?: number; // Boy bilgisi (cm cinsinden)
} 