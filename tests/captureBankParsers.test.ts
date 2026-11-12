import { describe, it, expect } from "vitest";
import { parseBankAlert } from "../src/lib/capture/bankParsers";

// 2026-11-11 15:00 SGT. All sample alerts below are made up: fake merchants,
// fake payees and placeholder card digits.
const NOW = new Date("2026-11-11T07:00:00Z");

function charge(text: string) {
    const res = parseBankAlert(text, NOW);
    if (res.kind !== "charge") {
        throw new Error(`expected a charge, got ignore:${res.reason}`);
    }
    return res;
}

describe("parseBankAlert: outbound card charges", () => {
    it.each([
        {
            bank: "DBS",
            text: "Transaction Alert: Your DBS card ending 1234 was used for SGD12.50 on 11 Nov 14:32 at GRAB*FOOD. If unauthorised, call 1800 111 1111.",
            merchant: "GRAB*FOOD",
            amount: 12.5,
            at: "2026-11-11T06:32:00.000Z",
        },
        {
            bank: "POSB",
            text: "POSB: Your card ending 1234 was used for SGD 4.20 on 11 Nov 08:05 at TOAST CAFE SINGAPORE SG. Not you? Call 1800 111 1111.",
            merchant: "TOAST CAFE SINGAPORE SG",
            amount: 4.2,
            at: "2026-11-11T00:05:00.000Z",
        },
        {
            bank: "OCBC",
            text: "Your OCBC card ending 1234 was used for SGD32.00 at SAMPLE MART on 11/11/2026 13:15. If unauthorised, call 6363 3333.",
            merchant: "SAMPLE MART",
            amount: 32,
            at: "2026-11-11T05:15:00.000Z",
        },
        {
            bank: "UOB",
            text: "A transaction of SGD 58.90 was made with your UOB Card ending 1234 on 11/11/26 at DEMO BOOKS. If unauthorised, call 24/7 Fraud Hotline now",
            merchant: "DEMO BOOKS",
            amount: 58.9,
            at: null,
        },
        {
            bank: "Standard Chartered",
            text: "SCB: Transaction alert: SGD 7.80 was charged to your card ending 1234 at EXAMPLE NOODLES on 11 Nov 26 12:01.",
            merchant: "EXAMPLE NOODLES",
            amount: 7.8,
            at: "2026-11-11T04:01:00.000Z",
        },
        {
            bank: "Citibank",
            text: "Citi Alert: A SGD 120.00 transaction was made on your Citi card ending 1234 at FAKE ELECTRONICS on 11/11/26.",
            merchant: "FAKE ELECTRONICS",
            amount: 120,
            at: null,
        },
        {
            bank: "HSBC",
            text: "HSBC: Your card ending 1234 has been charged SGD 15.40 at PLACEHOLDER PIZZA on 11NOV26 at 2:10PM.",
            merchant: "PLACEHOLDER PIZZA",
            amount: 15.4,
            at: "2026-11-11T06:10:00.000Z",
        },
    ])("$bank", ({ bank, text, merchant, amount, at }) => {
        const res = charge(text);
        expect(res.bank).toBe(bank);
        expect(res.merchant).toBe(merchant);
        expect(res.amount).toBe(amount);
        expect(res.currency).toBe("SGD");
        expect(res.occurredAt?.toISOString() ?? null).toBe(at);
    });

    it("reads foreign currency charges", () => {
        const res = charge(
            "Your DBS card ending 1234 was used for USD9.99 on 10 Nov 23:40 at STREAMCO.COM.",
        );
        expect(res).toMatchObject({
            amount: 9.99,
            currency: "USD",
            merchant: "STREAMCO.COM",
            rawAmount: "USD9.99",
        });
        expect(res.occurredAt?.toISOString()).toBe("2026-11-10T15:40:00.000Z");
    });

    it("reads generic card SMS and symbol amounts", () => {
        const res = charge(
            "Card ending 1234: S$3.50 spent at KOPI CORNER on 11 Nov.",
        );
        expect(res).toMatchObject({
            bank: null,
            amount: 3.5,
            currency: "SGD",
            merchant: "KOPI CORNER",
        });
    });

    it("reads amounts with thousands separators", () => {
        expect(
            charge(
                "Your UOB Card ending 1234 was charged SGD 1,250.00 at SAMPLE TRAVEL.",
            ).amount,
        ).toBe(1250);
    });

    it("returns a null merchant when none is named", () => {
        const res = charge("DBS: SGD 6.00 was debited from your account.");
        expect(res.merchant).toBeNull();
        expect(res.amount).toBe(6);
    });
});

describe("parseBankAlert: outbound transfers", () => {
    it.each([
        {
            text: "DBS: You made a PayNow transfer of SGD 20.00 to ALEX DEMO on 11 Nov 14:00. If unauthorised, call 1800 111 1111.",
            payee: "ALEX DEMO",
            amount: 20,
            bank: "DBS",
        },
        {
            text: "OCBC: You have sent SGD 45.00 via PayNow to SAM SAMPLE on 11/11/2026 09:30.",
            payee: "SAM SAMPLE",
            amount: 45,
            bank: "OCBC",
        },
        {
            text: "UOB: FAST transfer of SGD 300.00 to Acc ending 5678 (JORDAN TEST) was successful.",
            payee: "JORDAN TEST",
            amount: 300,
            bank: "UOB",
        },
        {
            text: "Amount: SGD 18.00\nTo: CASEY PLACEHOLDER\nDate: 11 Nov 2026 10:12",
            payee: "CASEY PLACEHOLDER",
            amount: 18,
            bank: null,
        },
    ])("$text", ({ text, payee, amount, bank }) => {
        const res = charge(text);
        expect(res.merchant).toBe(payee);
        expect(res.amount).toBe(amount);
        expect(res.bank).toBe(bank);
    });
});

describe("parseBankAlert: ignored messages", () => {
    it.each([
        [
            "otp",
            "DBS: Your OTP for the transaction of SGD 12.50 at GRAB*FOOD is 123456. Do not share it with anyone.",
        ],
        [
            "otp",
            "123456 is your One-Time Password for OCBC card ending 1234. Never share this code.",
        ],
        [
            "otp",
            "UOB: Use verification code 654321 to approve SGD 50.00 at DEMO STORE.",
        ],
        [
            "declined",
            "Your DBS card ending 1234 transaction of SGD 80.00 at SAMPLE SHOP was declined.",
        ],
        [
            "declined",
            "Citi Alert: Transaction of SGD 9.00 at FAKE APP was unsuccessful.",
        ],
        [
            "incoming",
            "You have received SGD 25.00 from ALEX DEMO via PayNow on 11 Nov 12:00.",
        ],
        [
            "incoming",
            "OCBC: SGD 3,000.00 was credited to your account ending 1234 (SALARY).",
        ],
        [
            "incoming",
            "DBS: Incoming PayNow of SGD 10.00 from SAM SAMPLE to your account.",
        ],
        [
            "incoming",
            "Refund of SGD 12.00 from SAMPLE SHOP has been processed to your card ending 1234.",
        ],
        ["not_a_charge", "DBS: Your statement for Nov is ready to view."],
        ["not_a_charge", "Your card ending 1234 is now active."],
        ["not_a_charge", ""],
    ])("%s: %s", (reason, text) => {
        expect(parseBankAlert(text, NOW)).toEqual({ kind: "ignore", reason });
    });
});

describe("parseBankAlert: dates", () => {
    it("rolls a yearless date into last year when it would be in the future", () => {
        const jan = new Date("2027-01-01T01:00:00Z");
        const res = parseBankAlert(
            "Your DBS card ending 1234 was used for SGD5.00 on 31 Dec 23:50 at SAMPLE BAR.",
            jan,
        );
        expect(res.kind === "charge" && res.occurredAt?.toISOString()).toBe(
            "2026-12-31T15:50:00.000Z",
        );
    });

    it("ignores impossible dates", () => {
        const res = charge(
            "Your DBS card ending 1234 was used for SGD5.00 on 32 Foo 25:99 at SAMPLE BAR.",
        );
        expect(res.occurredAt).toBeNull();
    });
});

describe("parseBankAlert: digital banks and notification context", () => {
    it.each([
        {
            bank: "DBS",
            text: "digibank: You paid SGD 4.50 to KOPI CORNER.",
        },
        {
            bank: "Trust",
            text: "Trust Bank: You spent S$9.20 at SAMPLE GROCER.",
        },
        {
            bank: "GXS",
            text: "GXS: Payment of SGD 15.00 to DEMO SHOP was completed.",
        },
        {
            bank: "MariBank",
            text: "MariBank: You transferred SGD 20.00 to ALEX DEMO.",
        },
        {
            bank: "YouTrip",
            text: "YouTrip: You spent USD 14.99 at ONLINE STORE.",
        },
        {
            bank: "Revolut",
            text: "Revolut: Paid EUR 8.50 at BAKERY SAMPLE.",
        },
        {
            bank: "Wise",
            text: "Wise: You spent GBP 12.00 at LONDON CAFE.",
        },
    ])("detects $bank", ({ bank, text }) => {
        expect(charge(text).bank).toBe(bank);
    });

    it("uses title, app, and sender as context without trusting phone numbers", () => {
        const fromApp = parseBankAlert(
            "You spent S$6.80 at DEMO BAKERY.",
            NOW,
            { title: "Card Transaction", app: "digibank" },
        );
        expect(fromApp).toMatchObject({
            kind: "charge",
            bank: "DBS",
            amount: 6.8,
            merchant: "DEMO BAKERY",
        });

        const fromTitleSplit = parseBankAlert("at SAMPLE CAFE", NOW, {
            title: "Paid SGD 5.20",
            app: "Trust",
        });
        expect(fromTitleSplit).toMatchObject({
            kind: "charge",
            bank: "Trust",
            amount: 5.2,
            merchant: "SAMPLE CAFE",
        });

        const fromPhoneSender = parseBankAlert(
            "Card ending 1234: S$3.50 spent at KOPI CORNER.",
            NOW,
            { sender: "+6591234567" },
        );
        expect(fromPhoneSender).toMatchObject({
            kind: "charge",
            bank: null,
        });
    });

    it("checks ignore keywords in the notification title", () => {
        expect(
            parseBankAlert("123456 for SGD 12.50 at GRAB*FOOD.", NOW, {
                title: "One-Time Password",
                app: "digibank",
            }),
        ).toEqual({ kind: "ignore", reason: "otp" });
    });

    it("does not false-match Trust or Wise inside a sentence", () => {
        const res = charge(
            "Card ending 1234: SGD 10.00 spent at STREETWISE CAFE. Do not trust unsolicited calls.",
        );
        expect(res.bank).toBeNull();
    });
});
