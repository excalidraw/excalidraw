locals {
  cloudflare_free_managed_ruleset_id = "77454fe2d30c4220b5701f6fdfb893ba"
}

resource "cloudflare_ruleset" "tfdraw_managed_waf" {
  zone_id     = local.zone_id
  name        = "tfdraw.dev managed WAF"
  description = "Zone-level managed WAF entry point for tfdraw.dev."
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [
    {
      ref         = "execute_cloudflare_free_managed_ruleset"
      description = "Execute Cloudflare Free Managed Ruleset"
      expression  = "true"
      action      = "execute"
      action_parameters = {
        id = local.cloudflare_free_managed_ruleset_id
      }
      enabled = true
    }
  ]
}
