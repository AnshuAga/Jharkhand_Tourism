export const tourismVerificationAbi = [
  'function owner() view returns (address)',
  'function issueCertificate(string providerId, string certificateHash, uint256 validUntil)',
  'function verifyCertificate(string providerId) view returns (string returnedProviderId, string certificateHash, uint256 issuedAt, uint256 validUntil)',
  'function revokeCertificate(string providerId)'
];
