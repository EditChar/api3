import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL - Kendi backend URL'inizi buraya yazın
const API_BASE_URL = 'http://localhost:3000/api';

interface CompletedTest {
  id: number;
  user_id: number;
  test_id: number;
  test_score: number;
  completed_at: string;
  test_title: string;
  test_description: string;
  creator_username: string;
}

interface AvailableTest {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_at: string;
  creator: {
    username: string;
    id: number;
  } | null;
}

class TestCompletionService {
  // Authentication token'ını al
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // HTTP header'larını oluştur
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  // Kullanıcının tamamlayabileceği testleri al (tamamladıkları hariç)
  async getAvailableTests(): Promise<AvailableTest[]> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/tests`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching available tests:', error);
      throw error;
    }
  }

  // Kullanıcının tamamladığı testleri al
  async getCompletedTests(page: number = 1, limit: number = 10): Promise<{
    completedTests: CompletedTest[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
    };
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/test-responses/completed/list?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching completed tests:', error);
      throw error;
    }
  }

  // Belirli bir testin tamamlanıp tamamlanmadığını kontrol et
  async checkTestCompletion(testId: number): Promise<{
    completed: boolean;
    completionData?: {
      id: number;
      test_score: number;
      completed_at: string;
    };
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/test-responses/check/${testId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking test completion:', error);
      throw error;
    }
  }

  // Test cevaplarını gönder ve testi tamamla
  async submitTestResponse(testId: number, responses: Array<{question_id: number, answer_id: number}>): Promise<{
    testResponse: any;
    questionResponses: any[];
    totalScore: number;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/test-responses/${testId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ responses }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.alreadyCompleted) {
          throw new Error('Bu test daha önce tamamlanmış.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting test response:', error);
      throw error;
    }
  }

  // Belirli bir test için sorular ve cevapları al
  async getTestQuestions(testId: number): Promise<{
    id: number;
    title: string;
    description: string;
    questions: Array<{
      id: number;
      question_text: string;
      answers: Array<{
        id: number;
        answer_text: string;
        score: number;
      }>;
    }>;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/tests/${testId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching test questions:', error);
      throw error;
    }
  }
}

export default new TestCompletionService(); 