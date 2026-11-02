resource "aws_db_subnet_group" "db" {
  name       = "${var.name}-db"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "db" {
  identifier                  = "${var.name}-db"
  engine                      = "postgres"
  engine_version              = "18"
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_storage_gb
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "docrequest"
  username                    = "docrequest"
  manage_master_user_password = true # password lives in Secrets Manager, not in Terraform state
  db_subnet_group_name        = aws_db_subnet_group.db.name
  vpc_security_group_ids      = [aws_security_group.db.id]
  publicly_accessible         = false
  backup_retention_period     = 7
  deletion_protection         = var.deletion_protection
  skip_final_snapshot         = !var.deletion_protection
  final_snapshot_identifier   = var.deletion_protection ? "${var.name}-db-final" : null
  auto_minor_version_upgrade  = true
  apply_immediately           = true
}
