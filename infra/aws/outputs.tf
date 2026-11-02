output "public_ip" {
  description = "Point your domain's DNS A record here."
  value       = aws_eip.app.public_ip
}

output "url" {
  value = "https://${var.domain}"
}

output "bucket" {
  value = aws_s3_bucket.files.bucket
}

output "kms_key_arn" {
  value = aws_kms_key.files.arn
}

output "shell" {
  description = "Open a shell on the server (no SSH needed)."
  value       = "aws ssm start-session --region ${var.region} --target ${aws_instance.app.id}"
}
