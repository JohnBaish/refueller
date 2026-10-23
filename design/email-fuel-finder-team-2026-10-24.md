<!-- Draft email for John to send on Monday 26 October 2026 (written 24 October). No credentials in it.
     To: fuel.finder@ve3.global (the address on GOV.UK's Fuel Finder help page; phone 02038 365 818,
     Monday to Friday 9am to 5pm). John to change the wording as he likes. -->

**To:** fuel.finder@ve3.global

**Subject:** Fuel Finder site and API return 403 to requests from cloud servers

Hello,

I registered as an Information Recipient on 24 October 2026 for a free, non-commercial website that shows the nearest petrol stations to a postcode, with their unleaded and diesel prices. It sets no cookies and collects no personal data (only anonymous visit statistics), and it will carry the Open Government Licence credit and a link to your Report a Discrepancy page.

My scheduled job cannot reach your service. Every request to www.fuel-finder.service.gov.uk from a GitHub Actions server (a US datacentre address) gets HTTP 403 with an empty body from CloudFront, including your public Report a Discrepancy page, so I cannot get as far as signing in. The same page loads normally from my UK home broadband.

Could you tell me:

1. Is the service restricted by country, or by type of network?
2. What do you recommend for a small site that has to fetch data on a schedule and meet the Fair Use rule of using the latest CSV, or calling the API at least every five minutes on average?
3. Can the CSV be fetched automatically from a fixed address? If so, where is it?
4. Can the API be opened to a specific server address or service?

Thank you,
John Baish
