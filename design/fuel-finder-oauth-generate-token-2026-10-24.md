<!-- Transcribed by Claude on 24 October 2026 from a screenshot John pasted of the
     "Generate OAuth access token for published forecourt data and fuel prices" page
     of the Fuel Finder developer portal. The two long strings shown in the request
     sample (client_id and client_secret) were not copied; they are documentation
     placeholders, not credentials. Not re-checked at source (the portal blocks the
     session's container). -->

# Generate OAuth access token for published forecourt data and fuel prices

`POST /api/v1/oauth/generate_access_token`  (the screenshot shows the path only, no host)

Text on the page: "1. Use this API to generate a new access token and refresh token.
The access token expires in 1hr (3600 sec) as specified by the "expires_in" field in
the 200 Access token generated successfully response. The refresh token expires in
48hrs (172800 sec) as specified by the "refresh_token_expires_in" field in the "200
Access token generated successfully" response."

Request body schema: `application/json`, required.

| Field | Type | |
|---|---|---|
| client_id | string | required |
| client_secret | string | required |

Request sample (payload, content type `application/json`): an object with `client_id`
and `client_secret` (values not copied).

Responses listed: 200 Access token generated successfully; 400 Invalid request
payload; 401 Unauthorized – Invalid client credentials; and sample tabs for 429, 500,
502, 503 and 504 (their descriptions are below the visible part of the screenshot).

The sidebar also lists the second endpoint, "Regenerate OAuth access token using
refresh token for published forecourt data and fuel prices" (POST); its page was not
shown.
