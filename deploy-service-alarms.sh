#!/bin/bash

# Deploy Pet Hospital Service Specific CloudWatch Alarms
set -e

STACK_NAME="pet-hospital-service-alarms"
REGION="us-east-1"
TEMPLATE_FILE="infrastructure/pet-hospital-service-alarms.yaml"

echo "Deploying Pet Hospital Service Alarms Stack: $STACK_NAME"

# Deploy the CloudFormation stack
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --region $REGION \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset

echo "Pet Hospital Service Alarms deployed successfully!"

# List the created alarms
echo "Created service-specific alarms:"
aws cloudwatch describe-alarms \
    --region $REGION \
    --alarm-names \
        "pet-hospital-pet-service-pod-restarts" \
        "pet-hospital-doctor-service-pod-restarts" \
        "pet-hospital-hospital-service-pod-restarts" \
        "pet-hospital-pet-service-memory-high" \
        "pet-hospital-doctor-service-memory-high" \
        "pet-hospital-hospital-service-memory-high" \
        "pet-hospital-pet-service-cpu-high" \
        "pet-hospital-doctor-service-cpu-high" \
        "pet-hospital-hospital-service-cpu-high" \
    --query 'MetricAlarms[].{Name:AlarmName,State:StateValue,Metric:MetricName}' \
    --output table
