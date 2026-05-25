terraform {
  required_version = ">= 1.5"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token. Defaults to CLOUDFLARE_API_TOKEN from the environment."
  default     = null
  sensitive   = true
}

locals {
  account_id = "456df569e19a171982d07ee7be6db716"
  zone_id    = "8aad82763aa1144a148989b4600c44f3"
}
