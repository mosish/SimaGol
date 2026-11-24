# HTTP API

Use the same origin that serves the storefront. Every write uses POST with a JSON object, Content-Type: application/json, the exact APP_ORIGIN in the Origin header and X-SimaGol: 1. Successful reads and writes return JSON. Authentication uses sg_session, a seven-day HttpOnly, SameSite=Lax cookie that is Secure in production. Login replaces the current session and logout revokes it. Keep session cookies private.

## Routes

| Method and path | Access | Input and response |
| --- | --- | --- |
| GET /api/health | Public | Checks database connectivity and returns {"ok":true}. |
| GET /api/store | Public | Returns catalog.categories, catalog.products and settings including delivery, slots, fees, content overrides, mascot and ordersEnabled. Hidden products are excluded. |
| GET /api/me | Public | Returns null or the current user with id, name, email, role, addresses and prefs. |
| POST /api/register | Public | name, email, password. Creates a customer, starts a session and returns the user (201). |
| POST /api/login | Public | email, password. Starts a session and returns the user (200). |
| POST /api/logout | Public | Empty object. Clears the cookie and returns {"ok":true}. |
| POST /api/profile | Signed in | Partial name, addresses (up to 20 strings), prefs (lang fa/en, dark boolean, favorites array with up to 500 product IDs). Returns the updated user. |
| GET /api/notifications | Signed in | Current user's in-app status events, newest first, with id, orderId, status, created and seen. |
| POST /api/notifications/read | Signed in | through, a positive integer notification ID. Marks this user's events through that ID as seen and returns {"ok":true}. |
| GET /api/orders | Signed in | Current user's orders, newest first. |
| GET /api/orders/{id} | Buyer, florist or owner | Returns one order, including its invoice snapshot. Hidden or unknown order returns 404. |
| POST /api/orders | Signed in | Creates a COD order and returns its snapshot (201). Requires ordersEnabled. See example below. |
| GET /api/admin | Staff | Owner receives clients, orders and products. Editor receives products, including hidden items. Florist receives orders. |
| POST /api/admin/status | Owner, florist | id, status. Returns updated order. Allowed transitions appear below. |
| POST /api/admin/role | Owner | id, role (customer, florist, editor, owner). Returns updated user. Preserves the last owner. |
| POST /api/admin/upload | Owner, editor | data as bare base64. Accepts JPEG, PNG or WebP signature, max 2 MiB decoded. Returns {"path":"uploads/…"} (201). |
| POST /api/admin/product | Owner, editor | Optional id, category, nameFa/En, descriptionFa/En, image, priceIrr, stock, hidden. Returns id. |
| POST /api/admin/category | Owner, editor | Optional id and nameFa/nameEn. Returns id. |
| POST /api/admin/slot | Owner, editor | Optional id, nameFa/nameEn, ends (ISO UTC ending Z), capacity. Returns id. Capacity must cover current bookings. |
| POST /api/admin/brand | Owner, editor | hero, logo, showHero and mascot_hero, mascot_empty, mascot_loading, mascot_404. Use a served image path or an optional empty reference. Returns id. |
| POST /api/admin/homepage | Owner, editor | first (hero or catalog), enabled (banner visibility), textFa, textEn, optional image. Both translations are required when enabled. Returns id. |
| POST /api/admin/copy | Owner, editor | key, copyFa, copyEn. Upserts one translation override. Returns id. |
| POST /api/admin/delivery | Owner, editor | standardOn/standardFee, expressOn/expressFee, scheduledOn/scheduledFee, wrapFee. Persists the complete set and returns id. |

Use actual property names such as nameFa and nameEn when a table entry shows nameFa/En. Product/category/slot writes with omitted or empty IDs create a row. An existing ID updates it. Use returned upload paths without a leading slash. All monetary values are integer rial. The storefront converts them to toman for display.

## Example buyer journey

In PowerShell against a local instance with ORDERS_ENABLED=true, register a fresh test account using a unique email. The session stays in memory:

```powershell
$shopUrl = 'http://localhost:3000'
$headers = @{ Origin = $shopUrl; 'X-SimaGol' = '1' }
$account = @{ name = 'Sample Buyer'; email = ('buyer-' + [guid]::NewGuid() + '@example.test'); password = 'A local test passphrase' }
Invoke-RestMethod "$shopUrl/api/register" -Method Post -Headers $headers -ContentType 'application/json' -Body ($account | ConvertTo-Json) -SessionVariable shopSession
$store = Invoke-RestMethod "$shopUrl/api/store"
$item = $store.catalog.products | Where-Object { $_.stock -gt 0 } | Select-Object -First 1
$order = @{
  key = [guid]::NewGuid().ToString()
  items = @(@{ id = $item.id; qty = 1 })
  recipient = 'Sample recipient'
  address = 'Test address in Tehran'
  phone = '09120000000'
  method = 'standard'
  wrap = $false
  message = ''
  expectedTotal = [long]$item.priceIrr + [long]$store.settings.delivery.standard.fee
}
Invoke-RestMethod "$shopUrl/api/orders" -Method Post -Headers $headers -ContentType 'application/json' -WebSession $shopSession -Body ($order | ConvertTo-Json -Depth 5)
Invoke-RestMethod "$shopUrl/api/orders" -WebSession $shopSession
```

The example requires an in-stock product and an enabled standard delivery method. Use GET /api/store to find currently available options. Scheduled orders require slot with a valid future slot ID. If wrap is true, include wrapFee in expectedTotal. The server re-reads prices, delivery fee, stock and capacity in the same transaction as the order insert. It rejects duplicate product IDs and returns an immutable snapshot with item names, unit prices, fees, delivery details and total.

Send the same order body and request key after a lost response. A replay returns the original order. Another payload using that key returns 409. Recover the original outcome before changing a purchase. Valid fulfilment paths are placed → preparing → shipped → delivered, or cancellation while placed/preparing. Cancellation restores stock and frees the delivery slot.

## Limits and errors

Errors use {"error":"message"} and an HTTP status. Common responses include 400 for invalid fields, 401 for missing or invalid login, 403 for a role/origin/header mismatch, 404 for a missing resource, 405 for unsupported methods, 409 for changed stock/price/slot or state conflicts, 413 for oversized request bodies, 415 for an unsupported content type, 422 for invalid decoded image data, 429 for throttling, and 500 for an unexpected service error.

Standard JSON bodies are limited to 64,000 bytes, upload bodies to 2,900,000 bytes. Login and registration share a 30-request limit per ten minutes per socket IP. At most two password hashes run simultaneously per process. Registration requires at least 12 Unicode code points and a password of at most 1,024 UTF-8 bytes. Sessions use random 32-byte tokens and SHA-256 lookup keys. Expired sessions fail authentication and are pruned when a new session is created.
