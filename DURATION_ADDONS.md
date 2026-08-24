# Duration-based service add-ons

Lunarist service add-ons support three types:

- Fixed: a flat dollar surcharge.
- Percentage: a percentage of the base service price.
- Video duration: charges only for time beyond an included threshold.

Example: `Video over 3 minutes will be charged +$10/30 sec`

Configuration:
- Included duration: 180 seconds (3:00)
- Charge unit: 30 seconds
- Price per unit: $10

Examples:
- 3:00 → +$0
- 3:01–3:30 → +$10
- 3:31–4:00 → +$20
- 4:01–4:30 → +$30

The final amount is recalculated in the inquiry UI and independently recalculated by the PayPal API so the client cannot tamper with the price.
