output "table_names" {
  description = "Names of the created DynamoDB tables"
  value       = aws_dynamodb_table.this[*].name
}

output "table_arns" {
  description = "ARNs of the created DynamoDB tables"
  value       = aws_dynamodb_table.this[*].arn
}

output "connection_pool_config" {
  description = "Connection pool configuration for DynamoDB"
  value       = var.connection_pool_config
}

output "backup_vault_name" {
  description = "Name of the backup vault for DynamoDB tables"
  value       = var.backup_enabled ? aws_backup_vault.dynamodb_backup[0].name : null
}

output "backup_plan_id" {
  description = "ID of the backup plan for DynamoDB tables"
  value       = var.backup_enabled ? aws_backup_plan.dynamodb_backup[0].id : null
}

output "monitoring_alarms" {
  description = "List of CloudWatch alarms for DynamoDB tables"
  value       = var.monitoring_config.enable_performance_insights ? {
    read_capacity_alarms  = aws_cloudwatch_metric_alarm.read_capacity_alarm[*].arn
    write_capacity_alarms = aws_cloudwatch_metric_alarm.write_capacity_alarm[*].arn
    throttled_requests_alarms = aws_cloudwatch_metric_alarm.throttled_requests_alarm[*].arn
  } : null
}

output "rollback_function" {
  description = "ARN of the Lambda function for database rollback"
  value       = var.rollback_config.enable_automatic_rollback ? aws_lambda_function.db_rollback[0].arn : null
}