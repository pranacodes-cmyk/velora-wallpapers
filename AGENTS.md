# Project Architecture
- Read `architecture-rules.md` for existing app architecture rules before changing any related feature.
- RevenueCat native Meta integration exclusively owns subscription conversions; disable SDK automatic revenue logging, explicitly activate native install/open, and separate checkout access from verified revenue to prevent duplicate or false payment counts.
- Declare the Meta core SDK directly in the Flutter Android host when MainActivity calls activation APIs; the plugin's internal dependency does not expose those classes to host compilation.
