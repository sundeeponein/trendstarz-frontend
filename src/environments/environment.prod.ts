export const environment = {
  production: true,
  apiBaseUrl: 'https://trendstarz-backend-production.up.railway.app/api',
  cloudinaryUploadPreset: 'trendstarz_prod', // <-- Replace with your unsigned upload preset
  cloudinaryCloudName: 'ddnsoypf8', // <-- Replace with your cloud name
  marketplacePublicMinInfluencers: 20,
  marketplacePublicMinBrands: 5,
  // Set this to the live Razorpay Key ID before deploying.
  razorpayKeyId: 'rzp_live_XXXXXXXXXXXXXXXX',
  firebase: {
    apiKey: "AIzaSyDfvDexaapUpOdM07hWX6q-gtZ11R5Aa64",
    authDomain: "trendstarz-d3c58.firebaseapp.com",
    projectId: "trendstarz-d3c58",
    storageBucket: "trendstarz-d3c58.firebasestorage.app",
    messagingSenderId: "1061411269260",
    appId: "1:1061411269260:web:c0a53ce4ada4e83b54a9a9",
    measurementId: "G-QB2WN99QYL"
  },
};
