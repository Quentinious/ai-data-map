export type Country = {
  countryCode: string;
  name: string;
  region?: string;
  incomeLevel?: string;
};

export type CountryDetails = Country & {
  aiSummary: string;
};
