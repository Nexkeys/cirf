// "NGN 3,700,000". Spelled out instead of using the ₦ sign because the built-in PDF fonts
// don't include it, and messages should read the same in the app and in the report.
export const formatNaira = (amount) => `NGN ${Number(amount).toLocaleString('en-NG')}`
