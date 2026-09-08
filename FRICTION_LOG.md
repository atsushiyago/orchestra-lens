# Orchestra Lens — Friction Log

## 1. Media playback documentation ambiguity

**Task attempted**  
Implement URL-based media playback in a React Native Kepler 4.0.1 Fire TV app.

**Steps taken**

1. Reviewed Vega media-player documentation.
2. Found examples using `KeplerVideoView`.
3. Found another official example using `KeplerVideoSurfaceView` + `setSurfaceHandle()`.
4. Asked the Amazon Developer Community which pattern was canonical.

**Expected**  
One clearly documented recommended pattern for current React Native Kepler / w3cmedia applications.

**Actual**  
Different official pages showed different component patterns, making it unclear which approach should be preferred.

**Severity**  
Important

**Workaround**  
Asked the Amazon Developer Community for clarification. Support confirmed the documentation currently shows two different patterns and said the inconsistency is being reviewed internally.

**Actionable suggestion**  
Provide separate canonical examples for audio-only URL playback, MP4 video playback, HLS/DASH, and DRM/live streaming, and explicitly identify the preferred component for each case.

---

## 2. Vega Virtual Device media-session instability

**Task attempted**  
Repeatedly test audio-only AAC-LC `.m4a` playback in a Release VPKG on Vega Virtual Device.

**Steps taken**

1. Launch the same Release VPKG.
2. Play the same HTTPS CloudFront-hosted AAC-LC `.m4a` source.
3. Repeat testing during extended VVD sessions.
4. Retry playback after `MEDIA_ERR_SRC_NOT_SUPPORTED`.
5. Restart the app and Vega Virtual Device.

**Expected**  
The same supported HTTPS media source should continue loading consistently across repeated test sessions.

**Actual**  
After extended VVD use, playback could begin failing with:

`MEDIA_ERR_SRC_NOT_SUPPORTED (code 4)`

The player remained at `0:00 / 0:00`, and Retry did not always recover it.

Restarting VVD sometimes restored playback, but in at least one case even restarting VVD did not recover the media subsystem. Restarting the host macOS system restored playback with the exact same Release VPKG and media URL.

**Severity**  
Important

**Workaround**  
Restart the host system when the VVD media environment enters the persistent failing state.

**Actionable suggestion**  
Investigate media/session cleanup in Vega Virtual Device and provide more diagnostic information for `MEDIA_ERR_SRC_NOT_SUPPORTED`, especially when an unchanged source transitions from working to failing.

Related Amazon Developer Community report:

[Vega 0.24 / VVD] Audio-only URL playback eventually fails with MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) - Vega Open Beta / Bug Reports - Amazon Developer Community
https://community.amazondeveloper.com/t/vega-0-24-vvd-audio-only-url-playback-eventually-fails-with-media-err-src-not-supported-code-4/29106

Documentation clarity for URL playback: KeplerVideoView vs KeplerVideoSurfaceView - Vega Open Beta / Feature Requests - Amazon Developer Community
https://community.amazondeveloper.com/t/documentation-clarity-for-url-playback-keplervideoview-vs-keplervideosurfaceview/29087
