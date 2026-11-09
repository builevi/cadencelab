# Local development

This guide is for contributors running CadenceLab from source. Desktop users should use the installers linked from the project README.

## Requirements

Python 3.12+, uv, Node.js, and npm. Run the following commands from the repository root. AI-assisted operations also require a configured provider and any relevant account access or local runtime.

## Backend

```sh
git clone https://github.com/builevi/cadencelab.git
cd cadencelab
uv sync --locked --extra media --group dev
uv run --extra media python scripts/prepare_video_models.py
uv run --extra media uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

The model-preparation step downloads the speech model. API documentation is available at `http://127.0.0.1:8000/docs` while the backend is running.

## Frontend

In a second terminal, from the same repository root:

```sh
npm --prefix apps/web ci
npm --prefix apps/web run dev
```

Open `http://localhost:3000`. The frontend forwards API requests to the backend on port 8000. For a production-mode local build, use `npm --prefix apps/web run build` followed by `npm --prefix apps/web start`.

## Validation

```sh
uv run python -m unittest discover -s tests -v
```

Tests verify implementation behavior; synthetic tests do not establish predictive accuracy on real audience outcomes.

Keep API keys, `.env.local`, account credentials, report databases, and uploaded user content out of Git. Review [web deployment considerations](WEB_HOSTING.md) before exposing a service to other users; the local development configuration is not a production multi-tenant deployment.

See [Desktop build notes](DESKTOP_APP.md) and [release process](RELEASING.md) for packaging. Development-workspace changes are not automatically included in existing release installers.
