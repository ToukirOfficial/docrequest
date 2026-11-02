#!/usr/bin/env sh
# Deletes everything this Terraform created, including the database and every stored file.
set -eu
cd "$(dirname "$0")"
printf 'This permanently deletes the DocRequest server, database, files and encryption key.\nType "delete everything" to continue: '
read -r answer
[ "$answer" = "delete everything" ] || { echo "Cancelled."; exit 1; }
# Lift the safety catches first, then destroy.
terraform apply -auto-approve -var deletion_protection=false -var force_destroy_bucket=true
terraform destroy -auto-approve -var deletion_protection=false -var force_destroy_bucket=true
echo "Done. The KMS key is scheduled for deletion in 7 days (AWS minimum)."
