output "vpc_id" {
  description = "ID da VPC criada"
  value       = aws_vpc.main.id
}

output "instance_id" {
  description = "ID da instancia EC2 simulada"
  value       = aws_instance.api.id
}

output "bucket_name" {
  description = "Bucket de artefatos"
  value       = aws_s3_bucket.artifacts.bucket
}
