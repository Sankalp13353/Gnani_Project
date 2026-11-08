# CallSaar – Architecture & Order Understanding Engine (Phase 3)

## System Overview

**CallSaar** is an AI-powered voice ordering and order management assistant tailored for Indian Kirana stores. It bridges natural spoken language (Hindi, English, Hinglish) with structured inventory and order fulfillment.

### High-Level Roadmap
- **Phase 1 (Complete)**: Foundation – Full-stack monorepo, Express backend, React + Vite frontend, health check, baseline styling & environment management.
- **Phase 2 (Complete)**: Data Layer – PostgreSQL database schema, Prisma ORM, migrations, and model seeds.
- **Phase 3 (Complete)**: Order Understanding Engine – Text preprocessing, entity extraction, dynamic catalogue matching, ambiguity resolution, and draft order generation.
- **Phase 4 (Upcoming)**: Speech-to-Text – Gnani AI Prisma integration for voice audio streaming and multilingual transcription.
- **Phase 5 (Upcoming)**: Text-to-Speech & Confirmation – Gnani AI Timbre integration for voice playback and confirmation.
- **Phase 6 (Upcoming)**: Dashboard & Packing Slips – Shopkeeper interface with order processing and printable receipt slips.

---

## Order Understanding Architecture

```
                                Customer Voice Transcript
                                            │
                                            ▼
                           ┌────────────────────────────────┐
                           │   Text Normalization Layer     │
                           │   - Hindi/English Number Words │
                           │   - Conversational Fillers     │
                           │   - Unit Standardizer          │
                           └────────────────┬───────────────┘
                                            │
                                            ▼
                           ┌────────────────────────────────┐
                           │     Segmentation & Parsing     │
                           │   - Multi-item Delimiters      │
                           │   - Quantity & Unit Extraction │
                           │   - Product Phrase Isolator    │
                           └────────────────┬───────────────┘
                                            │
                                            ▼
      ┌──────────────────┐ ┌────────────────────────────────┐
      │  Prisma / PG DB  │ │   Product Matching Engine      │
      │  Product Catalog ├─┤   - Exact Match                │
      └──────────────────┘ │   - Alias Resolution           │
                           │   - Token Overlap              │
                           │   - Levenshtein Typos          │
                           └────────────────┬───────────────┘
                                            │
                                            ▼
                           ┌────────────────────────────────┐
                           │  Ambiguity & Validation Layer  │
                           │   - Ambiguous Product Check    │
                           │   - Missing Quantity / Product │
                           │   - Clarification Questions    │
                           └────────────────┬───────────────┘
                                            │
                                            ▼
                           ┌────────────────────────────────┐
                           │   Draft Order Generator        │
                           │   - Decimal-Safe Monetary Math │
                           │   - Line Totals & Subtotal     │
                           │   - Non-persistent Draft State │
                           └────────────────────────────────┘
```

---

## Directory Architecture

```
CallSaar/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── config/
│   │   │   ├── aliases.js             # Kirana product vocabulary & colloquial term mappings
│   │   │   ├── env.js
│   │   │   └── prisma.js
│   │   ├── controllers/
│   │   │   ├── health.controller.js
│   │   │   ├── order.controller.js     # POST /api/orders/parse controller
│   │   │   └── product.controller.js
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   ├── order.routes.js         # Order routes
│   │   │   ├── product.routes.js
│   │   │   └── index.js
│   │   ├── services/
│   │   │   ├── customer.service.js
│   │   │   ├── health.service.js
│   │   │   ├── order.service.js
│   │   │   ├── orderUnderstanding.service.js # Order understanding engine
│   │   │   └── product.service.js
│   │   ├── middleware/
│   │   ├── utils/
│   │   │   ├── decimal.js             # Scale-safe decimal arithmetic (BigInt)
│   │   │   ├── logger.js
│   │   │   ├── productMatcher.js      # Catalogue similarity, token overlap & Levenshtein
│   │   │   ├── quantityExtractor.js   # Number & unit segment extractor
│   │   │   ├── textNormalizer.js      # Hindi/English number words & fillers
│   │   │   └── unitConverter.js       # Dimensional unit conversion & pricing audit
│   │   ├── app.js
│   │   └── server.js
│   ├── test/
│   │   └── orderUnderstanding.test.js # Test suite covering all 12 scenarios
│   ├── .env.example
│   └── package.json
├── docs/
│   └── architecture.md
├── .gitignore
├── eslint.config.js
├── package-lock.json
├── package.json
└── README.md
```
