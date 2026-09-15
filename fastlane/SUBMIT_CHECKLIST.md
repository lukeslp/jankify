# iOS release checklist

For an application record you control:

- Build and test the current source with your own signing team and application identifier.
- Verify the archived bundle identifier, version and build number before upload.
- Use screenshots captured from the intended release; retain their image-source notices.
- Check the description, privacy URL, supported devices, age rating and app privacy answers against actual behavior.
- Wait for uploaded-build processing, then verify the intended build is attached to the editable version.
- Review the final listing and complete review submission separately.

The included Fastlane upload lanes modify App Store Connect. They do not submit an app for review. `dedup_shots` deletes duplicate screenshots and should be used only after inspecting the target record. See `README.md` in this directory for configuration and commands.
