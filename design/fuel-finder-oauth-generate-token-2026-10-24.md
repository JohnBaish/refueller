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

---

## Second screenshot (24 October): the responses and the regenerate call

Transcribed by Claude; the sample token strings (access and refresh) were not copied.

Response descriptions for the generate call: 401 Unauthorized – Invalid client
credentials; 429 Too Many Requests; 500 Internal server error; 502 Bad gateway (the
server received an invalid response from the upstream service); 503 Service temporarily
unavailable (please try again later); 504 Gateway timeout (the upstream server failed to
respond in time).

Shape of the 200 response sample (values other than the fixed ones not copied):

```json
{
  "success": true,
  "data": {
    "access_token": "…",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "…",
    "refresh_token_expires_in": 172800
  },
  "message": "Operation successful"
}
```

### Regenerate OAuth access token using refresh token for published forecourt data and fuel prices

`POST /api/v1/oauth/regenerate_access_token`

Text on the page: "1. Use this API to generate a new access token. The access token
expires in 1hr (3600 sec) as specified by the "expires_in" field in the "200 Access token
generated successfully" response. 2. Please ensure that your refresh tokens are not
expired while requesting the access token regeneration".

Request body schema: `application/json`, required (its fields are below the visible part
of the screenshot).
