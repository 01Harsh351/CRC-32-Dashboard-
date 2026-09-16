# CRC-32 Verification Dashboard & Academic Laboratory

A production-grade, interactive verification dashboard for CRC-32 (IEEE 802.3 standard) polynomial generation, modulo-2 long division, dual-side receiver verification, single/burst channel noise simulation, and CSV report export.

## Deployment on Vercel

This project is pre-configured and 100% ready for zero-config deployment on [Vercel](https://vercel.com).

### Option 1: Deploy with Git (Recommended)

1. Push this project to your GitHub, GitLab, or Bitbucket repository.
2. Go to your [Vercel Dashboard](https://vercel.com/new).
3. Click **"Add New..."** → **"Project"** and import the repository.
4. Vercel automatically detects the **Vite** framework preset:
   - **Framework Preset**: `Vite`
   - **Build Command**: `vite build` (or `npm run build`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Click **"Deploy"**. The site will be live in under 1 minute.

### Option 2: Deploy with Vercel CLI

1. Install the Vercel CLI globally (if not already installed):
   ```bash
   npm i -g vercel
   ```
2. Run the deployment command from the project root:
   ```bash
   vercel
   ```
3. To deploy directly to production:
   ```bash
   vercel --prod
   ```

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run TypeScript linter
npm run lint

# Build for production
npm run build
```

## Key Files
- `src/crcUtils.ts`: Complete CRC-32 mathematical engine and utilities.
- `src/crc_mvp.ts`: Standalone, zero-dependency MVP code for academic reference.
- `public/CRC-32-Code-Explanation.pdf`: Complete compiled PDF reference document.
- `vercel.json`: Pre-configured routing for single-page application fallback.
