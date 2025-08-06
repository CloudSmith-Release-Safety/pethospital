resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "${var.cluster_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "app/${var.cluster_name}-alb/*"]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "API Latency"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "app/${var.cluster_name}-alb/*"],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", "app/${var.cluster_name}-alb/*"]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "HTTP Errors"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["ContainerInsights", "node_failed_count", "ClusterName", var.cluster_name]
          ]
          period = 300
          stat   = "Maximum"
          region = data.aws_region.current.name
          title  = "Failed Nodes"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["ContainerInsights", "pod_cpu_utilization", "ClusterName", var.cluster_name],
            ["ContainerInsights", "pod_memory_utilization", "ClusterName", var.cluster_name]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Pod Resource Utilization"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["ContainerInsights", "node_cpu_utilization", "ClusterName", var.cluster_name]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Node CPU Utilization"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["ContainerInsights", "node_memory_utilization", "ClusterName", var.cluster_name]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Node Memory Utilization"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.prefix}-pets"],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.prefix}-hospitals"],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${var.prefix}-doctors"]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "DynamoDB Read Capacity"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "${var.prefix}-pets"],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "${var.prefix}-hospitals"],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "${var.prefix}-doctors"]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "DynamoDB Write Capacity"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 24
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.prefix}-pets", "Operation", "GetItem"],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.prefix}-hospitals", "Operation", "GetItem"],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.prefix}-doctors", "Operation", "GetItem"]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "DynamoDB Read Latency"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 24
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.prefix}-pets", "Operation", "PutItem"],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.prefix}-hospitals", "Operation", "PutItem"],
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.prefix}-doctors", "Operation", "PutItem"]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "DynamoDB Write Latency"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 30
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", "${var.prefix}-pets"],
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", "${var.prefix}-hospitals"],
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", "${var.prefix}-doctors"]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "DynamoDB Throttled Requests"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 30
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/DynamoDB", "SystemErrors", "TableName", "${var.prefix}-pets"],
            ["AWS/DynamoDB", "SystemErrors", "TableName", "${var.prefix}-hospitals"],
            ["AWS/DynamoDB", "SystemErrors", "TableName", "${var.prefix}-doctors"]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "DynamoDB System Errors"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 36
        width  = 24
        height = 6
        properties = {
          metrics = [
            ["Custom/Database", "ConnectionPoolUtilization", "Service", "pet-service"],
            ["Custom/Database", "ConnectionPoolUtilization", "Service", "hospital-service"],
            ["Custom/Database", "ConnectionPoolUtilization", "Service", "doctor-service"]
          ]
          period = 60
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Connection Pool Utilization"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 42
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["Custom/Cache", "CacheHitRate", "ClusterName", var.cluster_name, "CacheId", "${var.prefix}-cache"]
          ]
          period = 60
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Cache Hit Rate"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 42
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["Custom/Cache", "CacheLatency", "ClusterName", var.cluster_name, "CacheId", "${var.prefix}-cache"]
          ]
          period = 60
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Cache Latency (ms)"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 48
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["Custom/Cache", "CacheHealthCheckFailures", "ClusterName", var.cluster_name, "CacheId", "${var.prefix}-cache"]
          ]
          period = 60
          stat   = "Maximum"
          region = data.aws_region.current.name
          title  = "Cache Health Check Failures"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 48
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["Custom/Cache", "CacheEvictionRate", "ClusterName", var.cluster_name, "CacheId", "${var.prefix}-cache"]
          ]
          period = 60
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Cache Eviction Rate"
        }
      }
    ]
  })
}

# API Latency Alarm
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.cluster_name}-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = var.api_latency_threshold / 1000 # Convert from ms to seconds
  alarm_description   = "This metric monitors API latency"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    LoadBalancer = "app/${var.cluster_name}-alb/*"
  }
  
  tags = var.tags
}

# Error Rate Alarm
resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "${var.cluster_name}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = var.error_rate_threshold
  alarm_description   = "This metric monitors API error rate"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    LoadBalancer = "app/${var.cluster_name}-alb/*"
  }
  
  tags = var.tags
}

# Get current AWS region
data "aws_region" "current" {}

# Container Insights - Pod CPU Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "container_insights_pod_cpu" {
  alarm_name          = "${var.cluster_name}-pod-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "pod_cpu_utilization"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "This metric monitors pod CPU utilization using Container Insights"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
  }
  
  tags = var.tags
}

# Container Insights - Pod Memory Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "container_insights_pod_memory" {
  alarm_name          = "${var.cluster_name}-pod-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "pod_memory_utilization"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = var.memory_utilization_threshold
  alarm_description   = "This metric monitors pod memory utilization using Container Insights"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
  }
  
  tags = var.tags
}

# Container Insights - Node CPU Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "container_insights_node_cpu" {
  alarm_name          = "${var.cluster_name}-node-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "node_cpu_utilization"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "This metric monitors node CPU utilization using Container Insights"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
  }
  
  tags = var.tags
}

# Container Insights - Node Memory Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "container_insights_node_memory" {
  alarm_name          = "${var.cluster_name}-node-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "node_memory_utilization"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = var.memory_utilization_threshold
  alarm_description   = "This metric monitors node memory utilization using Container Insights"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
  }
  
  tags = var.tags
}

# Container Insights - Node Disk Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "container_insights_node_disk" {
  alarm_name          = "${var.cluster_name}-node-disk-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "node_filesystem_utilization"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = 80 # 80% disk utilization threshold
  alarm_description   = "This metric monitors node disk utilization using Container Insights"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
  }
  
  tags = var.tags
}

# DynamoDB Connection Pool Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "db_connection_utilization" {
  alarm_name          = "${var.cluster_name}-db-connection-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConnectionPoolUtilization"
  namespace           = "Custom/Database"
  period              = 60
  statistic           = "Average"
  threshold           = var.db_connection_utilization_threshold
  alarm_description   = "This metric monitors database connection pool utilization"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    Service = "pet-service"
  }
  
  tags = var.tags
}

# DynamoDB Operation Latency Alarm
resource "aws_cloudwatch_metric_alarm" "db_operation_latency" {
  alarm_name          = "${var.cluster_name}-db-operation-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "SuccessfulRequestLatency"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Average"
  threshold           = var.db_operation_latency_threshold
  alarm_description   = "This metric monitors database operation latency"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    TableName = "${var.prefix}-pets"
    Operation = "GetItem"
  }
  
  tags = var.tags
}

# DynamoDB Throttled Requests Alarm
resource "aws_cloudwatch_metric_alarm" "db_throttled_requests" {
  alarm_name          = "${var.cluster_name}-db-throttled-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 60
  statistic           = "Sum"
  threshold           = var.db_throttled_requests_threshold
  alarm_description   = "This metric monitors database throttled requests"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    TableName = "${var.prefix}-pets"
  }
  
  tags = var.tags
}
# Container Insights - Node Network Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "container_insights_node_network" {
  alarm_name          = "${var.cluster_name}-node-network-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "node_network_total_bytes"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = 1000000000 # 1GB network traffic threshold
  alarm_description   = "This metric monitors node network utilization using Container Insights"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
  }
  
  tags = var.tags
}

# Cache Hit Rate Alarm
resource "aws_cloudwatch_metric_alarm" "cache_hit_rate" {
  alarm_name          = "${var.cluster_name}-cache-hit-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CacheHitRate"
  namespace           = "Custom/Cache"
  period              = 60
  statistic           = "Average"
  threshold           = var.cache_hit_rate_threshold
  alarm_description   = "This metric monitors cache hit rate"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
    CacheId     = "${var.prefix}-cache"
  }
  
  tags = var.tags
}

# Cache Latency Alarm
resource "aws_cloudwatch_metric_alarm" "cache_latency" {
  alarm_name          = "${var.cluster_name}-cache-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CacheLatency"
  namespace           = "Custom/Cache"
  period              = 60
  statistic           = "Average"
  threshold           = var.cache_latency_threshold
  alarm_description   = "This metric monitors cache operation latency"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
    CacheId     = "${var.prefix}-cache"
  }
  
  tags = var.tags
}

# Cache Health Check Alarm
resource "aws_cloudwatch_metric_alarm" "cache_health" {
  alarm_name          = "${var.cluster_name}-cache-health"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "CacheHealthCheckFailures"
  namespace           = "Custom/Cache"
  period              = 60
  statistic           = "Maximum"
  threshold           = var.cache_health_check_threshold
  alarm_description   = "This metric monitors cache health check failures"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
    CacheId     = "${var.prefix}-cache"
  }
  
  treat_missing_data = "breaching"
  
  tags = var.tags
}

# Cache Eviction Rate Alarm
resource "aws_cloudwatch_metric_alarm" "cache_eviction_rate" {
  alarm_name          = "${var.cluster_name}-cache-eviction-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CacheEvictionRate"
  namespace           = "Custom/Cache"
  period              = 60
  statistic           = "Average"
  threshold           = 100 # 100 evictions per minute
  alarm_description   = "This metric monitors cache eviction rate"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  dimensions = {
    ClusterName = var.cluster_name
    CacheId     = "${var.prefix}-cache"
  }
  
  tags = var.tags
}
