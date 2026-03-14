Eduardo Gonzalez Ortiz

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Gemini API key — get one at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Google Service Account JSON (for Docs/Drive API)
# Paste the entire service account JSON as a single-line string
# Get it from: Google Cloud Console → IAM → Service Accounts → Keys → Add Key → JSON
GOOGLE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"..."}
```

**Never commit `.env.local` to the repository.**
