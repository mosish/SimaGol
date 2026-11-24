# SimaGol experience

| Persona | Task | Design decision |
| --- | --- | --- |
| Gift buyer on a phone | Send flowers with a message by a particular time | Show the bouquet, price in toman, remaining stock, delivery choices and final total before confirmation. |
| Returning customer | Send to a saved address and check delivery progress | Keep order history, profile, addresses, invoices and reorder together in Account. |
| Florist | Adjust today's stock, update copy and dispatch orders | Separate merchandising controls from the fulfilment queue. Show only permitted actions. |

## Sitemap and wireframes
1. Home and collection. A compact header carries the language and theme switches, account and bag. A two-column floral hero leads into category chips, search, and an image-led four-column collection. At tablet width use two product columns. On phones the hero stacks and controls wrap.
2. Product. Open a linkable detail dialog with photo, heading, description, stock and purchase action. Escape and a named close button dismiss it.
3. Bag and checkout. Quantity controls lead into sign-in, recipient and address, delivery method and slot, gift wrap and message. Show fees and final amount before placing the pay-on-delivery order.
4. Account. Authentication precedes personal settings and address book. Each order lists its immutable items, payment method and fulfilment status. Printable invoices and reorder actions use the historical snapshot and current availability respectively.
5. Staff. A role-aware workspace groups orders, catalog, customers and bilingual site settings. Forms keep labels visible. Changes are validated by the same API for all clients.
6. Empty, loading and missing routes use configurable mascot placements. Leave Sima's portrait blank until an approved reference arrives.

## Visual and interaction tokens
Use warm ivory (#FAF7F9), pale lilac (#EEE6F2), dark plum ink (#38273D), and plum buttons (#593959) with white text. Night uses #241F27 backgrounds, #312933 surfaces and #F7EEF4 text. Use Tahoma for Persian body, Segoe UI for English, and Georgia with local serif fallback for display. No external fonts are required. Use the 4, 8, 12, 16, 24, 32 and 48 px spacing scale. Rounded raised surfaces use soft shadows and explicit borders. Use CSS logical spacing and document-level lang/dir.

## Accessibility acceptance
Target WCAG 2.1 AA. Exercise the skip link, visible focus, labels, error announcements, modal dismissal, screen reader reading order, 200% zoom, 320 CSS px reflow and reduced motion. Review all color pairs when publishing custom media. Sign in, order, open an invoice and dispatch with keyboard alone in both languages. Complete a human assistive-technology review before claiming conformance.
