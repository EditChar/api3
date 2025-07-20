async function testEndpoint() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI4LCJlbWFpbCI6ImVsaWZAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImVsaWYiLCJpZCI6MjgsImlhdCI6MTc1MDcxNjUwNywiZXhwIjoxNzUwODAyOTA3fQ.tKSAcNn94zoSn8b3fXQq6ckkGZ3xkTVSwL10byf8NF4";
  
  try {
    console.log('🚀 Testing chat rooms endpoint...');
    const response = await fetch('http://localhost:3001/api/chat/rooms', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Status:', response.status);
    const data = await response.json();
    console.log('📋 Data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEndpoint(); 