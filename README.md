# Site Audit MVP

A deep express site audit tool that checks indexing, meta tags, links, media, security headers, speed, accessibility, and basic technical hygiene of web pages.

## Features

- **SEO Analysis**: Title, meta description, headings hierarchy, canonical URLs, robots.txt, sitemap, hreflang, JSON-LD
- **Performance**: Response time, HTML size, compression, resource caching, heavy images, JS/CSS file count
- **Security**: HTTPS, HSTS, security headers, mixed content, cookie flags, TLS certificate validation
- **Accessibility**: Viewport, favicon, form labels, image alt text, contrast ratios, interactive element text
- **Content**: Word count, link analysis (internal/external), broken links detection
- **Social**: Open Graph tags, Twitter Card validation

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: EJS templates, Tailwind CSS
- **Deployment**: Netlify (serverless functions)
- **Dependencies**: axios, cheerio, serverless-http

## Installation

```bash
npm install
```

## Local Development

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

This builds the CSS using Tailwind CLI.

## Deployment

This project is configured for Netlify deployment with serverless functions:

1. Connect your GitHub repository to Netlify
2. Netlify will automatically detect the configuration from `netlify.toml`
3. The build command `npm run build` will run automatically
4. The app will be deployed as a serverless function

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)

### Netlify Configuration

The `netlify.toml` file includes:
- Build command: `npm run build`
- Publish directory: `public`
- Serverless function configuration with external modules

## Usage

1. Enter a website URL in the input field
2. Click "Run Audit"
3. View the comprehensive audit report with:
   - Overall score (0-100)
   - Critical issues, warnings, and OK items
   - Detailed insights by category
   - Raw technical data

## Audit Checks

The tool performs the following checks:

- HTTP status and redirects
- Content-Type validation
- HTTPS/SSL configuration
- Title and meta description length
- Heading structure (H1-H6)
- Meta robots directives
- robots.txt and sitemap.xml
- Canonical URL validation
- Image alt attributes and dimensions
- Open Graph and Twitter Card tags
- Page content volume
- JSON-LD structured data
- Response time and HTML size
- Compression (gzip/brotli)
- Resource caching
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Mixed content detection
- Cookie security flags
- TLS certificate expiration
- Mobile viewport
- Favicon presence
- Form field labels
- Link and button accessibility
- Color contrast
- HTML lang attribute
- Character encoding
- hreflang tags
- Link validation (sample of up to 50 links)

## License

ISC
