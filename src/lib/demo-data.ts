/**
 * Demo data. Realistic companies, names, amounts in USD.
 */

export const DEMO_COMPANIES = [
  { name: "Acme Industries Inc.", country: "United States", currency: "USD" },
  { name: "Port of Spain Trading Co.", country: "Trinidad and Tobago", currency: "TTD" },
  { name: "Kingston Fresh Produce", country: "Jamaica", currency: "JMD" },
  { name: "Bridgetown Software Solutions", country: "Barbados", currency: "BBD" },
  { name: "Summit Lumber & Hardware", country: "United States", currency: "USD" },
  { name: "Caroni Sugar Estates", country: "Trinidad and Tobago", currency: "TTD" },
  { name: "Metro Builders LLC", country: "United States", currency: "USD" },
  { name: "St. Lucia Distillers Ltd.", country: "Saint Lucia", currency: "XCD" },
];

export const DEMO_PEOPLE = [
  "Devi Persaud",
  "Andre Williams",
  "Camille Baptiste",
  "Rajesh Singh",
  "Keisha Campbell",
  "Marcus Thompson",
  "Priya Ramdeen",
  "David Fernandes",
  "Shantelle Greene",
  "Akash Doobay",
  "Nadine Charles",
  "Christopher Mohammed",
];

export const DEMO_INVOICES = [
  { id: "INV-001", customer: "Acme Industries Inc.", amount: 12450, currency: "USD", status: "Paid" as const },
  { id: "INV-002", customer: "Port of Spain Trading Co.", amount: 18500, currency: "TTD", status: "Overdue" as const },
  { id: "INV-003", customer: "Kingston Fresh Produce", amount: 89000, currency: "JMD", status: "Unpaid" as const },
  { id: "INV-004", customer: "Summit Lumber & Hardware", amount: 8450, currency: "USD", status: "Draft" as const },
  { id: "INV-005", customer: "Caroni Sugar Estates", amount: 1200000, currency: "TTD", status: "Paid" as const },
];

export const DEMO_DEALS = [
  { company: "Bridgetown Software Solutions", value: 42000, currency: "BBD", stage: "Proposal" as const, rep: "Devi Persaud" },
  { company: "St. Lucia Distillers Ltd.", value: 18500, currency: "XCD", stage: "Qualified" as const, rep: "Andre Williams" },
  { company: "Metro Builders LLC", value: 89500, currency: "USD", stage: "Negotiation" as const, rep: "Camille Baptiste" },
];

export const CARIBBEAN_COUNTRIES = [
  "United States",
  "Trinidad and Tobago",
  "Jamaica",
  "Barbados",
  "Bahamas",
  "Belize",
  "Suriname",
  "Saint Lucia",
  "Grenada",
  "Antigua and Barbuda",
  "Dominica",
  "Saint Vincent and the Grenadines",
  "Haiti",
  "Dominican Republic",
  "Cuba",
];

export const INDUSTRIES = [
  "Mining & Resources",
  "Agriculture",
  "Retail",
  "Manufacturing",
  "Construction",
  "Professional Services",
  "Hospitality",
  "Technology",
  "Distribution",
  "Other",
];
