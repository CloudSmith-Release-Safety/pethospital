# Pet Hospital CloudWatch Monitoring

This PR adds CloudWatch alarms for monitoring the Pet Hospital application infrastructure.

## Alarms Created

1. **pet-hospital-eks-high-error-rate** - Monitors EKS API server 5XX errors
2. **pet-hospital-eks-node-high-cpu** - Monitors EKS node CPU utilization  
3. **pet-hospital-eks-4xx-errors** - Monitors EKS API server 4XX client errors
4. **pet-hospital-rds-high-cpu** - Monitors RDS database CPU utilization

## Deployment

### Automatic Deployment
The alarms will be automatically deployed when this PR is merged via GitHub Actions.

### Manual Deployment
```bash
# Deploy alarms manually
./deploy-alarms.sh

# Verify deployment
aws cloudwatch describe-alarms --region us-east-1
```

## Files Added

- `infrastructure/cloudwatch-alarms.yaml` - CloudFormation template for alarms
- `deploy-alarms.sh` - Deployment script
- `.github/workflows/deploy-monitoring.yml` - GitHub Actions workflow
- `README-monitoring.md` - This documentation

## Monitoring Coverage

These alarms will provide monitoring for:
- EKS cluster health and error rates
- Node resource utilization
- Database performance
- Infrastructure-level issues that could affect the pet hospital services

After deployment, future PRs will show these alarms in the monitoring plan analysis.
