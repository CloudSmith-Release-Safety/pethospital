resource "aws_dynamodb_table" "this" {
  count = length(var.tables)

  name           = var.tables[count.index].name
  billing_mode   = var.tables[count.index].billing_mode
  hash_key       = var.tables[count.index].hash_key
  range_key      = var.tables[count.index].range_key
  
  read_capacity  = var.tables[count.index].billing_mode == "PROVISIONED" ? var.tables[count.index].read_capacity : null
  write_capacity = var.tables[count.index].billing_mode == "PROVISIONED" ? var.tables[count.index].write_capacity : null
  
  dynamic "attribute" {
    for_each = var.tables[count.index].attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "global_secondary_index" {
    for_each = var.tables[count.index].global_secondary_indexes
    content {
      name               = global_secondary_index.value.name
      hash_key           = global_secondary_index.value.hash_key
      range_key          = global_secondary_index.value.range_key
      projection_type    = global_secondary_index.value.projection_type
      non_key_attributes = global_secondary_index.value.non_key_attributes
      read_capacity      = var.tables[count.index].billing_mode == "PROVISIONED" ? global_secondary_index.value.read_capacity : null
      write_capacity     = var.tables[count.index].billing_mode == "PROVISIONED" ? global_secondary_index.value.write_capacity : null
    }
  }

  dynamic "local_secondary_index" {
    for_each = var.tables[count.index].local_secondary_indexes
    content {
      name               = local_secondary_index.value.name
      range_key          = local_secondary_index.value.range_key
      projection_type    = local_secondary_index.value.projection_type
      non_key_attributes = local_secondary_index.value.non_key_attributes
    }
  }

  dynamic "ttl" {
# Add users table specifically for authentication
resource "aws_dynamodb_table" "users_table" {
  name           = "${var.prefix}-users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"
  
  attribute {
    name = "id"
    type = "S"
  }
  
  attribute {
    name = "username"
    type = "S"
  }
  
  attribute {
    name = "email"
    type = "S"
  }
  
  global_secondary_index {
    name               = "UsernameIndex"
    hash_key           = "username"
    projection_type    = "ALL"
  }
  
  global_secondary_index {
    name               = "EmailIndex"
    hash_key           = "email"
    projection_type    = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(
    {
      Name = "${var.prefix}-users"
    },
    var.tags
  )
}
    for_each = var.tables[count.index].ttl_enabled ? [1] : []
    content {
      enabled        = true
      attribute_name = var.tables[count.index].ttl_attribute_name
    }
  }

  point_in_time_recovery {
    enabled = var.tables[count.index].backup_config.enabled
  }

  tags = merge(
    {
      Name = var.tables[count.index].name
    },
    var.tags
  )

  lifecycle {
    prevent_destroy = true
  }
}

# Create CloudWatch alarms for DynamoDB table metrics
resource "aws_cloudwatch_metric_alarm" "read_capacity_alarm" {
  count               = var.monitoring_config.enable_performance_insights ? length(var.tables) : 0
  alarm_name          = "${var.tables[count.index].name}-read-capacity-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedReadCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.monitoring_config.alarm_threshold_read_capacity
  alarm_description   = "This alarm monitors DynamoDB read capacity utilization"
  
  dimensions = {
    TableName = aws_dynamodb_table.this[count.index].name
  }
  
  alarm_actions = var.rollback_config.rollback_trigger_alarm_names
}

resource "aws_cloudwatch_metric_alarm" "write_capacity_alarm" {
  count               = var.monitoring_config.enable_performance_insights ? length(var.tables) : 0
  alarm_name          = "${var.tables[count.index].name}-write-capacity-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConsumedWriteCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.monitoring_config.alarm_threshold_write_capacity
  alarm_description   = "This alarm monitors DynamoDB write capacity utilization"
  
  dimensions = {
    TableName = aws_dynamodb_table.this[count.index].name
  }
  
  alarm_actions = var.rollback_config.rollback_trigger_alarm_names
}

resource "aws_cloudwatch_metric_alarm" "throttled_requests_alarm" {
  count               = var.monitoring_config.enable_performance_insights ? length(var.tables) : 0
  alarm_name          = "${var.tables[count.index].name}-throttled-requests-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = var.monitoring_config.alarm_threshold_throttled_requests
  alarm_description   = "This alarm monitors DynamoDB throttled requests"
  
  dimensions = {
    TableName = aws_dynamodb_table.this[count.index].name
  }
  
  alarm_actions = var.rollback_config.rollback_trigger_alarm_names
}

# Create a backup plan for DynamoDB tables
resource "aws_backup_plan" "dynamodb_backup" {
  count = var.backup_enabled ? 1 : 0
  name  = "dynamodb-backup-plan"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.dynamodb_backup[0].name
    schedule          = "cron(0 5 * * ? *)"
    
    lifecycle {
      delete_after = var.backup_retention_days
    }
  }
}

resource "aws_backup_vault" "dynamodb_backup" {
  count = var.backup_enabled ? 1 : 0
  name  = "dynamodb-backup-vault"
}

resource "aws_backup_selection" "dynamodb_backup" {
  count        = var.backup_enabled ? 1 : 0
  name         = "dynamodb-backup-selection"
  iam_role_arn = aws_iam_role.backup_role[0].arn
  plan_id      = aws_backup_plan.dynamodb_backup[0].id

  resources = [
    for table in aws_dynamodb_table.this : table.arn
  ]
}

resource "aws_iam_role" "backup_role" {
  count = var.backup_enabled ? 1 : 0
  name  = "dynamodb-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backup_policy" {
  count      = var.backup_enabled ? 1 : 0
  role       = aws_iam_role.backup_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

# Create a Lambda function for database rollback procedures
resource "aws_lambda_function" "db_rollback" {
  count         = var.rollback_config.enable_automatic_rollback ? 1 : 0
  function_name = "dynamodb-rollback-function"
  handler       = "index.handler"
  runtime       = "nodejs14.x"
  timeout       = 300
  memory_size   = 512
  
  role = aws_iam_role.lambda_role[0].arn
  
  environment {
    variables = {
      MAX_ROLLBACK_ATTEMPTS = var.rollback_config.max_rollback_attempts
      BACKUP_VAULT_NAME     = var.backup_enabled ? aws_backup_vault.dynamodb_backup[0].name : ""
    }
  }
  
  # This is a placeholder for the actual code
  filename = "${path.module}/lambda/rollback_function.zip"
  
  tags = var.tags
}

resource "aws_iam_role" "lambda_role" {
  count = var.rollback_config.enable_automatic_rollback ? 1 : 0
  name  = "dynamodb-lambda-rollback-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  count = var.rollback_config.enable_automatic_rollback ? 1 : 0
  name  = "dynamodb-lambda-rollback-policy"
  role  = aws_iam_role.lambda_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:*",
          "backup:*",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# Create a CloudWatch event rule to trigger the rollback function
resource "aws_cloudwatch_event_rule" "db_alarm_trigger" {
  count       = var.rollback_config.enable_automatic_rollback ? 1 : 0
  name        = "dynamodb-alarm-trigger"
  description = "Trigger when DynamoDB alarms go into ALARM state"

  event_pattern = jsonencode({
    source      = ["aws.cloudwatch"]
    detail_type = ["CloudWatch Alarm State Change"]
    detail = {
      state = {
        value = ["ALARM"]
      }
      alarmName = var.rollback_config.rollback_trigger_alarm_names
    }
  })
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  count     = var.rollback_config.enable_automatic_rollback ? 1 : 0
  rule      = aws_cloudwatch_event_rule.db_alarm_trigger[0].name
  target_id = "TriggerLambdaRollback"
  arn       = aws_lambda_function.db_rollback[0].arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  count         = var.rollback_config.enable_automatic_rollback ? 1 : 0
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.db_rollback[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.db_alarm_trigger[0].arn
}