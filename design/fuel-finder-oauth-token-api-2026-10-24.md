<!-- "OAuth Access Token Generation API" page of the Fuel Finder developer portal, pasted
     by John into the chat on 24 October 2026 and saved here with the table laid out as
     Markdown, words unchanged. The paste has no addresses or parameters, and the
     Version field was empty. Source: www.developer.fuel-finder.service.gov.uk (not
     reachable from the session's container, so not re-checked at source). -->

OAuth Access Token Generation API

Version:

Description: This API generates OAuth-style access tokens using a client_id and client_secret. The generated access and refresh tokens are used to authenticate subsequent API requests within the Fuel Finder ecosystem. **Token request guidance:** Developers should reuse valid access tokens and refresh tokens until they are close to expiry. Tokens should not be requested before every API call where the existing access token is still valid, as this creates unnecessary load on the service.

Endpoints

| Method | Endpoint |
|---|---|
| POST | Generate OAuth access token for published forecourt data and fuel prices. |
| POST | Regenerate OAuth access token using refresh token for published forecourt data and fuel prices. |
