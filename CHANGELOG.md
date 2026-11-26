# Changelog

## [0.7.0](https://github.com/fluffysaur/budget-bubby/compare/v0.6.0...v0.7.0) (2026-11-26)


### Features

* **accounts:** declutter Add Account, Update Balances and card modals ([#289](https://github.com/fluffysaur/budget-bubby/issues/289)) ([474e34f](https://github.com/fluffysaur/budget-bubby/commit/474e34f826ec9c5026d6c5e40baecbe0c496be01))
* **expenses:** multi-select category filter ([#292](https://github.com/fluffysaur/budget-bubby/issues/292)) ([691276b](https://github.com/fluffysaur/budget-bubby/commit/691276bf1d74f9edb254605152d5d39ea0f9f3d5))
* **settings:** routed settings page with grouped sub-pages ([#286](https://github.com/fluffysaur/budget-bubby/issues/286)) ([c0db8a4](https://github.com/fluffysaur/budget-bubby/commit/c0db8a4d3c5a3eefebbeac9d449be53cdf7f98bb))
* **ui:** add custom Select with popover and mobile sheet ([#288](https://github.com/fluffysaur/budget-bubby/issues/288)) ([04987bd](https://github.com/fluffysaur/budget-bubby/commit/04987bdfd1c4028e47221b6f3364e341835ff38c))


### Bug Fixes

* **dashboard:** match Home category cards to Budget buffer coverage ([#285](https://github.com/fluffysaur/budget-bubby/issues/285)) ([02edc87](https://github.com/fluffysaur/budget-bubby/commit/02edc8734ba4e6abc9efbe1c355dfed96d660e0a))
* **settings:** stack push notification row on mobile ([#284](https://github.com/fluffysaur/budget-bubby/issues/284)) ([3f4fa6f](https://github.com/fluffysaur/budget-bubby/commit/3f4fa6fc19d52989545cb60004481d225d73c236))

## [0.6.0](https://github.com/fluffysaur/budget-bubby/compare/v0.5.1...v0.6.0) (2026-11-25)


### Features

* **accounts:** add balance sparklines and standardise balance updates ([#280](https://github.com/fluffysaur/budget-bubby/issues/280)) ([19fa5ce](https://github.com/fluffysaur/budget-bubby/commit/19fa5ce183b0bf6c465b793b94860358780087c4)), closes [#279](https://github.com/fluffysaur/budget-bubby/issues/279)
* **ai:** add OpenRouter OAuth PKCE and live free models ([#248](https://github.com/fluffysaur/budget-bubby/issues/248)) ([539fb05](https://github.com/fluffysaur/budget-bubby/commit/539fb0512fb983de4abd15234869e703565ddba2))
* **auth:** verify member linking server-side and split household_members RLS ([#262](https://github.com/fluffysaur/budget-bubby/issues/262)) ([a3a6bf9](https://github.com/fluffysaur/budget-bubby/commit/a3a6bf9a17ad63e1a582e0653e79683d3fa777fc))
* **budget:** add honest-log celebration and calm overage framing ([#277](https://github.com/fluffysaur/budget-bubby/issues/277)) ([3230990](https://github.com/fluffysaur/budget-bubby/commit/3230990f2b6e249d0a1ab428ca4a52e424700e47))
* **legal:** add privacy policy and terms pages ([#268](https://github.com/fluffysaur/budget-bubby/issues/268)) ([3ab71ba](https://github.com/fluffysaur/budget-bubby/commit/3ab71ba199ff06974faa15a802f699ec5748a0ce))
* **whats-new:** show friendly release notes after updates and in Settings ([#283](https://github.com/fluffysaur/budget-bubby/issues/283)) ([7801f8f](https://github.com/fluffysaur/budget-bubby/commit/7801f8f4745bae68a64e7ebc2432a285b31eb8b9))


### Bug Fixes

* **a11y:** trap and restore focus in modals and drawers ([#261](https://github.com/fluffysaur/budget-bubby/issues/261)) ([8dd0756](https://github.com/fluffysaur/budget-bubby/commit/8dd075683b6627b13e8ceb155162a8e5ce19b3ae))
* **budget:** refine category cards, header, and currency auto-shrink ([#278](https://github.com/fluffysaur/budget-bubby/issues/278)) ([58dd0e7](https://github.com/fluffysaur/budget-bubby/commit/58dd0e79b2d790809126077656f384266ebb442c))
* **errors:** surface failed saves and silent load failures ([#257](https://github.com/fluffysaur/budget-bubby/issues/257)) ([100d5b4](https://github.com/fluffysaur/budget-bubby/commit/100d5b4b23dacc6ca3a81b918e5ef7d00b21bb53))
* **expenses:** normalize expense tags to prevent double ## ([#275](https://github.com/fluffysaur/budget-bubby/issues/275)) ([2204b3f](https://github.com/fluffysaur/budget-bubby/commit/2204b3f5efd999ea6bed02e60c614fe8aa033d73))
* **notifications:** handle stalled PWA permission requests and expose mobile controls ([#281](https://github.com/fluffysaur/budget-bubby/issues/281)) ([1e5a55a](https://github.com/fluffysaur/budget-bubby/commit/1e5a55aee88c539dfab379de632d5cddec98bde5))
* **reminders:** send reminders for every household ([#266](https://github.com/fluffysaur/budget-bubby/issues/266)) ([0a24490](https://github.com/fluffysaur/budget-bubby/commit/0a24490cf8e6451d5e637824fbb7ee6b7b258d59))
* **rls:** close anonymous access on cards, statements, check-ins and prefs ([#271](https://github.com/fluffysaur/budget-bubby/issues/271)) ([f36de07](https://github.com/fluffysaur/budget-bubby/commit/f36de0745b64fe28b219056310e0551442b964b8))
* **ui:** error state with retry on Home and Budget ([#258](https://github.com/fluffysaur/budget-bubby/issues/258)) ([1c61749](https://github.com/fluffysaur/budget-bubby/commit/1c6174986dfda042be83e812ba193214eaf321a8))
* **ui:** set 11px text floor and 44px touch targets ([#260](https://github.com/fluffysaur/budget-bubby/issues/260)) ([4f81e6c](https://github.com/fluffysaur/budget-bubby/commit/4f81e6c93eeb0de435be502759c5a9dd2e42b9ed))


### Performance

* **bundle:** load demo mode and seed data on demand ([#259](https://github.com/fluffysaur/budget-bubby/issues/259)) ([ea312ba](https://github.com/fluffysaur/budget-bubby/commit/ea312baf085cd8392224d3fc12f94cedf95c3f06))

## [0.5.1](https://github.com/fluffysaur/budget-bubby/compare/v0.5.0...v0.5.1) (2026-11-23)


### Bug Fixes

* **ai:** label goal-funded expenses by goal in Bubby AI ([#243](https://github.com/fluffysaur/budget-bubby/issues/243)) ([f043246](https://github.com/fluffysaur/budget-bubby/commit/f043246bf1d0ae2419dd020fb0bcaf2c383dcc23))
* **roadmap:** keep the reality check counting when accounts are added ([#245](https://github.com/fluffysaur/budget-bubby/issues/245)) ([df658ec](https://github.com/fluffysaur/budget-bubby/commit/df658ecc262fbb70cde681e303e7c4512a90bd04))
* **ui:** stop segmented tabs scrolling vertically ([#244](https://github.com/fluffysaur/budget-bubby/issues/244)) ([630f399](https://github.com/fluffysaur/budget-bubby/commit/630f3992720ac2c450f44be19a652c54c5091c0f))

## [0.5.0](https://github.com/fluffysaur/budget-bubby/compare/v0.4.1...v0.5.0) (2026-11-23)


### Features

* **ai:** render markdown in Bubby AI chat replies ([#239](https://github.com/fluffysaur/budget-bubby/issues/239)) ([d4f6e40](https://github.com/fluffysaur/budget-bubby/commit/d4f6e4028b0bd2b2d1de6b62cc6174efd9a73916))


### Bug Fixes

* **roadmap:** measure reality check between real balance updates ([#242](https://github.com/fluffysaur/budget-bubby/issues/242)) ([5c331d1](https://github.com/fluffysaur/budget-bubby/commit/5c331d1ea9c874aabb8c61f740a15ff6b340077c)), closes [#241](https://github.com/fluffysaur/budget-bubby/issues/241)

## [0.4.1](https://github.com/fluffysaur/budget-bubby/compare/v0.4.0...v0.4.1) (2026-11-23)


### Bug Fixes

* **ai:** handle empty responses, SSE errors, and configurable reasoning effort ([#237](https://github.com/fluffysaur/budget-bubby/issues/237)) ([4a1b8dc](https://github.com/fluffysaur/budget-bubby/commit/4a1b8dc0ca2c61d269230c4bb9119fd8ac869ee1))

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
