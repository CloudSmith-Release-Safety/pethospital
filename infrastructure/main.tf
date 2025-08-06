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

  prefix = local.prefix
  tables = [
    {
      name         = "${local.prefix}-pets"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      range_key    = "ownerName"
      attributes = [
        {
          name = "id"
          type = "S"
        },
        {
          name = "ownerName"
          type = "S"
        },
        {
          name = "species"
          type = "S"
        },
        {
          name = "createdAt"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name               = "SpeciesIndex"
          hash_key           = "species"
          range_key          = "createdAt"
          projection_type    = "ALL"
        }
      ]
      ttl_enabled = true
      ttl_attribute_name = "expirationTime"
      backup_config = {
        enabled = true
        retention_days = 14
      }
    },
    {
      name         = "${local.prefix}-hospitals"
      billing_mode = "PAY_PER_REQUEST"
      hash_key     = "id"
      attributes = [
        {
          name = "id"
          type = "S"
        },
        {
          name = "name"
          type = "S"
        },
        {
          name = "address"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name               = "NameIndex"
          hash_key           = "name"
          projection_type    = "ALL"
        },
        {
          name               = "AddressIndex"
          hash_key           = "address"
          projection_type    = "KEYS_ONLY"
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
        },
        {
          name = "hospitalId"
          type = "S"
        },
        {
          name = "specialization"
          type = "S"
        },
        {
          name = "lastName"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name               = "HospitalIndex"
          hash_key           = "hospitalId"
          range_key          = "lastName"
          projection_type    = "ALL"
        },
        {
          name               = "SpecializationIndex"
          hash_key           = "specialization"
          projection_type    = "ALL"
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
        },
        {
          name = "petId"
          type = "S"
        },
        {
          name = "doctorId"
          type = "S"
        },
        {
          name = "visitDate"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name               = "PetVisitsIndex"
          hash_key           = "petId"
          range_key          = "visitDate"
          projection_type    = "ALL"
        },
        {
          name               = "DoctorScheduleIndex"
          hash_key           = "doctorId"
          range_key          = "visitDate"
          projection_type    = "ALL"
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
        },
        {
          name = "visitId"
          type = "S"
        },
        {
          name = "paymentStatus"
          type = "S"
        },
        {
          name = "billingDate"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name               = "VisitBillingIndex"
          hash_key           = "visitId"
          projection_type    = "ALL"
        },
        {
          name               = "PaymentStatusIndex"
          hash_key           = "paymentStatus"
          range_key          = "billingDate"
          projection_type    = "ALL"
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
        },
        {
          name = "petId"
          type = "S"
        },
        {
          name = "provider"
          type = "S"
        },
        {
          name = "expirationDate"
          type = "S"
        }
      ]
      global_secondary_indexes = [
        {
          name               = "PetInsuranceIndex"
          hash_key           = "petId"
          projection_type    = "ALL"
        },
        {
          name               = "ProviderIndex"
          hash_key           = "provider"
          range_key          = "expirationDate"
          projection_type    = "ALL"
        }
      ]
      ttl_enabled = true
      ttl_attribute_name = "policyExpiration"
    }
  ]

  backup_enabled = true
  backup_retention_days = 30
  
  monitoring_config = {
    enable_performance_insights = true
    enable_query_logging = true
    alarm_threshold_read_capacity = 70
    alarm_threshold_write_capacity = 70
    alarm_threshold_throttled_requests = 5
  }
  
  rollback_config = {
    enable_automatic_rollback = true
    rollback_trigger_alarm_names = [
      "${local.prefix}-pets-throttled-requests-alarm",
      "${local.prefix}-visits-throttled-requests-alarm"
    ]
    max_rollback_attempts = 3
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
    "${local.prefix}-auth-service",
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
  
  alarm_actions = var.alarm_actions
  ok_actions    = var.ok_actions

  tags = {
    Environment = local.environment
    Project     = local.prefix
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

output "dynamodb_backup_vault" {
  description = "Name of the DynamoDB backup vault"
  value       = module.dynamodb.backup_vault_name
}

output "dynamodb_monitoring_alarms" {
  description = "DynamoDB monitoring alarms"
  value       = module.dynamodb.monitoring_alarms
}

output "application_url" {
  description = "URL to access the application"
  value       = module.eks.application_url
}