# Auto Capture Setup

Card purchases go to the Budget Bubby **Inbox**, where you sort them. Nothing counts as spend until you confirm it.

## 1. One-time server setup

1. Apply `supabase/migrations/20261107110000_capture_inbox.sql`. Until it is applied, the Inbox stays hidden and Settings › Auto Capture shows "Needs database update".
2. Deploy the functions with `npm run deploy:functions`. This deploys `send-reminders` and `capture-expense`, both with `--no-verify-jwt`. No new secrets are needed.
3. Smoke test with a token from step 2.1 below:

    ```sh
    curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/capture-expense" \
      -H "Authorization: Bearer bb_cap_…" \
      -H "Content-Type: application/json" \
      -d '{"amount":"S$1.00","merchant":"Test","source":"curl"}'
    ```

    Expect `201 {"status":"captured",…}`. Discard the test item in the Inbox.

## 2. iPhone (Apple Pay Wallet trigger)

Requirements:

- iOS 17 or later (that's when the **Transaction** automation trigger arrived).
- The card is in Apple Wallet, and recent taps show under the card in Wallet.
- Only Apple Pay taps fire the trigger. Physical card taps, typed card numbers and PayNow don't fire it.
- Variable names below are as shown on iOS 17/18. They can differ slightly between versions.

Steps:

1. In Budget Bubby, go to Settings › **Auto Capture** › `New Token`. Copy the **token** and the **endpoint** URL. The token is shown only once.
2. Open the **Shortcuts** app › **Automation** › **+**.
3. Choose **Transaction**:
    - **Card:** every Apple Pay card you use. **Category / Merchant:** Any.
    - **Run Immediately**, and turn **off** "Notify When Run".
    - **Next** › **New Blank Automation**.
4. Add **Format Date**: Date = **Current Date**, Format = **ISO 8601**, with "Include ISO 8601 Time" on.
5. Add **Get Contents of URL**:
    - URL: the endpoint from step 1.
    - **Method:** `POST`.
    - **Headers:** `Authorization` = `Bearer ` + your token (one space after "Bearer").
    - **Request Body:** `JSON` with these fields:
        - `amount` (Text) → Shortcut Input › **Amount**
        - `merchant` (Text) → Shortcut Input › **Merchant**
        - `card` (Text) → Shortcut Input › **Card or Pass**
        - `occurred_at` (Text) → **Formatted Date**
        - `source` (Text) → `wallet`
6. Fallback, so a failed capture still gets logged:
    1. **Get Dictionary Value**: key `status` from **Contents of URL**.
    2. **If** Dictionary Value **does not have any value**:
        - **URL**: `https://<app-host>/expenses?action=new&amount=` Amount `&merchant=` Merchant. Run **URL Encode** on Merchant first if it can contain `&`.
        - **Open URLs**.
    3. **End If**.
7. Tap **Done**. Test with a small Apple Pay purchase. It should show up in the Inbox within a few seconds.

**Do not share this Shortcut**, because it contains your token. If you shared it by accident, revoke the token in Settings.

The fallback opens **Safari**, not the Home Screen app, because iOS keeps their storage separate. Sign in once in Safari so the fallback page is already logged in. If the phone is offline when you pay, neither path works, so log that purchase by hand.

Optional manual **Log Spend** Shortcut (for physical card or cash): **Ask for Input** (Number, "Amount"), **Ask for Input** (Text, "Where?"), then the same **Get Contents of URL** using those two inputs.

## 3. Other phones (Android etc.)

The endpoint isn't tied to any platform. Any app that can send an HTTP POST with JSON can use a token, for example MacroDroid or Tasker reacting to a Google Wallet or bank-app notification.

```
POST <endpoint>
Authorization: Bearer bb_cap_…
Content-Type: application/json

{
  "amount": "S$12.50",              // string or number; symbols like US$, ¥, RM are understood
  "currency": "SGD",                // optional ISO code, overrides the symbol
  "merchant": "GRAB*FOOD",          // required
  "card": "DBS Altitude",           // optional
  "occurred_at": "2026-11-05T12:34:56+08:00",  // optional ISO-8601 ("timestamp" also accepted)
  "source": "android"               // optional label, a-z 0-9 _ -
}
```

| Response | Meaning |
|---|---|
| `201 {"status":"captured"}` | Added to the Inbox |
| `200 {"status":"duplicate"}` / `{"status":"ignored"}` | Retry of the same purchase, a refund, or an ignored merchant |
| `400` / `401` / `413` / `429` / `503` | Invalid body, bad or revoked token, body over 4 KB, rate limited (more than 10 a minute or 150 a day), database not ready |

Parsing notification text into these fields is up to the automation app. Budget Bubby doesn't parse notifications yet.
