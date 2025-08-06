variable "region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_prefix" {
  description = "Prefix for all resources created by this project"
  type        = string
  default     = "pet-hospital"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# EKS Configuration
variable "kubernetes_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.27"
}

variable "eks_desired_capacity" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "eks_max_capacity" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 5
}

variable "eks_min_capacity" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

variable "eks_instance_types" {
  description = "List of instance types for the EKS worker nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_disk_size" {
  description = "Disk size for EKS worker nodes in GB"
  type        = number
  default     = 50
}

# Monitoring Configuration
variable "api_latency_threshold" {
  description = "Threshold for API latency alarm in milliseconds"
  type        = number
  default     = 1000
}

variable "error_rate_threshold" {
  description = "Threshold for error rate alarm in percentage"
  type        = number
  default     = 5
}

variable "cpu_utilization_threshold" {
  description = "Threshold for CPU utilization alarm in percentage"
  type        = number
  default     = 80
}

variable "memory_utilization_threshold" {
  description = "Threshold for memory utilization alarm in percentage"
  type        = number
  default     = 80
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarm transitions to ALARM state"
  type        = list(string)
  default     = []
}

variable "ok_actions" {
  description = "List of ARNs to notify when alarm transitions to OK state"
  type        = list(string)
  default     = []
}

# Database Connection Pool Configuration
variable "db_max_connections" {
  description = "Maximum number of connections in the DynamoDB connection pool"
  type        = number
  default     = 500
}

variable "db_min_connections" {
  description = "Minimum number of connections in the DynamoDB connection pool"
  type        = number
  default     = 50
}

variable "db_idle_timeout_ms" {
  description = "Idle timeout for connections in milliseconds"
  type        = number
  default     = 60000
}

variable "db_connection_timeout_ms" {
  description = "Connection timeout in milliseconds"
  type        = number
  default     = 5000
}

variable "db_max_pending_requests" {
  description = "Maximum number of pending connection requests"
  type        = number
  default     = 1000
}

# Database Monitoring Configuration
variable "db_connection_utilization_threshold" {
  description = "Threshold for database connection utilization alarm in percentage"
  type        = number
  default     = 80
}

variable "db_operation_latency_threshold" {
  description = "Threshold for database operation latency alarm in milliseconds"
  type        = number
  default     = 100
}

variable "db_throttled_requests_threshold" {
  description = "Threshold for throttled database requests"
  type        = number
  default     = 10
}
# Git Repository Configuration
variable "feature_flag_latency_threshold" {
  description = "Threshold for feature flag evaluation latency in milliseconds"
  type        = number
  default     = 50
}

variable "feature_flag_error_threshold" {
  description = "Threshold for feature flag evaluation errors"
  type        = number
  default     = 10
}

variable "unleash_api_url" {
  description = "URL for the Unleash feature flag service API"
  type        = string
  default     = "http://unleash-server:4242/api"
}

variable "unleash_api_token" {
  description = "API token for the Unleash feature flag service"
  type        = string
  default     = "default:development.unleash-insecure-api-token"
  sensitive   = true
}
variable "git_repository_url" {
  description = "URL of the Git repository containing the application code"
  type        = string
  default     = "https://github.com/CloudSmith-Release-Safety/pethospital.git"
}

# Database Connection Pool Configuration
variable "db_max_connections" {
  description = "Maximum number of connections in the database connection pool"
  type        = number
  default     = 50
}

variable "db_min_connections" {
  description = "Minimum number of connections in the database connection pool"
  type        = number
  default     = 10
}

variable "db_idle_timeout_ms" {
  description = "Idle timeout for database connections in milliseconds"
  type        = number
  default     = 30000
}

variable "db_connection_timeout_ms" {
  description = "Connection timeout for database connections in milliseconds"
  type        = number
  default     = 5000
}

variable "db_max_pending_requests" {
  description = "Maximum number of pending requests for the database connection pool"
  type        = number
  default     = 100
}

variable "db_connection_utilization_threshold" {
  description = "Threshold for database connection utilization alarm in percentage"
  type        = number
  default     = 80
}

variable "db_operation_latency_threshold" {
  description = "Threshold for database operation latency alarm in milliseconds"
  type        = number
  default     = 100
}

variable "db_throttled_requests_threshold" {
  description = "Threshold for throttled database requests"
  type        = number
  default     = 10
}

# Cache Configuration
variable "cache_read_capacity" {
  description = "Read capacity units for the cache DynamoDB table"
  type        = number
  default     = 20
}

variable "cache_write_capacity" {
  description = "Write capacity units for the cache DynamoDB table"
  type        = number
  default     = 10
}

variable "cache_ttl_seconds" {
  description = "Default TTL for cache entries in seconds"
  type        = number
  default     = 3600 # 1 hour
}

variable "cache_hit_rate_threshold" {
  description = "Threshold for cache hit rate alarm in percentage"
  type        = number
  default     = 70
}

variable "cache_latency_threshold" {
  description = "Threshold for cache latency alarm in milliseconds"
  type        = number
  default     = 50
}

variable "cache_health_check_interval" {
  description = "Interval for cache health checks in seconds"
  type        = number
  default     = 60
}

variable "cache_health_check_timeout" {
  description = "Timeout for cache health checks in seconds"
  type        = number
  default     = 5
}

variable "cache_health_check_threshold" {
  description = "Number of consecutive health check failures before triggering alarm"
  type        = number
  default     = 3
}
