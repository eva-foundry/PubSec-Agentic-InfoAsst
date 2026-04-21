# Sample documents

This folder holds the test / demo corpus that AIA ingests for end-to-end
walkthroughs (upload → chunk → embed → search → chat with citations).

**No documents are shipped in this repo.** Bring your own.

## What to drop here

Plain text (`.txt`), Markdown (`.md`), PDF (`.pdf`), or Word (`.docx`) files
whose content you are comfortable indexing into Azure AI Search and having
an LLM cite from. A few documents (5–20 pages each) is enough to exercise
the full pipeline; hundreds are enough for a realistic demo.

Public-domain sources that work well:

- A handful of Wikipedia articles in your target domain (exported as `.txt`)
- Public RFCs (`.txt` — e.g. RFC 7540, RFC 9110)
- Public policy documents from your own organization (un-classified only)
- Open textbooks or course material with permissive licences
- Generated internal documentation for your own tooling

## What not to put here

- Classified, sensitive, or personally-identifying material
- Material you do not have redistribution rights for
- Anything branded to a specific organization if you intend to publish
  screenshots or demos

The pipeline treats everything in this directory as untrusted input — it
will be chunked, embedded, and indexed exactly as written.
