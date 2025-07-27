const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIAU5ZNYPFAACUFZNW7',
  secretAccessKey: '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',
  region: 'eu-north-1'
});

const iam = new AWS.IAM();
const USERNAME = 'avatar-system-user';

async function checkUserPolicies() {
  console.log('🔍 Checking all IAM policies for user:', USERNAME);
  
  try {
    // Get user details
    console.log('\n1️⃣ User Details:');
    const user = await iam.getUser({ UserName: USERNAME }).promise();
    console.log('✅ User found:', user.User.UserName);
    console.log('   ARN:', user.User.Arn);
    console.log('   Created:', user.User.CreateDate);
    
    // Get attached managed policies
    console.log('\n2️⃣ Attached Managed Policies:');
    const attachedPolicies = await iam.listAttachedUserPolicies({ UserName: USERNAME }).promise();
    console.log('   Count:', attachedPolicies.AttachedPolicies.length);
    
    for (const policy of attachedPolicies.AttachedPolicies) {
      console.log('   -', policy.PolicyName, '(' + policy.PolicyArn + ')');
      
      // Get policy document
      const policyVersion = await iam.getPolicyVersion({
        PolicyArn: policy.PolicyArn,
        VersionId: 'v1'
      }).promise();
      
      const document = JSON.parse(decodeURIComponent(policyVersion.PolicyVersion.Document));
      console.log('     Document:', JSON.stringify(document, null, 2));
    }
    
    // Get inline policies
    console.log('\n3️⃣ Inline Policies:');
    const inlinePolicies = await iam.listUserPolicies({ UserName: USERNAME }).promise();
    console.log('   Count:', inlinePolicies.PolicyNames.length);
    
    for (const policyName of inlinePolicies.PolicyNames) {
      console.log('   -', policyName);
      
      const policy = await iam.getUserPolicy({
        UserName: USERNAME,
        PolicyName: policyName
      }).promise();
      
      const document = JSON.parse(decodeURIComponent(policy.PolicyDocument));
      console.log('     Document:', JSON.stringify(document, null, 2));
    }
    
    // Get groups
    console.log('\n4️⃣ Group Memberships:');
    const groups = await iam.getGroupsForUser({ UserName: USERNAME }).promise();
    console.log('   Count:', groups.Groups.length);
    
    for (const group of groups.Groups) {
      console.log('   -', group.GroupName);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUserPolicies(); 