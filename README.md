# OrderSaathi

> **A voice-first ordering platform that connects customers with local retail stores, allowing customers to discover products and place orders naturally using their voice in their preferred language.**

OrderSaathi is designed to enable local retail businesses to accept, transcribe, and manage customer orders placed naturally in Hindi, English, and Hinglish.

---

## Phases Overview

- **Phase 1 (Complete)**: Foundational full-stack workspace, Express backend, React + Vite frontend, health check validation.
- **Phase 2 (Complete)**: PostgreSQL database schema, Prisma ORM, migrations, product catalogue seeds, and database health checking.
- **Phase 3 (Complete)**: Order Understanding Engine – text preprocessing, entity & quantity extraction, catalogue matching, clarification handling, and draft order generation.
- **Phase 3.1 (Complete)**: Unit Conversion & Pricing Audit – dimensional unit compatibility, sealed pack count calculation, and safe price conversions.
- **Phase 4 (Complete)**: Gnani Prisma Speech-to-Text Integration – browser microphone intake, multer streaming, Gnani Prisma v3 REST ASR API integration, error mapping, and end-to-end voice-to-draft order pipeline.
- **Phases 5–6 (Upcoming)**: Gnani AI Timbre (TTS) order confirmation and store owner dashboard with packing slips.

---

## Project Structure

```
OrderSaathi/
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
│   │   │   ├── aliases.js             # Retail product vocabulary & colloquial term mappings
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

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v26.x supported)
- **npm**: v9.0.0 or higher (v11.x supported)
- **PostgreSQL**: v14.0 or higher running locally or remotely

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` files from their respective templates:

**Backend (`server/.env`):**
```bash
cp server/.env.example server/.env
```

Configure `server/.env`:
```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/callsaar_db?schema=public"
```

**Frontend (`client/.env`):**
```bash
cp client/.env.example client/.env
```

Configure `client/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

### 3. Database Migration & Seeding

```bash
# Run migration
cd server && npx prisma migrate dev

# Seed catalogue items
npm run prisma:seed
```

---

## Available Commands

From the project root:

| Command | Description |
|---|---|
| `npm run dev` | Start both backend and frontend concurrently |
| `npm run dev:client` | Start only the React frontend on `http://localhost:5173` |
| `npm run dev:server` | Start only the Express backend on `http://localhost:5001` |
| `npm test` | Run the Order Understanding test suite |
| `npm run build:client` | Build the React frontend for production |
| `npm run lint` | Run ESLint checks across client and server |

From the `server` directory:

| Command | Description |
|---|---|
| `npm test` | Run `node --test test/orderUnderstanding.test.js` |
| `npm run prisma:generate` | Generate Prisma client bindings |
| `npm run prisma:migrate` | Run Prisma schema migrations |
| `npm run prisma:seed` | Run idempotent catalogue seeder (`prisma/seed.js`) |

---

## Order Understanding Engine (Phase 3)

### How It Works

1. **Text Preprocessing & Normalization**:
   - Converts colloquial Hindi number words (`ek`, `do`, `teen`, `chaar`, `paanch`, `aadha`, `dedh`, `dhaai`) and English number words into digits.
   - Cleans conversational honorifics and conversational fillers (`bhaiya`, `ji`, `de dena`, `chahiye`, `pack kar do`, `give me`).
   - Normalizes unit variations (`kilo`, `kg`, `litre`, `ltr`, `packet`, `gm`, `g`).
2. **Entity & Quantity Extraction**:
   - Segments multi-item transcripts separated by commas, conjunctions (`aur`, `and`, `saath mein`), or quantity boundaries.
   - Handles multiple word orders: `<qty> <unit> <product>`, `<qty> <product> <unit>`, `<qty> <product>`, and `<product> <qty> <unit>`.
3. **Dynamic Catalogue Matching**:
   - Queries active PostgreSQL products via Prisma.
   - Applies exact matching, token overlap scoring, alias resolution (`server/src/config/aliases.js`), and Levenshtein edit distance for spelling mistakes (e.g. `magi` → `Maggi Noodles`).
   - Classifies matches into:
     - `MATCHED`: High confidence single match.
     - `AMBIGUOUS`: Multiple close catalogue matches (e.g. "amul").
     - `UNMATCHED`: Product not found in store catalogue.
     - `MISSING_QUANTITY`: Product mentioned without amount (e.g. "Give me some milk").
     - `MISSING_PRODUCT`: Quantity provided without item (e.g. "Give me two packets").
4. **Unit Conversion & Pricing Audit (Phase 3.1)**:
   - Evaluates dimensional compatibility between customer requested unit and catalogue selling unit (Weight, Volume, Count).
   - Automatically handles fractional loose commodities (e.g. 500g sugar priced at ₹45/kg → 0.5 kg → ₹22.50; 500ml oil priced at ₹150/litre → 0.5 litre → ₹75.00).
   - Computes integer pouch/pack counts for sealed pre-packaged goods (e.g. 1 litre milk when sold in 500ml pouches → 2 pouches → ₹56.00).
   - Rejects incompatible conversions (e.g. 1 kg Maggi, 1 litre Sugar, 1 kg Oil, 750ml Milk) and prompts with natural clarifying questions.
5. **Clarification Handling**:
   - Automatically flags `needsClarification = true` if any item is incomplete or ambiguous.
   - Generates natural clarifying questions for the voice assistant.
5. **Decimal-Safe Financial Arithmetic**:
   - Calculates line totals and subtotal using scale-safe BigInt representation (avoiding floating point errors like `0.1 + 0.2 = 0.30000000000000004`).
6. **Pure Draft Generation**:
   - Generates a draft order response without saving to the database before customer confirmation.

---

## API Endpoints

### 1. Order Understanding (`POST /api/orders/parse`)

Converts customer text transcripts into structured draft orders.

#### Request Example

```http
POST /api/orders/parse
Content-Type: application/json

{
  "transcript": "Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena."
}
```

#### Response Example (`200 OK`)

```json
{
  "success": true,
  "data": {
    "transcript": "Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena.",
    "items": [
      {
        "originalText": "2 kilo atta",
        "productId": "9cc39627-54af-43f7-9735-a7d31c9ebcce",
        "productName": "Aashirvaad Atta",
        "matchedCatalogName": "Aashirvaad Atta",
        "quantity": "2",
        "unit": "kg",
        "unitPrice": "55.00",
        "lineTotal": "110.00",
        "status": "MATCHED",
        "confidence": 0.92
      },
      {
        "originalText": "ek litre sunflower oil",
        "productId": "b7390887-cddf-49d3-8dc5-02d542dcce50",
        "productName": "Fortune Sunflower Oil",
        "matchedCatalogName": "Fortune Sunflower Oil",
        "quantity": "1",
        "unit": "litre",
        "unitPrice": "150.00",
        "lineTotal": "150.00",
        "status": "MATCHED",
        "confidence": 0.92
      },
      {
        "originalText": "3 Maggi de dena.",
        "productId": "0a79dcb2-2f8d-48c3-80c1-b73d6c1d43ed",
        "productName": "Maggi Noodles",
        "matchedCatalogName": "Maggi Noodles",
        "quantity": "3",
        "unit": "packet",
        "unitPrice": "15.00",
        "lineTotal": "45.00",
        "status": "MATCHED",
        "confidence": 0.92
      }
    ],
    "subtotal": "305.00",
    "needsClarification": false,
    "clarificationQuestions": []
  }
}
```

#### Ambiguous or Incomplete Request Example

```http
POST /api/orders/parse
Content-Type: application/json

{
  "transcript": "2 packet amul aur thoda doodh de do"
}
```

#### Response Example (`200 OK`)

```json
{
  "success": true,
  "data": {
    "transcript": "2 packet amul aur thoda doodh de do",
    "items": [
      {
        "originalText": "2 packet amul",
        "productId": null,
        "productName": "amul",
        "quantity": "2",
        "unit": "packet",
        "unitPrice": null,
        "lineTotal": null,
        "status": "AMBIGUOUS",
        "confidence": 0.92,
        "candidates": [
          { "id": "be450aef-...", "name": "Amul Taaza Milk", "unit": "500ml", "price": "28.00" },
          { "id": "54c0d973-...", "name": "Amul Butter", "unit": "100g", "price": "60.00" }
        ],
        "clarificationReason": "Multiple catalogue products match 'amul'."
      },
      {
        "originalText": "doodh",
        "productId": "be450aef-...",
        "productName": "Amul Taaza Milk",
        "quantity": null,
        "unit": "packet",
        "unitPrice": "28.00",
        "lineTotal": null,
        "status": "MISSING_QUANTITY",
        "confidence": 0.92,
        "clarificationReason": "Quantity for 'Amul Taaza Milk' was not specified."
      }
    ],
    "subtotal": "0.00",
    "needsClarification": true,
    "clarificationQuestions": [
      "Did you mean Amul Taaza Milk or Amul Butter?",
      "How much Amul Taaza Milk would you like? (e.g. 1 500ml)"
    ]
  }
}
```

### 2. Speech-to-Text & Voice Order Intake (`POST /api/speech/transcribe`)

Converts customer spoken audio into text via **Gnani Prisma v3 REST API** (`https://api.vachana.ai/stt/v3`) and automatically feeds the transcript into the Order Understanding Engine.

#### Request Format
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `audio_file` (or `audio`): Binary audio file (WebM, WAV, MP3, OGG, AAC, MP4, M4A, FLAC). Max size 10MB.
  - `language_code` *(optional)*: Language model code (default `indic-auto`, also supports `hi-IN`, `en-IN`).

#### Response Example (`200 OK`)

```json
{
  "success": true,
  "data": {
    "transcript": "500 gram sugar aur 1 litre sunflower oil",
    "audio": {
      "requestId": "req_67890_abc",
      "detectedLanguage": "indic-auto",
      "model": "prisma-v3.0",
      "processingTime": 0.42
    },
    "items": [
      {
        "originalText": "500 gram sugar",
        "productId": "7e3b97b1-...",
        "productName": "Sugar",
        "matchedCatalogName": "Sugar",
        "quantity": "500",
        "unit": "g",
        "catalogUnit": "kg",
        "unitPrice": "45.00",
        "lineTotal": "22.50",
        "status": "MATCHED",
        "confidence": 0.92
      },
      {
        "originalText": "1 litre sunflower oil",
        "productId": "b7390887-...",
        "productName": "Fortune Sunflower Oil",
        "matchedCatalogName": "Fortune Sunflower Oil",
        "quantity": "1",
        "unit": "litre",
        "catalogUnit": "litre",
        "unitPrice": "150.00",
        "lineTotal": "150.00",
        "status": "MATCHED",
        "confidence": 0.92
      }
    ],
    "subtotal": "172.50",
    "needsClarification": false,
    "clarificationQuestions": []
  }
}
```

*Note: Draft orders are returned in-memory and are NOT persisted to the PostgreSQL database.*

### 3. Application Health Check (`GET /api/health`)
- **Response** (`200 OK`): `{"success": true, "message": "OrderSaathi API is running"}`

### 4. Database Health Check (`GET /api/health/db`)
- **Response** (`200 OK`): `{"success": true, "database": "connected"}`

### 5. Products Catalogue (`GET /api/products`)
- **Response** (`200 OK`): Lists active catalogue products.
