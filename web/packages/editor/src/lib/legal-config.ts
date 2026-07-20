import { env } from '$env/dynamic/public';

const required = (label: string) => `[REQUIRED BEFORE PUBLICATION: ${label}]`;

export const legalConfig = {
  operatorName: env.PUBLIC_LEGAL_OPERATOR_NAME || required('operator or company name'),
  streetAddress: env.PUBLIC_LEGAL_STREET_ADDRESS || required('street and house number'),
  postalCode: env.PUBLIC_LEGAL_POSTAL_CODE || required('postal code'),
  locality: env.PUBLIC_LEGAL_LOCALITY || required('city'),
  country: env.PUBLIC_LEGAL_COUNTRY || required('country'),
  email: env.PUBLIC_LEGAL_EMAIL || 'support@vesp.cloud',
  supervisoryAuthority:
    env.PUBLIC_LEGAL_SUPERVISORY_AUTHORITY || required('competent data protection authority'),
  disputeResolution: env.PUBLIC_LEGAL_DISPUTE_RESOLUTION || '',
};

export function isMissingLegalValue(value: string): boolean {
  return value.startsWith('[REQUIRED BEFORE PUBLICATION:');
}

export const hasMissingRequiredLegalValues = [
  legalConfig.operatorName,
  legalConfig.streetAddress,
  legalConfig.postalCode,
  legalConfig.locality,
  legalConfig.country,
  legalConfig.supervisoryAuthority,
].some(isMissingLegalValue);
