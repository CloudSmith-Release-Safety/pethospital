variable "tables" {
  description = "List of DynamoDB tables to create"
  type = list(object({
    name         = string
    billing_mode = string
    hash_key     = string
    attributes = list(object({
      name = string
      type = string
    }))
  }))
}

variable "connection_pool_config" {
  description = "Configuration for the DynamoDB connection pool"
  type = object({
    max_connections = number
    min_connections = number
    idle_timeout_ms = number
    connection_timeout_ms = number
    max_pending_requests = number
  })
  default = {
    max_connections = 500
    min_connections = 50
    idle_timeout_ms = 60000
    connection_timeout_ms = 5000
    max_pending_requests = 1000
  }
}

variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}
