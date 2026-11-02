# The master key. DocRequest asks KMS to wrap and unwrap each file's own key;
# the key material never leaves KMS.
resource "aws_kms_key" "files" {
  description             = "${var.name}: wraps per-file encryption keys"
  enable_key_rotation     = true
  deletion_window_in_days = 7
}

resource "aws_kms_alias" "files" {
  name          = "alias/${var.name}-files"
  target_key_id = aws_kms_key.files.key_id
}

resource "random_id" "bucket" {
  byte_length = 4
}

# Holds only ciphertext under random names. Files are also encrypted at rest by S3 with the same KMS key.
resource "aws_s3_bucket" "files" {
  bucket        = "${var.name}-files-${random_id.bucket.hex}"
  force_destroy = var.force_destroy_bucket
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.files.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_policy" "tls_only" {
  bucket = aws_s3_bucket.files.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource  = [aws_s3_bucket.files.arn, "${aws_s3_bucket.files.arn}/*"]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.files]
}
