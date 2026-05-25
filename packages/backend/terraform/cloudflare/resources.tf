resource "cloudflare_zone" "tfdraw_dev" {
  account = {
    id = local.account_id
  }

  name                = "tfdraw.dev"
  paused              = false
  type                = "full"
  vanity_name_servers = []
}

resource "cloudflare_dns_record" "tfdraw_dev_root" {
  content = "master.ainur-chb.pages.dev"
  name    = "tfdraw.dev"
  proxied = true
  settings = {
    flatten_cname = false
    ipv4_only     = false
    ipv6_only     = false
  }
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = local.zone_id
}

resource "cloudflare_pages_project" "ainur" {
  account_id        = local.account_id
  name              = "ainur"
  production_branch = "main"

  lifecycle {
    ignore_changes = all
  }
}

resource "cloudflare_pages_domain" "tfdraw_dev" {
  account_id   = local.account_id
  name         = "tfdraw.dev"
  project_name = cloudflare_pages_project.ainur.name
}

resource "cloudflare_workers_script" "ainur" {
  account_id         = local.account_id
  compatibility_date = "2025-05-12"
  script_name        = "ainur"

  assets = {
    directory = "../../../../excalidraw-app/build"
    config = {
      not_found_handling = "single-page-application"
    }
  }

  lifecycle {
    ignore_changes = all
  }
}

resource "cloudflare_workers_kv_namespace" "tfdraw_stats" {
  account_id = local.account_id
  title      = "TFDRAW_STATS"
}

resource "cloudflare_d1_database" "tfdraw_analytics" {
  account_id = local.account_id
  name       = "tfdraw-analytics"

  read_replication = {
    mode = "disabled"
  }
}
