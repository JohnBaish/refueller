<!-- "API fields guide" of the Fuel Finder developer portal, pasted by John into the
     chat on 24 October 2026 and saved here as a Markdown table, with the text and
     samples unchanged (the paste was tab-separated; the headings "location",
     "opening_times", "usual_daysusual_days" etc. are exactly as pasted).
     Source: www.developer.fuel-finder.service.gov.uk (not reachable from the
     session's container, so not re-checked at source). -->

# API fields guide

## Fetch PFS Information (and 'Incremental')

This endpoint is used to fetch the latest PFS information for all forecourts in the United Kingdom. The response is a JSON object containing the following fields:

| Field Name | Description | Sample |
|---|---|---|
| node_id | Unique identifier for the forecourt | 0028acef5f3afc41c7e7d56fb285a940dfb64d6fea01cb4accd79c148321112d |
| public_phone_number | The telephone number of the forecourt, if one is available to the public | +442071930000 |
| trading_name | Trading name of the forecourt | SuperFuel Loughborough |
| is_same_trading_and_brand_name | Indicates whether the trading name and brand name are the same | FALSE |
| brand_name | Registered brand name of the forecourt | SuperFuel |
| temporary_closure | Forecourt is currently temporarily closed for a period of three days or more | FALSE |
| permanent_closure | Is the forecourt permanently closed? | FALSE |
| permanent_closure_date | Date/time the forecourt was/will be closed | 2026-02-17T16:00:00.000Z |
| is_motorway_service_station | Is the forecourt located on a motorway? | FALSE |
| is_supermarket_service_station | Is the forecourt located on the site of a supermarket? | FALSE |
| location | | |
| address_line_1 | Forecourt address line 1 | 14 London Road |
| address_line_2 | Forecourt address line 2 | Fuelville |
| city | Forecourt city | Loughborough |
| country | Forecourt country | England |
| county | Forecourt county | Leicestershire |
| postcode | Forecourt postcode | LE11 9AA |
| latitude | Forecourt latitude | 51.503364 |
| longitude | Forecourt longitude | 1.82469 |
| amenities | Array of strings listing the amenities available at the forecourt | ["twenty_four_hour_fuel", "adblue_packaged", "adblue_pumps", "air_pump_or_screenwash", "car_wash", "customer_toilets", "lpg_pumps", "water_filling"] |
| opening_times | | |
| usual_daysusual_days | | |
| monday | | |
| open | Usual opening hours of the forecourt on a Monday | 06:00 |
| close | Usual closing hours of the forecourt on a Monday | 22:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Monday | FALSE |
| tuesday | | |
| open | Usual opening hours of the forecourt on a Tuesday | 00:00 |
| close | Usual closing hours of the forecourt on a Tuesday | 00:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Tuesday | TRUE |
| wednesday | | |
| open | Usual opening hours of the forecourt on a Wednesday | 00:00 |
| close | Usual closing hours of the forecourt on a Wednesday | 00:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Wednesday | TRUE |
| thursday | | |
| open | Usual opening hours of the forecourt on a Thursday | 00:00 |
| close | Usual closing hours of the forecourt on a Thursday | 00:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Thursday | TRUE |
| friday | | |
| open | Usual opening hours of the forecourt on a Friday | 00:00 |
| close | Usual closing hours of the forecourt on a Friday | 00:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Friday | TRUE |
| saturday | | |
| open | Usual opening hours of the forecourt on a Saturday | 00:00 |
| close | Usual closing hours of the forecourt on a Saturday | 00:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Saturday | TRUE |
| sunday | | |
| open | Usual opening hours of the forecourt on a Sunday | 00:00 |
| close | Usual closing hours of the forecourt on a Sunday | 00:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a Sunday | TRUE |
| bank_holidays | | |
| type | | |
| open_time | Usual opening hours of the forecourt on a bank holiday | 06:00 |
| close_time | Usual closing hours of the forecourt on a bank holiday | 22:00 |
| is_24_hours | Is the forecourt usually open for 24 hours on a bank holiday | FALSE |
| fuel_types | | |
| E10 | Does the forecourt supply E10 | TRUE |
| E5 | Does the forecourt supply E5 | TRUE |
| B7_Standard | Does the forecourt supply B7 Standard Diesel | TRUE |
| B7_Premium | Does the forecourt supply B7 Premium Diesel | FALSE |
| B10 | Does the forecourt supply B10 | FALSE |
| HVO | Does the forecourt supply HVO | FALSE |

## Fetch PFS Fuel Prices ('All' and 'Incremental')

This endpoint is used to fetch the latest PFS fuel prices for all forecourts in the United Kingdom. The response is a JSON object containing the following fields: All price timestamps are in UTC using ISO 8601 / RFC 3339 format with a trailing Z.

| Field Name | Description | Sample |
|---|---|---|
| node_id | Unique identifier for the forecourt | 0028acef5f3afc41c7e7d56fb285a940dfb64d6fea01cb4accd79c148321112d |
| public_phone_number | The telephone number of the forecourt, if one is available to the public | +442071930000 |
| trading_name | Trading name of the forecourt | SuperFuel Loughborough |
| fuel_prices | | |
| fuel_type | Fuel type identifier | E5 |
| price | Last recorded fuel price for E5 | 123.9 |
| price_last_updated | Date/time in UTC of last update to price of E5 | 2026-02-17T16:00:00.000Z |
| price_change_effective_timestamp | Date/time in UTC from when the updated price of E5 was effective | 2026-02-17T16:00:00.000Z |
| fuel_type | Fuel type identifier | E10 |
| price | Last recorded fuel price for E10 | 123.9 |
| price_last_updated | Date/time in UTC of last update to price of E10 | 2026-02-17T16:00:00.000Z |
| price_change_effective_timestamp | Date/time in UTC from when the updated price of E10 was effective | 2026-02-17T16:00:00.000Z |
| fuel_type | Fuel type identifier | B7_Standard |
| price | Last recorded fuel price for B7 Standard Diesel | 123.9 |
| price_last_updated | Date/time in UTC of last update to price of B7 Standard Diesel | 2026-02-17T16:00:00.000Z |
| price_change_effective_timestamp | Date/time in UTC from when the updated price of B7 Standard Diesel was effective | 2026-02-17T16:00:00.000Z |
| fuel_type | Fuel type identifier | B7_Premium |
| price | Last recorded fuel price for B7 Premium Diesel | 123.9 |
| price_last_updated | Date/time in UTC of last update to price of B7 Premium Diesel | 2026-02-17T16:00:00.000Z |
| price_change_effective_timestamp | Date/time in UTC from when the updated price of B7 Premium Diesel was effective | 2026-02-17T16:00:00.000Z |
| fuel_type | Fuel type identifier | B10 |
| price | Last recorded fuel price for B10 | 123.9 |
| price_last_updated | Date/time in UTC of last update to price of B10 | 2026-02-17T16:00:00.000Z |
| price_change_effective_timestamp | Date/time in UTC from when the updated price of B10 was effective | 2026-02-17T16:00:00.000Z |
| fuel_type | Fuel type identifier | HVO |
| price | Last recorded fuel price for HVO | 123.9 |
| price_last_updated | Date/time in UTC of last update to price of HVO | 2026-02-17T16:00:00.000Z |
| price_change_effective_timestamp | Date/time in UTC from when the updated price of HVO was effective | 2026-02-17T16:00:00.000Z |
