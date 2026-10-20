# WorldQuant Alpha Miner interface

The FastAPI app serves the built interface from `web/static/ui`. API routes and research logic remain in the existing Python project.

## Local development

From `web/`, run the backend with the project's Python environment:

```sh
../.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8080 --reload
```

From `frontend/`, run the live preview:

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. Vite proxies API requests to the local backend.

## Build for the FastAPI page

```sh
cd frontend
npm install
npm run build
```

Then open `http://127.0.0.1:8080/dashboard`. The generated `web/static/ui` directory is included in this fork and can be rebuilt from source. All font files are bundled locally, so the page works with the backend's existing content security policy.

The React Bits Starter registry item needs a licensed Starter+ registry key. The interface uses a local 2D SVG orbital mark in its place. The public AnimatedList source is used for the activity feed; MagicBento and FluidGlass are installed as reference source but are not mounted because their continuous canvas effects exceed this project's rendering budget.
