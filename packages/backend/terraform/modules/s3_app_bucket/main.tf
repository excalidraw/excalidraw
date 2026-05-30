module "bucket" {
  source = "../encrypted_s3_bucket"

  bucket_name = var.bucket_name
  tags        = var.tags
}
