# Stripe Webhook Setup

## Endpoint

```
POST https://8xiczk0ua0.execute-api.us-east-1.amazonaws.com/default/webhook
```

## Environment Variables

Add these to the `stripe-webhook` Lambda:

- `STRIPE_SECRET_KEY` – Your Stripe secret key (same as checkout Lambda)
- `STRIPE_WEBHOOK_SECRET` – From Stripe Dashboard when creating the webhook

## Stripe Dashboard Configuration

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://8xiczk0ua0.execute-api.us-east-1.amazonaws.com/default/webhook`
4. Events to send: **checkout.session.completed**
5. After creating, copy the **Signing secret** (wh_...) and set as `STRIPE_WEBHOOK_SECRET`

## API Gateway: Raw Body

**HTTP API (v2)** passes the request body as a raw string in `event.body` by default. It does not parse or modify the body, so Stripe signature verification works without extra configuration.

If you ever use **REST API (v1)** for the webhook:

1. Set **Request body passthrough** to "When no match" or use a mapping template
2. Do **not** enable automatic request/response validation that parses JSON
3. Ensure the integration passes `$input.body` unchanged to Lambda

The handler **must not** parse the body before calling `Stripe.webhooks.constructEvent()`.

## Troubleshooting: No Email or Google Sheet Update After Payment

If checkout completes but you don't receive the confirmation email or see the Google Sheet update, the webhook is likely failing. Check in this order:

### 1. Verify webhook in Stripe Dashboard

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Ensure you have an endpoint for `https://8xiczk0ua0.execute-api.us-east-1.amazonaws.com/default/webhook`
3. Ensure it listens for **checkout.session.completed**
4. Click the endpoint → **Recent events** — check if requests succeed (200) or fail (4xx/5xx)

### 2. Check Lambda is in Test Mode

The webhook receives events from Stripe **test mode** when you use test cards (e.g. 4242...). Ensure:
- Your Stripe Dashboard is toggled to **Test mode** (top-right)
- The webhook was created in Test mode
- `STRIPE_WEBHOOK_SECRET` in the Lambda matches the **Signing secret** shown for that webhook

### 3. Check CloudWatch Logs

1. AWS Console → Lambda → `stripe-webhook` → **Monitor** → **View CloudWatch logs**
2. Look for:
   - `Stripe key prefix: rk_test_` — confirms the key is loaded
   - `Registration completed after payment: <email>` — webhook succeeded
   - `Stripe signature verification failed` — webhook secret mismatch
   - `Missing STRIPE_WEBHOOK_SECRET` — env var not set

### 4. Re-create webhook secret if needed

If you changed keys or recreated the endpoint, update `STRIPE_WEBHOOK_SECRET` in the `stripe-webhook` Lambda to the new signing secret from the Stripe webhook.
