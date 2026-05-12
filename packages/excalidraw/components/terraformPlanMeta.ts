/**
 * Shared Terraform local-parse constants (kept separate from `terraformPlanParsing.tsx` so
 * layout helpers can import them without circular runtime imports).
 */
export const TERRAFORM_MODULE_TREE_KEY = "__terraform_module_tree__" as const;
