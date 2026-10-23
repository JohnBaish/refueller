<!-- "Fuel Finder Public API" introduction, pasted by John into the chat on 24 October
     2026 and saved here unchanged (formatting only). The last sentence of the first
     paragraph is cut off in the paste ("... to help you build applications and
     services for drivers to find fuel and"). Source: www.developer.fuel-finder.service.gov.uk
     (not reachable from the session's container, so not re-checked at source). -->

Fuel Finder Public API
Access the Fuel Finder API to retrieve real-time fuel prices and forecourt amenities data. This API provides comprehensive information about fuel prices and services across all registered filling stations to help you build applications and services for drivers to find fuel and 
The API provides data that is updated within 30 minutes of any changes, as required by [The Motor Fuel Price (Open Data) Regulations 2025](https://www.legislation.gov.uk/uksi/2025/1356/introduction/made).
Before you start
You'll need:

* a GOV.UK One Login to access the API
* understanding of REST API principles
* technical capability to integrate with JSON APIs
* knowledge of your target geographic areas or specific forecourt requirements

The API follows REST principles: resources have stable URLs and map to standard HTTP methods. You can read data by issuing simple GET requests to the relevant resource URL.
This API covers filling stations in the United Kingdom.
What you get:

* current retail prices of all the petrol stations by fuel grades
* forecourt details (address, operator, brand)
* site amenities and opening hours
* update timestamps for each price and site

API authentication
Access to API services requires authentication. The Fuel Finder API supports OAuth 2.0 (client credentials).
