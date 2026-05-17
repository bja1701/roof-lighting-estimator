# Roof Lighting Estimator

A React-based web application for estimating roof lighting installations using Google Maps satellite imagery.

## Features

- Interactive satellite map interface for roof selection
- Visual pitch measurement tool
- Roof area calculation
- Pricing estimation for lighting installations
- Drawing tools for roof outline creation

## Prerequisites

- Node.js (v14 or higher)
- Google Maps API Key with Maps JavaScript API enabled
- (Optional) Gemini API Key for AI features

## Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd roof-lighting-estimator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   To get a Google Maps API key:
   - Visit https://developers.google.com/maps/documentation/javascript/get-api-key
   - Create a project and enable the Maps JavaScript API
   - Create credentials and copy your API key

4. **Run the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## Deploy to Vercel (via GitHub)

1. **Push this project to GitHub**
   - Create a new repository on [GitHub](https://github.com/new) (e.g. `roof-lighting-estimator`).
   - From your project root (the folder that contains `roof-lighting-estimator`):
     ```bash
     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
     git add .
     git commit -m "Prep for deploy"
     git branch -M main
     git push -u origin main
     ```
   - If this repo is **only** the app (no parent folder), run the above from inside `roof-lighting-estimator` and push from there.

2. **Import the repo in Vercel**
   - Go to [vercel.com](https://vercel.com) → **Add New…** → **Project**.
   - Import your GitHub repo and authorize Vercel if prompted.

3. **Set the root directory (if the app is in a subfolder)**
   - If your GitHub repo has the app inside a subfolder (e.g. `roof-lighting-estimator`), open **Settings** → **General** → **Root Directory**.
   - Set it to `roof-lighting-estimator` and save.

4. **Add environment variables**
   - In the Vercel project: **Settings** → **Environment Variables**.
   - Add:
     - `VITE_GOOGLE_MAPS_API_KEY` = your Google Maps API key
     - `GEMINI_API_KEY` = your Gemini API key (optional)
   - Redeploy (e.g. **Deployments** → … on latest → **Redeploy**) so the build uses the new variables.

5. **Deploy**
   - Vercel will build and deploy. Future pushes to `main` will trigger new deployments automatically.

## Important Security Notes

- **Never commit your `.env` file to version control**
- The `.env` file is already included in `.gitignore`
- Always use `.env.example` as a template for required environment variables
- Keep your API keys secret and rotate them if exposed
