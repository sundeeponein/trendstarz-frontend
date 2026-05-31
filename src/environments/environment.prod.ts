export const environment = {
  production: true,
  apiBaseUrl: 'https://trendstarz-backend-production.up.railway.app/api',
  cloudinaryUploadPreset: 'trendstarz_prod', // <-- Replace with your unsigned upload preset
  cloudinaryCloudName: 'ddnsoypf8', // <-- Replace with your cloud name
  marketplacePublicMinInfluencers: 20,
  marketplacePublicMinBrands: 5,
  // Set this to the live Razorpay Key ID before deploying.
  razorpayKeyId: 'rzp_live_XXXXXXXXXXXXXXXX',
};
