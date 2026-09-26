# Rendering-engine workflow validity — 2026 Chrome sweep

Scope: local disposable Compose plus the owner-authorized active Chrome
session. This report synthesizes the terminal QA records for #853–#861. It
does not claim production, physical microphone, or ZIP-download parity.

Legend: `PASS` means the cited local workflow evidence passed; `GAP` means the
workflow exposed an open follow-up.

| Engine | Create | Edit | Sound defaults | Publish | Regular | Immersive | Embed | ZIP | Sound runtime | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| p5.js | PASS [#853](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/853) | PASS [#853](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/853) | PASS [#853](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/853) | PASS [#853](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/853) | PASS [#853](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/853) | GAP [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) / [#893](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/893) | GAP [#860](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/860) / [#898](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/898) | GAP [#861](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/861) / [#895](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/895) | GAP [#909](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/909)–[#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | VALID WITH GAPS |
| C2.js | PASS [#854](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/854) | PASS [#854](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/854) | PASS [#854](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/854) | PASS [#854](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/854) | PASS [#854](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/854) | GAP [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) / [#893](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/893) | GAP [#860](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/860) / [#907](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/907) | GAP [#861](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/861) / [#902](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/902) | GAP [#909](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/909)–[#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | VALID WITH GAPS |
| C2.js Interactive | PASS [#855](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/855) | PASS [#855](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/855) | PASS [#855](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/855) | PASS [#855](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/855) | PASS [#855](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/855) | GAP [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) / [#893](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/893) | GAP [#860](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/860) | GAP [#861](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/861) / [#902](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/902) | GAP [#909](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/909)–[#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | VALID WITH GAPS |
| SVG | PASS [#856](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/856) | PASS [#856](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/856) | PASS [#856](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/856) | PASS [#856](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/856) | PASS [#856](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/856) | GAP [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) / [#893](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/893) | GAP [#860](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/860) | GAP [#861](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/861) / [#903](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/903) | GAP [#909](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/909)–[#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | VALID WITH GAPS |
| A-Frame | PASS [#857](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/857) | PASS [#857](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/857) | PASS [#857](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/857) | PASS [#857](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/857) | PASS [#857](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/857) | GAP [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) / [#899](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/899) | GAP [#860](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/860) / [#907](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/907) | GAP [#861](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/861) / [#901](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/901) | GAP [#909](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/909)–[#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | VALID WITH GAPS |
| Three.js | PASS [#858](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/858) | PASS [#858](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/858) | PASS [#858](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/858) | PASS [#858](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/858) | PASS [#858](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/858) | GAP [#859](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/859) / [#899](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/899) | GAP [#860](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/860) / [#907](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/907) | GAP [#861](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/861) / [#901](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/901) | GAP [#909](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/909)–[#916](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/916) | VALID WITH GAPS |

## Verdict and friction

The creator-to-regular-view workflow is locally valid for all six engines.
The complete cross-surface workflow is valid with gaps: immersive, embed,
download, and microphone parity are not interchangeable with regular-view
evidence. Flat-engine immersive presentation depends on #900/#893; 3D
immersive routing is #899; generated embeds are #898/#907; downloads are
#895/#901–#903; live microphone flow is #909–#916.

Highest-impact fixes:

1. Finish shared regular/immersive/embed toolbar and navigation parity
   (#892 and #893/#898/#899/#907).
2. Preserve surface-specific overlays and navigation in Full and Non-Camera
   ZIPs (#895 and #901–#903).
3. Complete microphone routing, the audio-flow harness, and the owner hardware
   checklist (#909–#916).

All evidence is local-only; this report makes no deployment or production-data
claim.
