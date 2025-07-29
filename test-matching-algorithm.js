const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test kullanıcısı için token oluştur
const testUserId = 28; // Bu kullanıcı gizlenmiş testleri tamamlamış
const token = jwt.sign(
  { id: testUserId, email: 'test@example.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function testMatchingAlgorithm() {
  try {
    console.log('🧪 Testing matching algorithm with hidden tests...\n');
    
    // 1. Check match eligibility
    console.log('1️⃣ Checking match eligibility...');
    const eligibilityResponse = await fetch('http://localhost:3002/api/matching/eligibility', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const eligibilityData = await eligibilityResponse.json();
    console.log('📊 Eligibility Status:', eligibilityResponse.status);
    console.log('📊 Eligibility Data:', JSON.stringify(eligibilityData, null, 2));
    
    // 2. Try to get matches
    console.log('\n2️⃣ Trying to get matches...');
    const matchesResponse = await fetch('http://localhost:3002/api/matching/matches', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const matchesData = await matchesResponse.json();
    console.log('🎯 Matches Status:', matchesResponse.status);
    console.log('🎯 Matches Data:', JSON.stringify(matchesData, null, 2));
    
    // 3. Check user score
    console.log('\n3️⃣ Checking user score...');
    const scoreResponse = await fetch('http://localhost:3002/api/test-responses/score', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const scoreData = await scoreResponse.json();
    console.log('📈 Score Status:', scoreResponse.status);
    console.log('📈 Score Data:', JSON.stringify(scoreData, null, 2));
    
    // 4. Analysis
    console.log('\n🔍 ANALYSIS:');
    
    if (eligibilityResponse.status === 200 && eligibilityData.is_eligible) {
      console.log('✅ SUCCESS: User is eligible for matching!');
      console.log('✅ Hidden tests are properly excluded from algorithm');
    } else {
      console.log('❌ ISSUE: User should be eligible but is not');
      console.log(`❌ Completed tests: ${eligibilityData.completed_tests}`);
      console.log(`❌ Total tests required: ${eligibilityData.total_tests}`);
    }
    
    if (matchesResponse.status === 200) {
      console.log('✅ SUCCESS: Matches endpoint working!');
      console.log(`✅ Found ${matchesData.length || 0} potential matches`);
    } else {
      console.log('❌ ISSUE: Matches endpoint failed');
      console.log(`❌ Error: ${matchesData.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Set environment variable and run test
process.env.JWT_SECRET = 'your-secret-key';
testMatchingAlgorithm(); 