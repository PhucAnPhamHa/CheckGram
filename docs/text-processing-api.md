# Text Processing API

The API is a Fastify service started with `npm run dev` or `npm start`.

## Configuration

Copy `.env.example` to `.env`. LanguageTool is enabled by default. Set `OPENAI_API_KEY` to enable contextual categories (`Clarity`, `Engagement`, and `Delivery`) and rewrites.

## Analyze text

```http
POST /api/v1/analyze
Content-Type: application/json

{
  "text": "This are a teh test.",
  "tone": "Professional"
}
```

Response:

```json
{
  "suggestions": [
    {
      "startOffset": 0,
      "endOffset": 4,
      "suggestionType": "Correctness",
      "replacementOptions": ["These"],
      "explanation": "The singular demonstrative pronoun does not agree with the plural verb.",
      "source": "languagetool"
    }
  ]
}
```

`startOffset` is inclusive and `endOffset` is exclusive. Both are zero-based JavaScript UTF-16 offsets into the submitted `text`. The service rejects provider suggestions whose ranges are outside the source text. Overlapping suggestions are reduced to the highest-ranked result.

## Rewrite highlighted text

```http
POST /api/v1/rewrite
Content-Type: application/json

{
  "text": "Can you send this soon?",
  "tone": "Professional"
}
```

Response:

```json
{
  "variations": [
    {
      "text": "Could you please send this at your earliest convenience?",
      "explanation": "Uses a more formal request."
    },
    {
      "text": "Please send this when you have a moment.",
      "explanation": "Keeps the request professional and concise."
    },
    {
      "text": "Would you please send this soon?",
      "explanation": "Softens the request while preserving urgency."
    }
  ]
}
```

The rewrite route returns `503` when `OPENAI_API_KEY` is not configured and `502` when the provider fails.
