<!-- "API documentation" index of the Fuel Finder developer portal, pasted by John into
     the chat on 24 October 2026 and saved here unchanged (formatting only).
     Source: www.developer.fuel-finder.service.gov.uk (not reachable from the
     session's container, so not re-checked at source). -->

API documentation

* [Information Recipient API's](https://www.developer.fuel-finder.service.gov.uk/fuel-finder/apis-ifr/info-recipent)
API to fetch fuel prices and PFS station information, including incremental updates.
* [OAuth Access Token Generation API](https://www.developer.fuel-finder.service.gov.uk/fuel-finder/apis-ifr/access-token)
This API generates OAuth-style access tokens using a client_id and client_secret. The generated access and refresh tokens are used to authenticate subsequent API requests within the Fuel Finder ecosystem. **Token request guidance:** Developers should reuse valid access tokens and refresh tokens until they are close to expiry. Tokens should not be requested before every API call where the existing access token is still valid, as this creates unnecessary load on the service.
