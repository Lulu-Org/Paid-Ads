# Reference material

| File | What it is | How to use it |
| --- | --- | --- |
| `Lulu_Global_Paid_Advertising_Master_Catalog_EN.pdf` | David's functional catalog (Oct 29, 2026): 360 proposed functions in 60 modules, 10 cross-module workflows and 60 acceptance scenarios, for Google, Meta, LinkedIn, TikTok, Microsoft, Pinterest, Snapchat, Amazon and other networks. | **Guidance, not the task list.** The catalog itself says these are proposed requirements. Our bundle's scope is `docs/plan.md` and `tasks.md` (Google LSA, Google Ads, Meta, LinkedIn and the 15 design views) until David confirms otherwise. Use it to check that what we build follows its rules. |

Rules from the catalog we already follow, and every task should keep:

- **Separate states:** planned, approved, submitted, accepted, delivering and paused are different facts. A successful request does not prove delivery; an accepted pause does not prove spend stopped (catalog sections 02, 42, 50).
- **Spending authority:** budget changes above the approval threshold need an approval; several small increases must not add up past a limit (08, 44, 45).
- **No duplicates on retry:** a timed-out or failed request is reconciled before it is sent again, so a campaign is never created twice (41, 56).
- **Stale data stops automation:** rules and AI do not scale spend on old or incomplete numbers (09, 45).
- **Honest gaps:** an operation a platform's API does not support is shown as manual or blocked, never faked (03, 40).
- **Platform numbers are not profit:** platform-attributed conversions stay separate from deduplicated business outcomes (28, 49).
