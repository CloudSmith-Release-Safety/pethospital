output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.this.dashboard_arn
}

output "alarm_arns" {
  description = "ARNs of the CloudWatch alarms"
  value = [
    aws_cloudwatch_metric_alarm.api_latency.arn,
    aws_cloudwatch_metric_alarm.error_rate.arn,
    aws_cloudwatch_metric_alarm.container_insights_pod_cpu.arn,
    aws_cloudwatch_metric_alarm.container_insights_pod_memory.arn,
    aws_cloudwatch_metric_alarm.container_insights_node_cpu.arn,
    aws_cloudwatch_metric_alarm.container_insights_node_memory.arn,
    aws_cloudwatch_metric_alarm.container_insights_node_disk.arn,
    aws_cloudwatch_metric_alarm.container_insights_node_network.arn,
    aws_cloudwatch_metric_alarm.cache_hit_rate.arn,
    aws_cloudwatch_metric_alarm.cache_latency.arn,
    aws_cloudwatch_metric_alarm.cache_health.arn,
    aws_cloudwatch_metric_alarm.cache_eviction_rate.arn
  ]
}

output "cache_alarm_arns" {
  description = "ARNs of the cache-related CloudWatch alarms"
  value = [
    aws_cloudwatch_metric_alarm.cache_hit_rate.arn,
    aws_cloudwatch_metric_alarm.cache_latency.arn,
    aws_cloudwatch_metric_alarm.cache_health.arn,
    aws_cloudwatch_metric_alarm.cache_eviction_rate.arn
  ]
}
