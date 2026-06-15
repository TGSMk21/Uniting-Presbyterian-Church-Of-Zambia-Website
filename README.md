# Uniting-Presbyterian-Church-Of-Zambia-Website

A full-featured church website for **Chilanga Presbyterian Church (CUPC)** built with **Next.js 16**, **Sanity CMS**, and modern web technologies. The site serves as a digital hub for the congregation, featuring sermon streaming, daily devotionals, church activities, project tracking, and a contact system.

## Features

- **Dynamic Homepage** — Carousel with welcome banner, yearly theme, and daily verse; daily message display; ministries overview; schedule; contact form
- **Sermons & Messages** — Live YouTube stream detection and embed, archived sermon videos with metadata (series, reference verses) fetched from the YouTube Data API
- **Projects & Activities** — Track church projects (with status, progress, dates) and upcoming/ongoing activities (with time, location, details)
- **About Page** — Church history, reverend biography, location map, and contact details
- **Contact Form** — Server-action-based email sending via **Resend** with **Upstash rate limiting** to prevent spam
- **Headless CMS** — **Sanity Studio 5** for managing content (verses, messages, streams, archive videos, projects, activities) with on-demand revalidation
- **Responsive UI** — Fully responsive design using **Tailwind CSS 4** with mobile drawer navigation
- **React Email** — Beautiful email templates for contact form submissions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, React Server Components) |
| **UI Library** | [React 19](https://react.dev/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **CMS** | [Sanity Studio 5](https://www.sanity.io/) (headless CMS + GROQ queries) |
| **Email** | [Resend](https://resend.com/) + [React Email](https://react.email/) |
| **Rate Limiting** | [Upstash Redis](https://upstash.com/) + [Upstash Ratelimit](https://github.com/upstash/ratelimit) |
| **YouTube API** | [Google APIs](https://googleapis.dev/) (YouTube Data API v3) |
| **Carousel** | [Embla Carousel](https://www.embla-carousel.com/) |
| **Icons** | [Lucide React](https://lucide.dev/), [Simple Icons](https://simpleicons.org/) |
| **Image Optimization** | [@sanity/image-url](https://www.sanity.io/docs/image-url) |
| **Linting** | [ESLint](https://eslint.org/) (Next.js config) |
| **Compiler** | [React Compiler](https://react.dev/learn/react-compiler) enabled |

## Project Structure

```
PresbyterianWeb/
├── presbyterian-web/          # Next.js frontend application
│   ├── app/                   # App Router pages
│   │   ├── about/             # About page
│   │   ├── sermons/           # Sermons page (live + archive)
│   │   ├── projects-and-activities/  # Projects & activities page
│   │   ├── api/revalidate/    # On-demand revalidation endpoint
│   │   └── layout.js          # Root layout with Header/Footer
│   ├── components/            # React components
│   ├── Services/              # Data fetching (Sanity, YouTube)
│   ├── Utilities/             # Date formatting, rate limiting
│   ├── constants/             # Dummy data fallbacks
│   └── react-email-starter/   # Email templates
│
└── PresbyterianSanity/        # Sanity CMS Studio
    └── schemaTypes/           # Content schemas
        ├── Home/              # Daily verse, daily message
        ├── Sermons/           # Upcoming stream, archive video
        └── Projects & Activities/  # Project, activity
```

## Getting Started

### Prerequisites

- Node.js >= 18
- A [Sanity](https://sanity.io) project with ID and dataset configured
- A [YouTube Data API key](https://console.cloud.google.com/)
- [Upstash Redis](https://upstash.com/) URL and token
- [Resend](https://resend.com/) API key

### Environment Variables

Create `presbyterian-web/.env.local`:

```env
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_CHANNEL_ID=your_channel_id
RESEND_API_KEY=your_resend_api_key
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
PROJECT_ID=your_sanity_project_id
```

### Install & Run

```bash
# Frontend
cd presbyterian-web
npm install
npm run dev

# Sanity Studio (separate terminal)
cd PresbyterianSanity
npm install
npx sanity dev
```

### Build

```bash
npm run build   # presbyterian-web
npx sanity build  # PresbyterianSanity
```

## License

This project is private and unlicensed.
