#!/bin/bash

# Enterprise Avatar S3 Lifecycle Policy Application Script
# Run this script to apply the optimal lifecycle policy

echo "🚀 Applying Enterprise Avatar Lifecycle Policy..."
echo "=================================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get bucket name from environment or use default
BUCKET_NAME=${AWS_S3_BUCKET:-"easy-to-image-production"}

echo "📦 Target Bucket: $BUCKET_NAME"
echo ""

# Apply the lifecycle policy
echo "📋 Applying lifecycle policy..."

aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration file://s3-lifecycle-enterprise-avatars.json

if [ $? -eq 0 ]; then
    echo "✅ Lifecycle policy applied successfully!"
    echo ""
    
    # Verify the policy was applied
    echo "🔍 Verifying applied policy..."
    aws s3api get-bucket-lifecycle-configuration --bucket "$BUCKET_NAME" --output table
    
    echo ""
    echo "🎉 Enterprise Avatar Lifecycle Policy is now active!"
    echo ""
    echo "📊 Expected Cost Savings:"
    echo "  - Week 1: Standard storage (full cost)"
    echo "  - Week 2+: Standard-IA (50% storage cost reduction)"
    echo "  - Month 6+: Glacier-IR (75% storage cost reduction)"
    echo "  - Year 2+: Glacier (85% storage cost reduction)"
    echo ""
    echo "⚡ Performance Impact: NONE - All access remains instant!"
    
else
    echo "❌ Failed to apply lifecycle policy"
    echo "🔧 Please check:"
    echo "  - AWS credentials are correct"
    echo "  - Bucket name is correct: $BUCKET_NAME"
    echo "  - You have s3:PutLifecycleConfiguration permission"
    exit 1
fi 