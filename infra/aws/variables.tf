variable "region" {
  description = "AWS region. eu-west-2 is London."
  type        = string
  default     = "eu-west-2"
}

variable "name" {
  description = "Prefix for every resource name."
  type        = string
  default     = "docrequest"
}

variable "domain" {
  description = "The domain DocRequest will answer on, e.g. docs.example.co.uk. Point its DNS A record at the output public_ip; HTTPS certificates are automatic."
  type        = string
}

variable "acme_email" {
  description = "Email for Let's Encrypt certificate notices."
  type        = string
}

variable "repo_url" {
  description = "Git repository to deploy."
  type        = string
  default     = "https://github.com/toukirofficial/docrequest.git"
}

variable "repo_ref" {
  description = "Branch or tag to deploy."
  type        = string
  default     = "main"
}

variable "instance_type" {
  description = "t4g.medium (4 GB) runs everything including ClamAV. Use t4g.small and clamav_enabled = false to save money."
  type        = string
  default     = "t4g.medium"
}

variable "clamav_enabled" {
  description = "Run ClamAV virus scanning (needs about 1.5 GB of RAM)."
  type        = bool
  default     = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_storage_gb" {
  type    = number
  default = 20
}

variable "deletion_protection" {
  description = "Protects the database from accidental deletion. teardown.sh turns it off first."
  type        = bool
  default     = true
}

variable "force_destroy_bucket" {
  description = "Allow destroying the S3 bucket while it still holds files. teardown.sh sets this."
  type        = bool
  default     = false
}

variable "smtp_url" {
  description = "Optional SMTP URL for real email, e.g. smtps://user:pass@email-smtp.eu-west-2.amazonaws.com:465. Empty keeps mail in files."
  type        = string
  default     = ""
  sensitive   = true
}

variable "mail_from" {
  type    = string
  default = "DocRequest <no-reply@localhost>"
}
