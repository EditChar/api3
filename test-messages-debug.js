async function testMessagesDebug() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI4LCJlbWFpbCI6ImVsaWZAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImVsaWYiLCJpZCI6MjgsImlhdCI6MTc1MDcxNjUwNywiZXhwIjoxNzUwODAyOTA3fQ.tKSAcNn94zoSn8b3fXQq6ckkGZ3xkTVSwL10byf8NF4";
  
  try {
    console.log('🚀 Testing messages endpoint with detailed debug...');
    
    const roomId = 'f304baf4-3dd3-48d0-8991-cb97b51b104f';
    const url = `http://localhost:3001/api/chat/rooms/${roomId}/messages`;
    
    console.log('🔗 URL:', url);
    console.log('🔑 Using token for user 28');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response status text:', response.statusText);
    console.log('📡 Response headers:');
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    const responseText = await response.text();
    console.log('📄 Raw response body:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('📋 Parsed JSON:', JSON.stringify(data, null, 2));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Fetch error:', error.message);
  }
}

testMessagesDebug(); 