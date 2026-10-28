// Business and executive views (ROI, cost, benchmarking, workforce, executive reports, the data hub) are
// built but hidden: the pilot is a clinical tool for TVNs. Set NEXT_PUBLIC_SHOW_BUSINESS_VIEWS=true in
// .env.local to bring them back. It is a literal property access so Next.js inlines it at build time.
export const SHOW_BUSINESS_VIEWS = process.env.NEXT_PUBLIC_SHOW_BUSINESS_VIEWS === 'true';
