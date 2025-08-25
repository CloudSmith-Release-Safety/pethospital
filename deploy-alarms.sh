#!/bin/bash

# Deploy CloudWatch Alarms for Pet Hospital
set -e

STACK_NAME="pet-hospital-cloudwatch-alarms"
REGION="us-east-1"
TEMPLATE_FILE="infrastructure/cloudwatch-alarms.yaml"

echo "Deploying CloudWatch Alarms Stack: $STACK_NAME"

# Deploy the CloudFormation stack
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset

echo "CloudWatch Alarms deployed successfully!"

# List the created alarms
echo "Created alarms:"
aws cloudwatch describe-alarms \
    --region $REGION \
    --alarm-names \
        "pet-hospital-eks-high-error-rate" \
        "pet-hospital-eks-node-high-cpu" \
        "pet-hospital-eks-4xx-errors" \
        "pet-hospital-rds-high-cpu" \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Reason:StateReason}' \
    --output table
