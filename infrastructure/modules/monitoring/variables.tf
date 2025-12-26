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