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

## 3. Android (MacroDroid + Google Wallet)

> **Status:** written from the app's behaviour and public docs. Not yet tested on a real phone. Screen names in MacroDroid vary a little by version. Check the notification wording in step 1 before you trust the rest.

Requirements:

- The card is in Google Wallet and tap-to-pay purchase notifications are on (Wallet › Settings › Notifications).
- [MacroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid) is installed and has **Notification access** (it asks on first use).
- Turn off battery optimisation for MacroDroid, or Android may stop it in the background.
- Only Google Wallet taps notify. For physical card taps, PayNow and FAST, add the bank alert macro in section 3b.

Steps:

1. Make one small tap payment and read the Wallet notification. You expect the **merchant** in the title and the **amount** in the text, like `S$4.50 with Visa •••• 1234`. If your wording differs, adjust steps 4 and 5 to match.
2. In Budget Bubby, go to Settings › **Auto Capture** › `New Token`. Copy the **token** and the **endpoint** URL. The token is shown only once.
3. In MacroDroid, tap **Add Macro**. Name it `Budget Bubby capture`.
4. **Trigger:** Device Events › **Notification Received**.
    - **Application:** Google Wallet. If nothing fires later, also select Google Play services (older Wallet versions sent alerts from there).
    - **Text content:** contains a digit (turn on regular expressions and use `\d`). This skips non-payment notifications.
5. **Action:** Connectivity › **HTTP Request**.
    - **URL:** the endpoint from step 2. **Method:** `POST`.
    - **Header:** `Authorization` = `Bearer ` + your token (one space after "Bearer").
    - **Content type / Data type:** `application/json`.
    - **Body:** paste this JSON (or insert `[notification]` and `[not_title]` via MacroDroid's magic text `{}` button):

        ```json
        {
            "amount": "[notification]",
            "merchant": "[not_title]",
            "card": "Google Wallet",
            "source": "android"
        }
        ```
6. **Constraint (optional):** add a Wi-Fi or "Connected to internet" constraint so a failed send isn't silent. Without a connection the purchase isn't captured, so log it by hand.
7. Save, then pay for something small. It should show up in the Inbox within a few seconds. Discard the test item.

Parsing is handled by the server, so you need no regex on the phone:

- `amount`: the server takes the **first number** in the text and reads the currency from a symbol or ISO code next to it (`S$`, `US$`, `€`, `USD`). A bare `$` is SGD. The `with Visa •••• 1234` tail is ignored.
- The raw amount text must be **40 characters or fewer**. If a long card name pushes it over, the capture fails with `400`. Fix it by setting a MacroDroid variable from the text with a regex and sending that instead.
- `merchant` is cleaned by the server: all-caps names are title-cased and `SQ *` style prefixes are dropped in matching.
- A notification that fires twice for one purchase is safe. The second one comes back as `duplicate`.

If nothing arrives, check in this order: MacroDroid has Notification access, the Application list includes the app that actually posts the alert, the token isn't revoked, and the phone was online.

**Do not share this macro**, because it contains your token. If you shared it by accident, revoke the token in Settings.

## 3b. Android (MacroDroid + bank SMS or app alerts)

> **Status:** the server reads the usual alert wording of DBS/POSB (`digibank`, `PayLah!`), OCBC, UOB, Standard Chartered, Citibank, HSBC, Trust, GXS, MariBank, YouTrip, Revolut and Wise, plus generic card SMS. The patterns were written from typical wording, not checked against every bank's live messages. Test with a small payment and check the Inbox item before relying on it.

This catches what Google Wallet misses: physical card taps, online card payments, and PayNow or FAST transfers you send. Turn on transaction alerts in your bank app first (SMS, push, or both).

`SMS Received` and `Notification Received` use different MacroDroid magic text tags and `source` values, so create **two macros** (or branch with an `If` on trigger fired) using the same endpoint URL, `Authorization` header, and Data Type `application/json`:

### Macro A: Bank SMS

1. Make a small payment and read the SMS. It should name an amount with a currency (`SGD 4.50`, `S$4.50`) and usually a merchant or payee after "at" or "to".
2. In MacroDroid, tap **Add Macro**. Name it `Budget Bubby bank SMS`. Use the same token as your Wallet macro so duplicates are matched.
3. **Trigger:** Phone/SMS › **SMS Received** — from **Any contact**, content **Any** (or narrow it down to sender names like `DBS`, `OCBC`).
4. **Action:** Connectivity › **HTTP Request**, set up like section 3 (URL, `POST`, `Authorization` header, Data Type `application/json`), with this body:

    ```json
    {
        "raw_text": "[sms_message]",
        "sender": "[sms_number]",
        "source": "sms"
    }
    ```

5. Save, then pay for something small. It should show up in the Inbox with the bank name as the card. Discard the test item.

### Macro B: Bank app notifications

1. In MacroDroid, tap **Add Macro**. Name it `Budget Bubby bank alerts`. Use the same token as your Wallet macro.
2. **Trigger:** Device Events › **Notification Received** — select your bank apps (for example `digibank`, `OCBC`, `UOB TMRW`, `Trust`, `GXS`, `MariBank`).
3. **Action:** Connectivity › **HTTP Request**, set up like section 3 (URL, `POST`, `Authorization` header, Data Type `application/json`), with this body:

    ```json
    {
        "raw_text": "[notification]",
        "title": "[not_title]",
        "app": "[not_app_name]",
        "source": "bank"
    }
    ```

4. Save and test with a small payment. Discard the test item.

What the server does with `raw_text`:

- **Ignored** (`200 {"status":"ignored"}`, nothing added): OTPs and verification codes, declined or unsuccessful charges, and incoming money (received, credited, refunds, salary).
- **Captured:** the first amount with a currency, the merchant or payee after "at"/"to", and the date and time in the message, read as Singapore time. If no merchant is named, the item is called `<Bank> alert` so you can rename it in the Inbox.
- **Title, sender, and app fallback:** `title` is also checked for OTP/declined/incoming keywords, amount, and merchant; `title`, `app`, and `sender` are used as fallbacks to identify the bank when `raw_text` doesn't name it (numeric phone senders are ignored). Multi-line SMS/notifications injected into JSON are handled automatically.
- **Wallet + SMS for one purchase:** if another source (such as your Wallet macro) already sent the same amount and currency within 2 minutes, the second one comes back as `duplicate`. Wallet and bank alerts often give different merchant names, so this check uses only the amount, currency and time.
- `amount`, `merchant`, `card` and `occurred_at` sent next to `raw_text` win over what's parsed from it.

## 4. Other apps (Tasker, bank apps, etc.)

The endpoint isn't tied to any platform. Any app that can send an HTTP POST with JSON can use a token, for example Tasker or a bank-app notification.

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
  "source": "android",              // optional label, a-z 0-9 _ -
  "raw_text": "Your DBS card ending 1234 was used for SGD12.50 …", // optional, up to 1000 chars; see 3b
  "title": "DBS digibank",          // optional notification title used with raw_text
  "sender": "DBS",                  // optional SMS sender used for bank fallback
  "app": "digibank"                 // optional notification app name used for bank fallback
}
```

| Response                                              | Meaning                                                                                                                                                                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `201 {"status":"captured"}`                           | Added to the Inbox                                                                                                                                                                                    |
| `200 {"status":"duplicate"}` / `{"status":"ignored"}` | Retry of the same purchase, the same purchase from another source, a refund, an ignored merchant, or a `raw_text` alert that isn't a charge (`reason`: `otp`, `declined`, `incoming`, `not_a_charge`) |
| `400` / `401` / `413` / `429` / `503`                 | Invalid body, bad or revoked token, body over 4 KB, rate limited (more than 10 a minute or 150 a day), database not ready                                                                             |

With `amount`, the server reads the first number and its currency, as described in section 3. To send a whole notification or SMS instead, use `raw_text` as described in section 3b. If neither `amount` nor `raw_text` gives an amount, the capture fails with `400`.
