# Changelog

## [0.4.0](https://github.com/fluffysaur/budget-bubby/compare/v0.3.0...v0.4.0) (2026-11-23)


### Features

* **accounts:** multi-select account type filter for net worth, chart and list ([#207](https://github.com/fluffysaur/budget-bubby/issues/207)) ([cd725e4](https://github.com/fluffysaur/budget-bubby/commit/cd725e4b1011ad769640cfc990aefaedabc26586)), closes [#203](https://github.com/fluffysaur/budget-bubby/issues/203)
* **ai:** sync BYOK Gemini key and model across devices ([#211](https://github.com/fluffysaur/budget-bubby/issues/211)) ([8337826](https://github.com/fluffysaur/budget-bubby/commit/8337826b56626ccb90454962cdd781b2065f9368)), closes [#185](https://github.com/fluffysaur/budget-bubby/issues/185)
* **cards:** log partial payments on credit card statements ([#212](https://github.com/fluffysaur/budget-bubby/issues/212)) ([a8d45fa](https://github.com/fluffysaur/budget-bubby/commit/a8d45fa85902215376f50f77552e28d0d36817fc)), closes [#84](https://github.com/fluffysaur/budget-bubby/issues/84)
* **categories:** support member-specific categories and per-member split overrides ([#198](https://github.com/fluffysaur/budget-bubby/issues/198)) ([f6b37f6](https://github.com/fluffysaur/budget-bubby/commit/f6b37f6844d878be6cb72a47ec5cc405e180eb9f))
* **goals:** default filter to Active and reorder tabs ([#199](https://github.com/fluffysaur/budget-bubby/issues/199)) ([6de1b99](https://github.com/fluffysaur/budget-bubby/commit/6de1b995483bab16f9465d1fd3c30835e084bbfb))
* **goals:** goal-linked costs and trim/lower trade-offs ([#197](https://github.com/fluffysaur/budget-bubby/issues/197)) ([f1ba764](https://github.com/fluffysaur/budget-bubby/commit/f1ba764afc2f8a4aec6dabf4633b30085b9c6634))
* **haptics:** tactile feedback on tab switches and save/delete actions ([#195](https://github.com/fluffysaur/budget-bubby/issues/195)) ([23d19f1](https://github.com/fluffysaur/budget-bubby/commit/23d19f11548a24381e83d42dbd2a879b02e2c7c2))
* **layout:** make desktop sidebar collapsible to an icon-only rail ([#210](https://github.com/fluffysaur/budget-bubby/issues/210)) ([427275b](https://github.com/fluffysaur/budget-bubby/commit/427275b4b36e0d7084ecdb2f7fea561261dbe8a5))
* **realtime:** live updates from partner for expenses and inbox items ([#196](https://github.com/fluffysaur/budget-bubby/issues/196)) ([5f6dddf](https://github.com/fluffysaur/budget-bubby/commit/5f6dddf7010bef4a8c00277a54a21261bdadd224))


### Bug Fixes

* **cache:** show cached Bubby and amounts on cold start instead of placeholder values ([1d7d873](https://github.com/fluffysaur/budget-bubby/commit/1d7d87398e602ec07afc5642fc4c930e73abade7))
* **cache:** show cached Bubby and amounts on cold start instead of placeholder values ([0e28503](https://github.com/fluffysaur/budget-bubby/commit/0e28503eedc290b70a83475e007fb21b2cdd1ce4))
* **inbox:** pin clock in InboxPage tests to avoid SGT midnight flake ([#218](https://github.com/fluffysaur/budget-bubby/issues/218)) ([9ca8f9b](https://github.com/fluffysaur/budget-bubby/commit/9ca8f9b9ff4b86a1399d85ba3887ee72b6e80e0d))
* **layout:** align header border and unify navbar icon button sizing ([#206](https://github.com/fluffysaur/budget-bubby/issues/206)) ([66a8828](https://github.com/fluffysaur/budget-bubby/commit/66a88288baca5e25019b4a0b194ea444e20c8073))
* **notifications:** read live permission and keep push subscription on stale "default" ([5ff0bb0](https://github.com/fluffysaur/budget-bubby/commit/5ff0bb08e408a81bdfa08688c1757fcffad6d70d))
* **notifications:** read live permission and keep push subscription on stale "default" ([51dc799](https://github.com/fluffysaur/budget-bubby/commit/51dc7992794bc62433df1627b1b0c94661ed0c43)), closes [#191](https://github.com/fluffysaur/budget-bubby/issues/191)
* **tests:** use timezone-independent header target in InboxPage swipe test ([#205](https://github.com/fluffysaur/budget-bubby/issues/205)) ([6747230](https://github.com/fluffysaur/budget-bubby/commit/6747230d162432aec2c83ac9ef104600af82b722))

## [0.3.0](https://github.com/fluffysaur/budget-bubby/compare/v0.2.0...v0.3.0) (2026-11-22)


### Features

* **ai:** integrate Gemini AI assistant drawer for budget queries and actions ([caa2123](https://github.com/fluffysaur/budget-bubby/commit/caa21238cdd4cdf014886db127f4e0db19c64398))
* **ai:** integrate Gemini AI assistant drawer for budget queries and actions ([292126d](https://github.com/fluffysaur/budget-bubby/commit/292126d2c9c5d371143e27ed13c5b0b9acca1290))
* **goals:** sort goals by target date (earliest first) ([#188](https://github.com/fluffysaur/budget-bubby/issues/188)) ([39ffcaa](https://github.com/fluffysaur/budget-bubby/commit/39ffcaac7e2f767ce69f0e6e803625bd7d2949e0))

## [0.2.0](https://github.com/fluffysaur/budget-bubby/compare/v0.1.0...v0.2.0) (2026-11-22)


### Features

* **onboarding:** add first-launch and on-demand guide with snack reward ([dda1116](https://github.com/fluffysaur/budget-bubby/commit/dda1116ffa93221d449896bf1e8eedd0986e7b65))
* **onboarding:** add first-launch and on-demand guide with snack reward ([0c43ae9](https://github.com/fluffysaur/budget-bubby/commit/0c43ae90e8e133656a1cd61ea97a8d215e21502e))
* **onboarding:** separate guide from starter quests and add Bubby egg hatching ([4af216b](https://github.com/fluffysaur/budget-bubby/commit/4af216b247936a51cb04b9feef02d6d95ba5cc00))


### Bug Fixes

* **budget:** unclip limit alert shadows and add session dismiss ([2a524b4](https://github.com/fluffysaur/budget-bubby/commit/2a524b48fce97eace096f1497d52908ab1adfe3a))
* **budget:** unclip limit alert shadows and add session dismiss ([3c4af6c](https://github.com/fluffysaur/budget-bubby/commit/3c4af6c45927c35701b40ff82c0597227f3f8fea))
* **e2e:** align perspective switcher tests with unified dropdown ([6c0645d](https://github.com/fluffysaur/budget-bubby/commit/6c0645d5305671b0fe4de5184eefd5649973aa73))
* **e2e:** align perspective switcher tests with unified dropdown ([7e08830](https://github.com/fluffysaur/budget-bubby/commit/7e08830dca756ec347ae694a6b5cc844b031413f))
* **inbox:** auto-expand non-spendable category chips and align 1-5 shortcuts ([4f5c8a5](https://github.com/fluffysaur/budget-bubby/commit/4f5c8a542c8a779a3a4a4fb2f67847c6a0a54897))
* **inbox:** auto-expand non-spendable category chips and align 1-5 shortcuts ([f4f31c5](https://github.com/fluffysaur/budget-bubby/commit/f4f31c5a8db055b0e739e751de5e339d54fc273b))
* **motion:** import Easing type from motion/react instead of transitive motion-utils ([d7b0f96](https://github.com/fluffysaur/budget-bubby/commit/d7b0f96cea6230e220150ca6fb3a0ffebf14b786))
