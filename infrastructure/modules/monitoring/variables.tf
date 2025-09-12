variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "prefix" {
  description = "Resource prefix for naming"
  type        = string
  default     = "pet-hospital"
}

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

variable "cache_health_check_threshold" {
  description = "Number of consecutive health check failures before triggering alarm"
  type        = number
  default     = 3
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

variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}
