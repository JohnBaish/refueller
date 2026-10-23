<!-- Overview and "API Testing" sections of the Fuel Finder developer portal,
     pasted by John into the chat on 24 October 2026 and saved here unchanged
     (formatting only). Source: www.developer.fuel-finder.service.gov.uk (not
     reachable from the session's container, so not re-checked at source). -->

Fuel Finder Developer Portal

Build with the Fuel Finder APIs to access trusted data and submit price updates.

Fuel Finder is a UK government service that brings together live retail fuel prices and filling station information across the United Kingdom. It helps motor fuel traders meet their reporting duties and enables authorised information recipients to consume trusted open data (current prices, filling station details and time-stamped updates).

API products

Fuel Finder Public API (for information recipients) to read trusted open data — current prices by fuel grades, forecourt details, amenities, and time-stamped updates.

Fuel Finder REST API
The Fuel Finder API is a REST API that gives a simple, consistent way to request, create and update data. REST stands for Representational State Transfer which is an architectural software style in which standard HTTP request methods are used to retrieve and modify representations of data. This is identical to the process of retrieving a web page or submitting a web form.
Representational State Transfer (REST) web services
In a RESTful API, each data resource has a unique URL and is manipulated using standard HTTP verbs such as:

* `GET `to request a resource
* `POST `to create a resource (not used for read-only endpoints)
* `PUT `to change a resource (not used for read-only endpoints)
* `DELETE `to remove a resource (not used for read-only endpoints)

Example: request a price resource

```
GET: https://api.fuelfinder.service.gov.uk/v1/prices/GB-12345 HTTP/1.1 
```

The request uses GET and does not include a request body.
In a RESTful API, a resource is modified by POSTing a revised resource representation, in this case JSON, to the same resource URL:

```
POST: https://api.fuelfinder.service.gov.uk/v1/<endpoint> 
```


```
Content-Type: text/json 
```


```
	{ 
		"CustomerName": "Joe Bloggs", 
		"Address": "", 
		"etc": etc 
	} 
```

REST builds on the features of HTTP. Because each resource has a globally unique URL and can be fetched with GET, REST APIs can benefit from existing network components such as caches and proxies.
The JSON data format
Responses use JSON (JavaScript Object Notation). JSON is a compact, widely used format for storing and exchanging data. Most programming languages support JSON, which makes it well suited to HTTP-based API services.
API specifications
The API specifications describe every Fuel Finder operation.

* Information recipients: read trusted open data — current prices by fuel grades, forecourt details, amenities, and time-stamped updates.
* Motor fuel traders: submit fuel prices.

API authentication
Access to API services requires authentication. Fuel Finder uses OAuth 2.0 (client credentials) in both test and production environments.
OAuth 2.0 (client credentials)
Use OAuth 2.0 client credentials to obtain a short-lived access token. You’ll need a client and client secret for your application.
Token request (example)

```
POST: 
```


```
Content-Type: application/x-www-form-urlencoded 
```


```
grant_type: client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=fuelfinder.read 
```

Successful response (example)

```
{ "access_token": "eyJhbGciOi...", "token_type": "Bearer", "expires_in": 3600 } 
```

Call the API with your token
Include the token in the Authorization header on each request.

```
GET : /v1/prices?fuel_type=unleaded 
```


```
Authorization: Bearer ACCESS_TOKEN 
```

If the token is missing, expired or invalid, the API returns 401 Unauthorized.
Environments 

* Test – use test client credentials to integrate and trial your application.
* Production – use production client credentials for live data.


API Testing
Environments
Fuel Finder APIs run in live and test environments. Live provides access to real data and production services. The test environment mirrors live API versions and lets developers test integrations safely.
Live
The live environment runs all production APIs listed in the developer documentation.

* Public data for information recipients (read-only)
* Price submission for motor fuel traders (write operations)

Test
The test environment mirrors the live API and allows developers to integrate and experiment safely without affecting production data.
To use the test environment, you must create a separate test account and obtain dedicated OAuth client credentials. Visit the test onboarding page at some https://www.fuel-finder.service.gov.uk to register a test user, set up your application, and generate your test OAuth keys.
Test environment credentials are not valid in the live environment, and live credentials cannot be used for testing. Make sure your application targets the correct base URL and key set when switching between environments.
Testing public data APIs (information recipients)
Public data APIs are read-only and allow information recipients to access trusted open data (current prices by fuel grades, forecourt details, amenities, timestamped updates). These endpoints support GET requests with Bearer tokens obtained through OAuth 2.0 client credentials.
Because they are read only, you can test public data APIs against live or test environment.
Testing price submission APIs (motor fuel traders)
Price submission APIs allow creation and update of data (for example, submitting new prices). These endpoints use the HTTP POST method and require a Bearer access token from OAuth 2.0 (client credentials).
Testing write operations must be done in the test environment only.
How developers can test price submission APIs in the test environment

* Register your Motor Fuel Trader (MFT) organisation and the associated Petrol Fuelling Stations (PFS) using the Fuel Finder Portal (FF service staging URL).
* Use the forecourt IDs of the registered PFSs to create your price submission transactions.
* Obtain an access token from the sandbox identity service using your client ID and client secret (OAuth 2.0 client credentials).
* Submit a price update for one or more PFSs using the access token and the forecourt ID(s).
* Poll the transaction for mock status updates and handle accepted or rejected outcomes.
