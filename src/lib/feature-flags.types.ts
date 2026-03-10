/** Shared types for feature flags — kept in a separate file to avoid circular imports. */
export type FlagValue = boolean | string | number;

export type RuleCondition =
  | "user_id"
  | "account_id"
  | "email_domain"
  | "percentage"
  | "environment";

export type RuleOperator = "equals" | "contains" | "in" | "percentage_rollout";

export interface FlagRule {
  condition: RuleCondition;
  operator: RuleOperator;
  value: unknown;
  flagValue: FlagValue;
}

export interface FeatureFlag {
  key: string;
  defaultValue: FlagValue;
  description: string;
  rules: FlagRule[];
}

export interface FlagContext {
  userId?: string;
  accountId?: string;
  email?: string;
  environment?: string;
}
