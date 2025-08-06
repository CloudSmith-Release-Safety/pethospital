# Authentication Monitoring - Failed Login Attempts
resource "aws_cloudwatch_metric_alarm" "auth_failed_logins" {
  alarm_name          = "${var.prefix}-auth-failed-logins"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FailedLoginAttempts"
  namespace           = "PetHospital/Auth"
  period              = 300
  statistic           = "Sum"
  threshold           = 10 # Alert if more than 10 failed logins in 5 minutes
  alarm_description   = "This metric monitors failed login attempts"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  tags = var.tags
}

# Authentication Monitoring - Token Validation Failures
resource "aws_cloudwatch_metric_alarm" "auth_token_validation_failures" {
  alarm_name          = "${var.prefix}-auth-token-validation-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TokenValidationFailures"
  namespace           = "PetHospital/Auth"
  period              = 300
  statistic           = "Sum"
  threshold           = 20 # Alert if more than 20 token validation failures in 5 minutes
  alarm_description   = "This metric monitors token validation failures"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  tags = var.tags
}

# Authentication Monitoring - Session Duration
resource "aws_cloudwatch_metric_alarm" "auth_session_duration" {
  alarm_name          = "${var.prefix}-auth-session-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "SessionDuration"
  namespace           = "PetHospital/Auth"
  period              = 300
  statistic           = "Average"
  threshold           = 3600 # Alert if average session duration exceeds 1 hour
  alarm_description   = "This metric monitors average session duration"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  tags = var.tags
}

# Authentication Monitoring - Token Refresh Rate
resource "aws_cloudwatch_metric_alarm" "auth_token_refresh_rate" {
  alarm_name          = "${var.prefix}-auth-token-refresh-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TokenRefreshRate"
  namespace           = "PetHospital/Auth"
  period              = 300
  statistic           = "Sum"
  threshold           = 100 # Alert if more than 100 token refreshes in 5 minutes
  alarm_description   = "This metric monitors token refresh rate"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.ok_actions
  
  tags = var.tags
}