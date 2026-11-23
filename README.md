<p align="center">
  <img src="public/images/sagana-logo.jpg" width="180" alt="SAGANA logo">
</p>

<h1 align="center">SAGANA</h1>

<p align="center"><i>Discover. Explore. Experience.</i></p>

<p align="center">
  A farm tourism platform that helps travelers discover local farms and request visits across the Philippines.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.4.6-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19.3.0-149eca?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/JavaScript-ES6+-f7df1e?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
</p>

---

## Overview

**SAGANA** is a web-based farm tourism platform that brings farm discovery and visit requests into one place. Visitors can explore farms, learn about seasonal produce and activities, preview destinations through photos and videos, find locations on a map, and submit a visit request. Farm owners can submit their farm details for review and listing.

SAGANA aims to make farm experiences easier to discover while helping local farms increase their online visibility.

## Key Features

- **Farm discovery** – Browse and search farm listings, including seasonal and featured destinations.
- **Map and nearby farms** – Explore farm locations on an interactive map and find farms near your location.
- **Farm profiles** – View farm descriptions, crops, seasons, operating details, photos, videos, and directions.
- **Farm questions** – Ask questions about a farm through the on-page chat feature, with AI-assisted responses configured through OpenRouter.
- **Visit reservations** – Submit a visit request by selecting a farm, date, time slot, and visitor details. No visitor account is required.
- **Farm registration** – Submit a farm listing for administrator review.
- **Reservation updates and digital tickets** – Administrators review reservation requests; approved reservations receive a QR-code ticket by email.

> **Booking note:** Submitting a reservation is a request, not an instant confirmation. The reservation remains pending until an administrator reviews it.

## How It Works

**For visitors:** Discover a farm → Review its details → Choose a date and time → Submit visitor details → Receive an update after administrator review.

**For farm owners:** Submit farm information → Wait for administrator review → An approved farm can be published in the directory.

## Technology

| Area | Technology |
|---|---|
| Web framework | Next.js 16 |
| User interface | React 19 |
| Language | JavaScript |
| Database and backend services | Supabase (PostgreSQL) |
| Interactive map | Leaflet with OpenStreetMap tiles |
| Email notifications | Brevo |
| AI-assisted farm chat | OpenRouter |
| QR-code tickets | `qrcode` |

## System Diagrams

The diagrams below provide a simplified view of SAGANA's core data relationships and main user journeys. They focus on the parts most useful for understanding the system without reproducing every implementation detail.

### UML Class Diagram

This class diagram summarizes the main farm, time-slot, reservation, and question records used by the application. A reservation belongs to one farm and one time slot; a farm can have multiple time slots, reservations, and questions.

```mermaid
classDiagram
    class Farm {
        +UUID id
        +String name
        +String location
        +String province
        +String description
        +String[] crops
        +Boolean is_active
        +Integer max_party_size
    }

    class FarmTimeSlot {
        +UUID id
        +UUID farm_id
        +String label
        +Boolean is_active
        +Integer sort_order
    }

    class Reservation {
        +UUID id
        +UUID farm_id
        +UUID time_slot_id
        +String visitor_name
        +String visitor_email
        +String visitor_phone
        +Integer guest_count
        +Date visit_date
        +String status
    }

    class FarmQuestion {
        +UUID id
        +UUID farm_id
        +String question
        +String visitor_email
        +String status
        +String admin_answer
    }

    Farm "1" --> "0..*" FarmTimeSlot : offers
    Farm "1" --> "0..*" Reservation : receives
    FarmTimeSlot "1" --> "0..*" Reservation : selected for
    Farm "1" --> "0..*" FarmQuestion : receives
```

### Main User Flowchart

```mermaid
flowchart TD
    A([Visitor opens SAGANA]) --> B[Browse or search farms]
    B --> C[Select a farm]
    C --> D[Review farm details, photos, videos, and location]
    D --> E{What would the visitor like to do?}

    E -->|Ask a question| F[Submit a farm question]
    F --> G{Can the AI answer?}
    G -->|Yes| H[Show the answer to the visitor]
    G -->|No| I[Request visitor email]
    I --> J[Save the question and notify the farm contact]

    E -->|Request a visit| K[Choose visit date and time slot]
    K --> L[Enter visitor and guest details]
    L --> M[Submit reservation request]
    M --> N[Save reservation as Pending]
    N --> O[Administrator reviews the request]
    O --> P{Decision}
    P -->|Approve| Q[Generate QR ticket and email visitor]
    P -->|Reject| R[Email reservation status]

    S([Farm owner submits a farm listing]) --> T[Save listing as Pending and inactive]
    T --> U[Administrator reviews the farm listing]
    U --> V{Decision}
    V -->|Approve| W[Activate farm for public discovery]
    V -->|Reject| X[Notify farm owner of the decision]
```

## Run Locally

### Requirements

- Node.js 20 or newer
- npm
- A Supabase project
- A Brevo account with an API key and verified sender address
- An OpenRouter API key for AI-assisted farm chat (optional)

### Setup

1. **Clone the repository and install dependencies.**

   ```bash
   git clone <repository-url>
   cd sagana-farm-website-main
   npm ci
   ```

2. **Create the environment file.** Copy `.env.example` to `.env.local` and fill in the required values.

   ```bash
   cp .env.example .env.local
   ```

   On Windows Command Prompt:

   ```bat
   copy .env.example .env.local
   ```

3. **Configure Supabase.** Apply the SQL migrations in `supabase/migrations/` in filename order. Add farm records and their visitor-facing time slots. Set `is_active = true` for farms that should appear publicly.

4. **Start the development server.**

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public/anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `FARM_ADMIN_EMAIL` | Administrator email for reservation and farm-related notifications |
| `RESERVATION_FROM_EMAIL` | Verified sender address in Brevo |
| `APP_BASE_URL` | Application origin, such as `http://localhost:3000` |
| `RATE_LIMIT_SECRET` | Server-side secret used by request rate limiting |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI-assisted farm chat |
| `OPENROUTER_MODEL` | Optional model ID; defaults to `openrouter/free` |

Keep credentials in `.env.local` or your hosting provider's environment settings. **Never commit secrets or expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.**

## Useful Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Build the application for production |
| `npm run start` | Run the production build |
| `npm run lint` | Check code with ESLint |
| `npm test` | Run automated tests |
| `npm run test:integration` | Run integration tests |

---

## AI Assistance Disclosure

GitHub Copilot was used as an AI-assisted development tool to support selected coding, refinement, and debugging tasks. The development team reviewed and adapted its suggestions and remains responsible for the final implementation. SAGANA's AI-assisted farm chat is a separate application feature powered by OpenRouter.

---

## Development Team

**HCI 321 – Human Computer Interaction**  
**Group 06 · CS 3104**

| Student Number | Developer |
|---|---|
| 24-04063 | Nikki C. Limboc |
| 24-01351 | Julian Carlo C. Magbuhat |
| 24-06089 | Christine Nicole P. Miranda |

---

<p align="center">
  <b>SAGANA connects people to local farms, seasonal harvests, and meaningful countryside experiences.</b>
</p>
