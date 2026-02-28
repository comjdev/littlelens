#!/bin/bash
# Deploy Lambda functions to AWS (uses profile: gill)
set -e
cd "$(dirname "$0")"

echo "Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "Creating deployment package..."
zip -r ../register-deploy.zip index.js credentials.json confirmation-email.hbs package.json node_modules \
  -x "*.DS_Store" -x "node_modules/.cache/*" -q

echo "Deploying register Lambda..."
AWS_PROFILE=gill aws lambda update-function-code \
  --function-name register \
  --zip-file fileb://../register-deploy.zip \
  --region us-east-1 \
  --output text --query "LastModified"

echo "Deploying checkout Lambda..."
AWS_PROFILE=gill aws lambda update-function-code \
  --function-name checkout \
  --zip-file fileb://../register-deploy.zip \
  --region us-east-1 \
  --output text --query "LastModified"

echo "Deploying stripe-webhook Lambda..."
AWS_PROFILE=gill aws lambda update-function-code \
  --function-name stripe-webhook \
  --zip-file fileb://../register-deploy.zip \
  --region us-east-1 \
  --output text --query "LastModified"

echo "Done. API: https://8xiczk0ua0.execute-api.us-east-1.amazonaws.com"
