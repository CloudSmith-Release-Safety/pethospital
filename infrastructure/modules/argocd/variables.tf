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

variable "git_repository_url" {
  description = "URL of the Git repository containing the application code"
  type        = string
  default     = "https://github.com/CloudSmith-Release-Safety/pethospital.git"
}

variable "cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  type        = string
}

variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}
