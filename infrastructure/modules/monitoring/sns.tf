# SNS Topic for Critical Alerts
resource "aws_sns_topic" "critical_alerts" {
  name = "${var.cluster_name}-critical-alerts"
  
  tags = merge(var.tags, {
    Purpose = "Critical system alerts"
  })
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "critical_alerts" {
  arn = aws_sns_topic.critical_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = "sns:Publish"
        Resource = aws_sns_topic.critical_alerts.arn
      }
    ]
  })
}

# Email subscription for critical alerts
resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
