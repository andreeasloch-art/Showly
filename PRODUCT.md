# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable as a PWA (home-screen icon, standalone display). Mobile web first.

## Users

- **Guests (customers):** private people and companies planning an event in Germany, Austria or Spain: kids' birthdays, weddings, company parties, galas, city festivals. All occasions carry equal weight; none is the default audience. They mostly use Showly on the phone, casually and on the side (evening on the sofa, in between), often spontaneously and one-handed. Job: find a fitting act or extra for a date, see the final price, book and pay safely.
- **Providers:** artists (clowns, magicians, DJs, face painters, walking acts, musicians …), event planners, costume/decor sellers, and cake/sweets makers. Providers may be businesses or private individuals. Job: get a public profile, receive bookings, get paid.
- **Admin:** the operator, moderating reports, providers, refunds and support.

## Product Purpose

One place to book everything for an event: entertainment, planning, costumes and decor, cakes and sweets. Success means a guest goes from "I have a date" to "booked and paid" on the phone without uncertainty about price, availability or trust.

## Positioning

- Fixed final prices: the guest always sees the end price; no service fee is added for guests. Providers pay a 20 % commission out of their price.
- Live availability calendar per provider.
- Payment runs through Showly (Stripe); providers are ID-checked (Stripe Identity).
- Artists, decor, costumes and cakes in one cart for one event.

## Operating Context

- Booking flow: browse or search (what, date, place) → profile → pick date/slot in calendar → optional extras → checkout (Stripe embedded) → confirmation; free cancellation up to 24 h.
- Cloud login via email/SMS code, Google, Apple, or email + password; local practice mode when no backend is configured.
- Languages: German (primary), English, Spanish.
- Legal surface is binding: Impressum, privacy, cookie consent with "Alle ablehnen" on the first level, AGB, withdrawal function, accessibility statement (BFSG).

## Capabilities and Constraints

- Stack: TanStack Start (React, file routes), Vite, TypeScript, Supabase via Lovable Cloud, Stripe, Resend.
- Fonts must be served locally (no Google Fonts requests).
- No pre-ticked paid extras (EU consumer law).
- Accessibility: WCAG 2.1 AA as the working bar (BFSG); keyboard operable, sufficient contrast, alt texts.
- Demo catalog: every listed provider is currently an example (`demo: true`), labeled "Beispiel", not bookable in cloud mode, no ratings.

## Brand Commitments

- Name and wordmark "Showly" (the colorful lettering in `public/logo-showly.png` / `@2x`) stay as they are.
- The site is built in the colors of the logo (pinned by the owner): blue-violet #4832FD, violet #6D3EEA, purple #8530D0, lilac #B8AEFC, magenta #ED31C5, pink #FC5691, coral #FF976A, mint #4AECB5, on white. Tokens in `src/showly/logo-farben.css`.
- Rejected by the owner: a flat poster-wall look (condensed wood type, ultramarine/orange/yellow inks, square cards). Do not propose it again.

## Evidence on Hand

- No real customers, reviews, ratings, press or booking numbers exist yet. Never invent reviews, ratings, "Testsieger"/"Nummer 1" claims, booking counts or testimonials.
- Category illustrations are self-generated (`public/acts`, `scripts/acts`), as are the stage image and grain texture (`scripts/brand`). Shop images in `public/shop`.

## Product Principles

1. The price you see is the price you pay, everywhere, consistently.
2. Trust is shown, not claimed: real mechanisms (calendar, ID check, payment, cancellation) over badges and superlatives.
3. Phone first, one hand, short sessions: the next step is always obvious and reachable.
4. Every occasion is first-class; no audience is the default.
5. Honest empty states: while the catalog is example data, say so plainly.

## Accessibility & Inclusion

BFSG applies; WCAG 2.1 AA contrast and keyboard operability; respect `prefers-reduced-motion`; three languages.
