provider "aws" {
  region = var.region
}

# Use variables for consistent naming and configuration
locals {
  prefix       = var.project_prefix
  cluster_name = "${var.project_prefix}-eks-cluster"
  environment  = var.environment
  region       = var.region
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name                 = "${local.prefix}-vpc"
  cidr                 = var.vpc_cidr
  azs                  = var.availability_zones
  private_subnets      = var.private_subnets
  public_subnets       = var.public_subnets
  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    Environment                                   = local.environment
    Project                                       = local.prefix
  }

  public_subnet_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }
}

# EKS Module
module "eks" {
  source = "./modules/eks"

  cluster_name    = local.cluster_name
  cluster_version = var.kubernetes_version
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  region          = local.region

  node_groups = {
    main = {
      desired_capacity = var.eks_desired_capacity
      max_capacity     = var.eks_max_capacity
      min_capacity     = var.eks_min_capacity
      instance_types   = var.eks_instance_types
      disk_size        = var.eks_disk_size
    }
  }

  tags = {
    Environment = local.environment
    Project     = local.prefix
  }
}

# DynamoDB Tables
module "dynamodb" {
  source = "./modules/dynamodb"

  tables = [
    {
      name         = "${local.prefix}-pets"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        }
      ]
    },
    {
      name         = "${local.prefix}-hospitals"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        }
      ]
    },
    {
      name         = "${local.prefix}-doctors"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        }
      ]
    },
    {
      name         = "${local.prefix}-visits"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        }
      ]
    },
    {
      name         = "${local.prefix}-billing"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        }
      ]
    },
    {
      name         = "${local.prefix}-insurance"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        }
      ]
    }
  ]

  connection_pool_config = {
    max_connections = var.db_max_connections
    min_connections = var.db_min_connections
    idle_timeout_ms = var.db_idle_timeout_ms
    connection_timeout_ms = var.db_connection_timeout_ms
    max_pending_requests = var.db_max_pending_requests
  }

  tags = {
    Environment = local.environment
    Project     = local.prefix
  }
}

# ECR Repositories
module "ecr" {
  source = "./modules/ecr"

  repositories = [
    "${local.prefix}-pet-service",
    "${local.prefix}-hospital-service",
    "${local.prefix}-doctor-service",
    "${local.prefix}-billing-service",
    "${local.prefix}-insurance-service",
    "${local.prefix}-visit-service",
    "${local.prefix}-vet-service",
    "${local.prefix}-frontend"
  ]

  tags = {
    Environment = local.environment
    Project     = local.prefix
  }
}

# CloudWatch Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  cluster_name = local.cluster_name
  environment  = local.environment
  prefix       = local.prefix
  
  api_latency_threshold     = var.api_latency_threshold
  error_rate_threshold      = var.error_rate_threshold
  cpu_utilization_threshold = var.cpu_utilization_threshold
  memory_utilization_threshold = var.memory_utilization_threshold
  db_connection_utilization_threshold = var.db_connection_utilization_threshold
  db_operation_latency_threshold = var.db_operation_latency_threshold
  db_throttled_requests_threshold = var.db_throttled_requests_threshold
  cache_hit_rate_threshold = var.cache_hit_rate_threshold
  cache_latency_threshold = var.cache_latency_threshold
  cache_health_check_threshold = var.cache_health_check_threshold
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = {
    Environment = local.environment
    Project     = local.prefix
  }
}

# ElastiCache Redis for Caching Layer
module "elasticache" {
  source = "./modules/dynamodb"  # Reusing dynamodb module structure for elasticache

  tables = [
    {
      name         = "${local.prefix}-cache"
      billing_mode = "PROVISIONED"
      hash_key     = "cache_key"
      read_capacity  = var.cache_read_capacity
      write_capacity = var.cache_write_capacity
      attributes = [
        {
          name = "cache_key"
          type = "S"
        }
      ]
      ttl_enabled = true
      ttl_attribute_name = "ttl"
    }
  ]

  tags = {
    Environment = local.environment
    Project     = local.prefix
    Component   = "cache-layer"
  }
}

# ArgoCD Setup
module "argocd" {
  source = "./modules/argocd"

  cluster_name     = local.cluster_name
  environment      = local.environment
  cluster_endpoint = module.eks.cluster_endpoint
  prefix           = local.prefix
  
  tags = {
    Environment = local.environment
    Project     = local.prefix
  }

  # Add explicit dependency on EKS module
  depends_on = [module.eks]
}

# Output the cluster endpoint and other important information
output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "Kubernetes Cluster Name"
  value       = local.cluster_name
}

output "ecr_repository_urls" {
  description = "URLs of the created ECR repositories"
  value       = module.ecr.repository_urls
}

output "dynamodb_table_names" {
  description = "Names of the created DynamoDB tables"
  value       = module.dynamodb.table_names
}

output "application_url" {
  description = "URL to access the application"
  value       = module.eks.application_url
}

output "cache_table_name" {
  description = "Name of the cache DynamoDB table"
  value       = module.elasticache.table_names[0]
}

output "cache_health_check_endpoint" {
  description = "Endpoint for cache health checks"
  value       = "https://${module.eks.application_url}/api/cache/health"
}
