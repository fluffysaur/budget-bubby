# Initial Comments for Site

## Some components I feel unnecessary

1. SGD currency tag on app bar
2. The "Yi Jia's / Rachel's Personal Perspective (Individual Mode)" (or COMBINED) bar
3. "Live Supabase" should not need to be shown if live, just show if demo
4. The "Yi Jia" / "Rachel" / "Combined" chip beside headers

## Some issues discovered

1. Styling across pages are not consistent (e.g. numbers in Expenses and Budget do not match Accounts in thickness)
2. Components can be more defined to be easier to look at (e.g. cards currently dont quite pop enough, some text dont have enough contrast and not v accessible to read)
3. When trying to add expense, it says "Cannot coerce the result to a single JSON object"

## Some suggestions

1. Allow pin 000000 to go to demo
2. When clicking / tapping log out, should have confirmation modal
3. Modals / drawers should have animations (e.g. adding expense, drawer should have slide up/slide down animation + if web, it should have some entry/exit animation)
4. Wording should be kept simple here and there to improve readability and user experience
5. Quite a few stuff are redundant (e.g. the user "Yi Jia" appears beside the header, at the bototm left, on top...) not sure how the bottom left "Yi Jia's View" is necessary. Go thorugh and ensure pages dont have redundant elements and text that add unnecessary clutter.
6. For the update balances, can we have a search button as well to find accounts? Also, no need to "select" accounts to edit... if value is updated, then it is updated. If not updated, then no update. and i think the account cards can be smaller so more can fit verticlly on page.
7. After adding expense, have some fun pleasurable feedback (e.g. cha-ching with money or some animation)

## Additional Asks

1. I still feel like this tool is very complex. Any way we can simplify, while keeping useful and sufficiently detailed?
2. Keep minimal where possible. I think the quick add expense / update balances / add new account etc. are quite cluttered and have so much to look at
3. Wonder if the desktop view feels overwhelming because there are so many columns, and columns can stretch across whole screen on large screens. should we restrict width?
