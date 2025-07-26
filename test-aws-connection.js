const AWS = require('aws-sdk');
const sharp = require('sharp');
const fs = require('fs');

// AWS Configuration from environment
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'easy-to-image-production';
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || 'https://e3sj7b3ql1f8wh.cloudfront.net';

console.log('🔧 AWS Connection Test Starting...');
console.log(`📦 Bucket: ${BUCKET_NAME}`);
console.log(`⚡ CloudFront: ${CLOUDFRONT_URL}`);
console.log('');

async function testAWSConnection() {
  const testResults = {
    s3Connection: false,
    bucketAccess: false,
    uploadTest: false,
    cloudFrontTest: false,
    cleanupTest: false
  };

  try {
    // ✅ 1. S3 Connection Test
    console.log('1️⃣ Testing S3 Connection...');
    const buckets = await s3.listBuckets().promise();
    console.log(`   ✅ S3 Connection OK: Found ${buckets.Buckets.length} buckets`);
    testResults.s3Connection = true;
    
    // ✅ 2. Bucket Access Test
    console.log('2️⃣ Testing Bucket Access...');
    const objects = await s3.listObjects({ 
      Bucket: BUCKET_NAME,
      MaxKeys: 5 
    }).promise();
    console.log(`   ✅ Bucket Access OK: Found ${objects.Contents.length} objects`);
    testResults.bucketAccess = true;

    // ✅ 3. Upload Test
    console.log('3️⃣ Testing File Upload...');
    
    // Create a test image using sharp
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .jpeg()
    .toBuffer();

    const testKey = `test/avatar-test-${Date.now()}.jpg`;
    
    const uploadResult = await s3.upload({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testImageBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000'
    }).promise();

    console.log(`   ✅ Upload Success: ${uploadResult.Location}`);
    testResults.uploadTest = true;

    // ✅ 4. CloudFront Test
    console.log('4️⃣ Testing CloudFront Access...');
    const cloudFrontUrl = `${CLOUDFRONT_URL}/${testKey}`;
    
    // Note: CloudFront may take time to propagate, so this might initially fail
    try {
      const https = require('https');
      const axios = require('axios');
      
      // Create an axios instance that doesn't follow redirects and has a short timeout
      const response = await axios.get(cloudFrontUrl, {
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // Accept any status code less than 500
        }
      });
      
      if (response.status === 200) {
        console.log(`   ✅ CloudFront Access OK: ${cloudFrontUrl}`);
        testResults.cloudFrontTest = true;
      } else {
        console.log(`   ⚠️  CloudFront Response: ${response.status} (may need time to propagate)`);
        testResults.cloudFrontTest = 'pending';
      }
    } catch (cfError) {
      console.log(`   ⚠️  CloudFront Test: ${cfError.message} (may need time to propagate)`);
      testResults.cloudFrontTest = 'pending';
    }

    // ✅ 5. Cleanup Test
    console.log('5️⃣ Testing File Cleanup...');
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: testKey
    }).promise();
    console.log(`   ✅ Cleanup Success: Deleted ${testKey}`);
    testResults.cleanupTest = true;

  } catch (error) {
    console.error('❌ AWS Test Failed:', error.message);
    
    if (error.code === 'CredentialsError') {
      console.error('🔑 Check your AWS credentials in .env file');
    } else if (error.code === 'NoSuchBucket') {
      console.error('🪣 Check your bucket name and region');
    } else if (error.code === 'AccessDenied') {
      console.error('🚫 Check your IAM permissions');
    }
  }

  // ✅ Test Summary
  console.log('\n📊 AWS Connection Test Results:');
  console.log('═══════════════════════════════════');
  
  Object.entries(testResults).forEach(([test, result]) => {
    const emoji = result === true ? '✅' : result === 'pending' ? '⏳' : '❌';
    const status = result === true ? 'PASSED' : 
                   result === 'pending' ? 'PENDING' : 'FAILED';
    console.log(`${emoji} ${test.padEnd(20)}: ${status}`);
  });

  const passedTests = Object.values(testResults).filter(r => r === true).length;
  const totalTests = Object.keys(testResults).length;
  
  console.log('\n🎯 Overall Score:', `${passedTests}/${totalTests} tests passed`);
  
  if (passedTests >= 4) {
    console.log('🎉 AWS Integration is ready for production!');
  } else if (passedTests >= 2) {
    console.log('⚠️  AWS Integration partially working - check errors above');
  } else {
    console.log('❌ AWS Integration needs configuration - check your .env file');
  }

  return testResults;
}

// Environment Variables Check
function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...');
  
  const requiredVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'CLOUDFRONT_URL'
  ];

  const missingVars = [];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.includes('YOUR-') || value.includes('your_') || value.includes('d123abc456')) {
      missingVars.push(varName);
      console.log(`   ❌ ${varName}: Missing or placeholder value`);
    } else {
      // Mask sensitive values
      const maskedValue = varName.includes('SECRET') || varName.includes('KEY') 
        ? value.substring(0, 4) + '****' 
        : value;
      console.log(`   ✅ ${varName}: ${maskedValue}`);
    }
  });

  if (missingVars.length > 0) {
    console.log(`\n⚠️  Please configure these environment variables in your .env file:`);
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    return false;
  }

  console.log('✅ All environment variables configured!\n');
  return true;
}

// Main execution
async function main() {
  console.log('🚀 Enterprise Avatar System - AWS Connection Test');
  console.log('================================================\n');

  // Check environment variables first
  const envOk = checkEnvironmentVariables();
  
  if (!envOk) {
    console.log('❌ Please fix environment variables before running AWS tests.');
    process.exit(1);
  }

  // Run AWS connection tests
  await testAWSConnection();
  
  console.log('\n🏁 AWS Connection Test Completed!');
}

// Run the test
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test failed with error:', error);
    process.exit(1);
  });
}

module.exports = { testAWSConnection, checkEnvironmentVariables }; 