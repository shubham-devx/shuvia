# Shuvia search launch checklist

## Implemented in the application

- Canonical origin is `https://shuvia.com`; `www.shuvia.com` is permanently redirected to the apex domain.
- Public pages declare canonical URLs and social sharing metadata.
- `/robots.txt` allows public pages, excludes API and auth callback paths, and points to `/sitemap.xml`.
- The sitemap contains only the homepage, contact page, privacy policy, and terms page. Signup, login, connection, invitation, and private product routes are excluded.
- Auth and private pages use `noindex`; the proxy also sends `X-Robots-Tag` for those paths.
- Homepage JSON-LD describes the website, organization, and founder using only supplied facts.

## Before requesting indexing

1. Add and verify the `shuvia.com` Domain property in Google Search Console using the DNS TXT record Google provides. Keep that record in the DNS provider; do not put verification secrets in frontend code.
2. Deploy the site and confirm the HTTPS apex domain, `https://shuvia.com/robots.txt`, `https://shuvia.com/sitemap.xml`, and `https://shuvia.com/images/shuvia-og.png` return successfully.
3. In Search Console, submit `https://shuvia.com/sitemap.xml`, then inspect the homepage and request indexing if Google reports it as eligible.
4. Review indexed URLs and crawl errors after deployment. Indexing and ranking are controlled by Google and cannot be guaranteed by the application.
5. Add verified official social profile links and JSON-LD `sameAs` values once the accounts exist. No profile URLs were supplied for this implementation.
6. Have the launch-draft privacy policy and terms reviewed and finalized before relying on them as production legal documents.

Google Search Console ownership, DNS, deployment, and indexing are external actions and have not been completed from this workspace.
