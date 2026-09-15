# Android store preparation

The browser app and debug Android build work without a store account. See the root README for setup.

For an independently distributed Android build:

1. Choose an application ID and signing identity you control. Keep the same key for updates to that application ID.
2. Build the current source and run unit, bridge and device tests. Include import, still and animated export, cancellation, background/resume, and storage cleanup.
3. Check TalkBack focus and labels, large text, touch targets, rotation and reduced-motion behavior on representative phones and tablets.
4. Capture screenshots from that exact build and describe its actual behavior. Review privacy statements against its manifest, bundled assets and network use.
5. Review the current store requirements and your account's eligibility before uploading or distributing a build.

Store metadata and source versions are independent. The files in this repository are examples and source material, not live console-state records.
