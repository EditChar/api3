const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test kullanıcısı için token oluştur
const testUserId = 28;
const token = jwt.sign(
  { id: testUserId, email: 'test@example.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function testMatchingAPI() {
  try {
    console.log('🧪 Testing matching API endpoints...\n');
    
    // Wait for backend to be ready
    console.log('⏳ Waiting for backend to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test health endpoint first
    try {
      const healthResponse = await fetch('http://localhost:3002/api/health');
      console.log('❤️ Health check:', healthResponse.status === 200 ? '✅ OK' : '❌ Failed');
    } catch (error) {
      console.log('❤️ Health check: ❌ Backend not running');
      return;
    }
    
    // 1. Check match eligibility
    console.log('\n1️⃣ Checking match eligibility...');
    try {
      const eligibilityResponse = await fetch('http://localhost:3002/api/matching/eligibility', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const eligibilityData = await eligibilityResponse.json();
      console.log('📊 Eligibility Status:', eligibilityResponse.status);
      console.log('📊 Eligibility Data:', JSON.stringify(eligibilityData, null, 2));
      
      if (eligibilityResponse.status === 200 && eligibilityData.is_eligible) {
        console.log('✅ SUCCESS: User is eligible for matching!');
      } else {
        console.log('❌ User not eligible yet');
        console.log(`   Completed: ${eligibilityData.completed_tests}`);
        console.log(`   Required: ${eligibilityData.total_tests}`);
      }
    } catch (error) {
      console.log('❌ Eligibility check failed:', error.message);
    }
    
    // 2. Try to get matches
    console.log('\n2️⃣ Trying to get matches...');
    try {
      const matchesResponse = await fetch('http://localhost:3002/api/matching/matches', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const matchesData = await matchesResponse.json();
      console.log('🎯 Matches Status:', matchesResponse.status);
      
      if (matchesResponse.status === 200) {
        console.log('✅ SUCCESS: Matches endpoint working!');
        console.log(`✅ Found ${matchesData.length || 0} potential matches`);
      } else {
        console.log('❌ Matches failed:', matchesData.message);
      }
    } catch (error) {
      console.log('❌ Matches request failed:', error.message);
    }
    
    // 3. Check available tests
    console.log('\n3️⃣ Checking available tests...');
    try {
      const testsResponse = await fetch('http://localhost:3002/api/tests', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const testsData = await testsResponse.json();
      console.log('📝 Tests Status:', testsResponse.status);
      
      if (testsResponse.status === 200) {
        console.log(`📝 Available tests: ${testsData.length}`);
        testsData.forEach(test => {
          console.log(`   📋 "${test.title}" (ID: ${test.id})`);
        });
      }
    } catch (error) {
      console.log('❌ Tests request failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Set environment variable and run test
process.env.JWT_SECRET = 'your-secret-key';
testMatchingAPI(); 