# CadenceLab

**Evidence-based video and social content analysis for creators, agencies, and marketing teams.**

CadenceLab helps you review short-form videos, compare post performance with relevant peers, and turn supplied content data into reports with traceable references. It brings video pacing diagnostics and content research into one workspace, with a desktop application for local processing and a web interface under development.

**Status: early preview.** Desktop **v0.3.1** is available for testing on macOS Apple Silicon and Windows x64. The product is still being validated; its scores are editing and research aids, with no demonstrated predictive accuracy for audience retention or virality.

[Download Desktop](https://github.com/builevi/cadencelab/releases/latest) · [Report an issue](https://github.com/builevi/cadencelab/issues) · [MIT License](LICENSE)

## What you can do

- **Review short-form video pacing.** Upload a video to examine motion, audio changes, and transcript-based information density along a timeline. Use flagged moments to guide an editorial review.
- **Compare content against relevant peers.** Analyze supplied post data using comparable cohorts. The post being evaluated is excluded from its own performance baseline.
- **Build reports with traceable references.** AI-assisted interpretations include quotations checked against supplied text. Missing evidence stays visible; quotation matching does not guarantee that an interpretation is correct.
- **Explore content questions and trend scenarios.** Experimental workspaces support semantic retrieval over supplied content and conditional trend modeling. These require suitable input data and manual review.

Designed for people who need to explain *what to review and what evidence supports it*: independent creators, editors, small agencies, and in-house content teams.

## Download and get started

Choose the installer for your computer from the [latest release](https://github.com/builevi/cadencelab/releases/latest):

| Platform | Available installer | Release status |
|---|---|---|
| macOS — Apple Silicon (M1 or newer) | `.dmg` | Preview; ad-hoc signed, not Apple-notarized |
| Windows — x64 | `.exe` | Preview; not code-signed |

Intel Mac and Linux installers are not currently available. Startup and interface checks have passed on macOS and Windows CI runners; installation on clean customer devices has not yet been comprehensively validated. Your operating system may display a security warning for these preview builds.

1. Install and open CadenceLab. Desktop bundles its application runtime, video tools, and speech model; normal use does not require Python or Node.js.
2. Open **AI Settings** (currently labeled **Cài đặt AI**), select a provider, configure the model and credentials where required, then test and save the connection.
3. Upload a supported video or supply content data. Review the transcript, source references, and missing-data notices alongside the results. Some workspaces include explicitly labeled examples.

Current video limit: **60 seconds and 25 MiB per file**. The interface is currently primarily in Vietnamese; English localization is planned. This README is the English introduction to the project, rather than a claim that the application is already fully localized.

## Desktop and web availability

**Desktop** is the downloadable preview available today. It runs analysis services on your computer and stores reports and settings locally. The **Software Updates** section checks GitHub Releases and links to a newer installer when available; updates are installed manually.

**Web** is an experimental browser interface. The current deployment depends on a developer-operated origin and may be unavailable when that machine is offline. It is not yet an independently hosted, always-on service. Shared account security, tenant isolation, and operational controls need further work before a public multi-user SaaS launch. For the available preview, use the Desktop downloads above.

## AI and data handling

Desktop supports configurable adapters for OpenAI, Gemini, DeepSeek, Groq, an existing Codex CLI login, and a local Ollama service. Provider and model compatibility varies; you need your own access and any required quota. Codex and Ollama are separate installations.

Video decoding, signal extraction, and speech transcription run locally. Selecting a cloud AI provider sends the relevant analysis input to that provider. A Codex CLI login also requires online access; it does not make AI processing offline. Ollama can support local AI analysis when the service and a suitable model are already installed. Collecting data from social links still requires internet access.

Desktop API keys use the operating system's encrypted storage mechanism. The preview does not include a shared AI subscription or bundled credentials.

## How the analysis works

| Component | Approach | Current interpretation |
|---|---|---|
| Video pacing (CFI) | Combines normalized motion, audio-change, and transcript signals over time | A heuristic review aid; no calibrated retention or completion-rate prediction |
| Peer comparison | Leave-one-out comparisons within suitable content cohorts | Relative performance within the supplied sample; insufficient cohorts are reported |
| Trend modeling (SEIR-F) | Fits a population-based diffusion scenario to daily active-spreader observations | Experimental conditional scenarios; views and likes cannot substitute for active-spreader counts |
| Content-gap research | Compares question and content embeddings within a supplied corpus | Retrieval candidates for manual answer review; similarity alone does not establish unmet market demand |
| AI reports | Structured responses and exact-quotation checks against supplied text | Traceable supporting text, with human review still required |

These are implementation choices, not a claim of proven superiority over other analytics products.

## Current limitations and development status

- **Video understanding:** speech and signal analysis are implemented. OCR and full visual-semantic understanding are not yet implemented. Silent visual storytelling can be underrepresented.
- **Social links:** public-source collection is best effort. TikTok and other platforms may restrict access; a URL alone does not provide private retention or account analytics. Supplied files and authorized data are the more dependable inputs.
- **Prediction:** no independent real-world benchmark currently establishes forecasting accuracy, retention improvement, or return on investment.
- **Research workspaces:** some screens use demonstration inputs. Content-gap research does not yet provide a complete verified demand-collection and embedding-generation pipeline.
- **Release versus ongoing work:** v0.3.1 is the downloadable baseline. Additional algorithm safeguards have been implemented and tested in the development workspace, including pacing corrections, forecast quality checks, and unverified-demand handling. They have not yet been published in a new installer. Do not assume a downloaded build includes unreleased work.

Next priorities include validating results on authorized real-world datasets, completing English localization, improving input provenance and visual analysis, and preparing signed installers and an independently operated web service. These are development priorities, not committed delivery dates.

## For developers

For source setup and local development, see [Development](docs/DEVELOPMENT.md). Architecture, providers, packaging, and hosting details are documented separately:

- [Desktop architecture and build notes](docs/DESKTOP_APP.md)
- [Video analysis pipeline](docs/VIDEO_PIPELINE.md)
- [Provider integration](docs/CODEX_LOCAL_WORKFLOW.md)
- [Web deployment considerations](docs/WEB_HOSTING.md)
- [Release process](docs/RELEASING.md)

Some technical documents remain in Vietnamese and may describe a particular development snapshot. The release notes and assets identify what is actually distributed.

## License

Original CadenceLab source code is available under the [MIT License](LICENSE), copyright © 2026 builevi.

Third-party libraries, models, fonts, runtimes, and binaries retain their own licenses. The project's MIT license does not replace those terms. See [Desktop third-party notices](docs/DESKTOP_NOTICES.txt).
