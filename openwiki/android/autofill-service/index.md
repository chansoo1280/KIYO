# Files

- [Autofill Auth Activity](auth-handler.md) - DEVICE_CREDENTIAL/PIN prompt activity triggered when KiyoAutofillService hits UserNotAuthenticatedException.
- [KiyoBiometricActivity](biometric-activity.md) - Legacy/separate broadcast-based biometric prompt activity (distinct from BiometricAuthHelper+SecureKeyPlugin vault unlock).
- [Credential Extractor](credential-extraction.md) - Extracts username/password values from AssistStructure fields after detection.
- [Autofill Field Detection](field-detection.md) - FieldDetector, FieldScorer, FieldScoringRules, FieldCandidate - logic that identifies username/password fields from an AssistStructure.
- [Fill Response Builder](fill-response.md) - FillResponseBuilder and DatasetFactory - construct AutofillFramework FillResponse objects for fills and auth prompts.
- [Icon Resource Mapper](icon.md) - Maps a website/app domain or package name to a drawable resource id used in autofill UI.
- [KiyoAutofillService](service-overview.md) - Lifecycle and request handlers for the Android AutofillService entry point (per-request fresh repository, two-stage fill, onSaveRequest).
- [Autofill Settings Activity](settings.md) - Stub activity registered as the system autofill settings deep-link target.
- [ViewNode Extraction](viewnode-extraction.md) - ViewNodeTraversal, ViewNodeExtractor, ViewNodePredicate, HtmlAttributeExtractor - utilities for extracting web domain, package names, and HTML attributes from an AssistStructure.
