export type AIRateLimitWarningVariant =
  | "messageLimitExceeded"
  | "rateLimitExceeded";

export type AIRateLimitWarningDescriptor = {
  kind: "rateLimit";
  variant: AIRateLimitWarningVariant;
  rateLimit?: number | null;
  rateLimitRemaining?: number | null;
};
