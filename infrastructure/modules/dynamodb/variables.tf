variable "tables" {
  description = "List of DynamoDB tables to create"
  type = list(object({
    name         = string
    billing_mode = string
    hash_key     = string
    range_key    = optional(string)
    read_capacity  = optional(number)
    write_capacity = optional(number)
    attributes = list(object({
      name = string
      type = string
    }))
    global_secondary_indexes = optional(list(object({
      name               = string
      hash_key           = string
      range_key          = optional(string)
      projection_type    = string
      non_key_attributes = optional(list(string))
      write_capacity     = optional(number)
      read_capacity      = optional(number)
    })), [])
    local_secondary_indexes = optional(list(object({
      name               = string
      range_key          = string
      projection_type    = string
      non_key_attributes = optional(list(string))
    })), [])
    ttl_enabled = optional(bool, false)
    ttl_attribute_name = optional(string, "ttl")
    backup_config = optional(object({
      enabled = bool
      schedule = optional(string)
      retention_days = optional(number)
    }), {
      enabled = true
      retention_days = 7
    })
  }))
}

variable "connection_pool_config" {
  description = "Configuration for the DynamoDB connection pool"
  type = object({
    max_connections = optional(number, 500)
    min_connections = optional(number, 50)
    idle_timeout_ms = optional(number, 60000)
    connection_timeout_ms = optional(number, 5000)
    max_pending_requests = optional(number, 1000)
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

variable "backup_enabled" {
  description = "Whether to enable point-in-time recovery for all tables"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "monitoring_config" {
  description = "Configuration for database monitoring"
  type = object({
    enable_performance_insights = optional(bool, true)
    enable_query_logging = optional(bool, true)
    alarm_threshold_read_capacity = optional(number, 80)
    alarm_threshold_write_capacity = optional(number, 80)
    alarm_threshold_throttled_requests = optional(number, 10)
  })
  default = {
    enable_performance_insights = true
    enable_query_logging = true
    alarm_threshold_read_capacity = 80
    alarm_threshold_write_capacity = 80
    alarm_threshold_throttled_requests = 10
  }
}

variable "rollback_config" {
  description = "Configuration for rollback procedures"
  type = object({
    enable_automatic_rollback = optional(bool, true)
    rollback_trigger_alarm_names = optional(list(string), [])
    max_rollback_attempts = optional(number, 3)
  })
  default = {
    enable_automatic_rollback = true
    rollback_trigger_alarm_names = []
    max_rollback_attempts = 3
  }
}