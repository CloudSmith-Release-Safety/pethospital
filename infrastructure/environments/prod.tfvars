# Global Configuration
region = "us-west-2"
environment = "prod"
project_prefix = "pet-hospital"

# Kubernetes Configuration
kubernetes_version = "1.27"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]
private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnets = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

# EKS Configuration
eks_desired_capacity = 3
eks_max_capacity = 10
eks_min_capacity = 2
eks_instance_types = ["t3.large"]
eks_disk_size = 100

# Monitoring Configuration
api_latency_threshold = 500
error_rate_threshold = 2
cpu_utilization_threshold = 70
memory_utilization_threshold = 70
alarm_actions = []
ok_actions = []

# Git Repository Configuration
git_repository_url = "https://github.com/CloudSmith-Release-Safety/pethospital.git"
