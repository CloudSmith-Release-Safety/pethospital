resource "aws_dynamodb_table" "this" {
  count = length(var.tables)

  name           = var.tables[count.index].name
  billing_mode   = var.tables[count.index].billing_mode
  hash_key       = var.tables[count.index].hash_key
  
  read_capacity  = var.tables[count.index].billing_mode == "PROVISIONED" ? var.tables[count.index].read_capacity : null
  write_capacity = var.tables[count.index].billing_mode == "PROVISIONED" ? var.tables[count.index].write_capacity : null
  
  dynamic "attribute" {
    for_each = var.tables[count.index].attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "ttl" {
    for_each = var.tables[count.index].ttl_enabled ? [1] : []
    content {
      enabled        = true
      attribute_name = var.tables[count.index].ttl_attribute_name
    }
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(
    {
      Name = var.tables[count.index].name
    },
    var.tags
  )
}
