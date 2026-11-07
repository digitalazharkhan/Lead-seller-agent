# Office pose mapping

These are the best matching poses found in the processed contact sheets. The runtime uses the matching pixelated files under `public/office/processed-pixel/`; source poses remain under `public/office/processed/`. The source files are trimmed PNG poses, not uniform sprite atlases. Every missing pose deliberately falls back to that character's stand pose.

| Character | Sit | Stand | Walk | Angry | Success | Talk |
|---|---|---|---|---|---|---|
| Azhar | `azhar/azhar-sit.png` (Ali placeholder) | `azhar/azhar-stand.png` (Ali placeholder) | `azhar/azhar-walk.png` (Ali placeholder) | `azhar/azhar-angry.png` (Ali placeholder) | `azhar/azhar-success.png` (Ali placeholder) | `azhar/azhar-talk.png` (Ali placeholder) |
| Khan | `khan/khan-10.png` (stand fallback) | `khan/khan-10.png` | `khan/khan-10.png` (stand fallback) | `khan/khan-06.png` | `khan/khan-01.png` | `khan/khan-12.png` |
| Ali | `ali/ali-20.png` | `ali/ali-02.png` | `ali/ali-08.png` | stand fallback | stand fallback | `ali/ali-21.png` |
| Ayesha | `ayesha/ayesha-13.png` | `ayesha/ayesha-02.png` | `ayesha/ayesha-07.png` | `ayesha/ayesha-19.png` | `ayesha/ayesha-20.png` | `ayesha/ayesha-30.png` |
| Hassan | `hassan/hassan-20.png` | `hassan/hassan-02.png` | `hassan/hassan-08.png` | stand fallback | stand fallback | `hassan/hassan-21.png` |
| Sara | `sara/sara-13.png` | `sara/sara-02.png` | `sara/sara-07.png` | `sara/sara-22.png` | `sara/sara-19.png` | `sara/sara-30.png` |
| Usman | `usman/usman-13.png` | `usman/usman-02.png` | `usman/usman-08.png` | `usman/usman-17.png` | `usman/usman-20.png` | `usman/usman-22.png` |
| Zainab | `zainab/zainab-13.png` | `zainab/zainab-02.png` | `zainab/zainab-07.png` | `zainab/zainab-18.png` | `zainab/zainab-17.png` | `zainab/zainab-21.png` |

Other character pose paths are relative to `public/office/processed-pixel/`. Azhar's paths are generated dedicated poses under the same directory; the manifest marks placeholders and their source poses.

## Temporary limitations

- The Azhar source sheet is visibly damaged and contains components labelled as Ali. The requested `azhar-sit.png`, `azhar-stand.png`, `azhar-walk.png`, `azhar-angry.png`, and `azhar-success.png` owner files are not present, so the generated dedicated poses use clearly marked Ali-pose placeholders.
- Khan's available sheet contains bust/torso poses rather than full-body poses. His sit and walk states use his neutral standing pose; the alert, success, and talk states use the closest matching Khan expressions.
- Ali and Hassan have no distinct angry or success pose in the reviewed sheets; those states use their stand pose.
