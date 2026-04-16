export type Country = {
  countryCode: string;
  name: string;
  region?: string;
  incomeLevel?: string;
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};
