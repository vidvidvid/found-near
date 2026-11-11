# Outreach drafts — owner sends, nothing sent

Recheck the account/pool evidence before contacting anyone. Drafts do not imply endorsement. Mention a judge's firm only as a factual validator source, never as a personalized appeal or a claim about a judge's own wallet. Wait until the repository is public before adding its link: https://github.com/vidvidvid/found-near.

## Verified source counts

Census block 223975859, 10 Nov 2026. IDs can include contracts and institutions; accounts can overlap between rows, and gross amounts can overlap protocol reserves. The year column is a limited analysed cohort, not the entire pool population.

| Team | Pool / contract | Census IDs | Gross NEAR | Named IDs matching at 12-month samples |
| --- | --- | ---: | ---: | ---: |
| LiNEAR | `linear-protocol.near` | 538 | 1,086,474.35 | 10 |
| Meta Pool | `meta-pool.near` | 435 | 219,698.21 | 40 |
| Rhea | `lst.rhealab.near` | 225 | 27,786.36 | 0 |
| Meteor | `meteor.poolv1.near` | 1,106 | 91,884.17 | 6 |
| AstroStakers | `astro-stakers.poolv1.near` | 6,132 | 773,477.87 | 67 |
| HERE | `here.poolv1.near` | 4,528 | 136,870.58 | 6 |
| Ledger by Figment | `ledgerbyfigment.poolv1.near` | 1,873 | 1,061,618.42 | 1 |
| Dragonfly | `dragonfly.poolv1.near` | 81 | 121,136.52 | 4 |
| Electric Capital | `electric.poolv1.near` | 82 | 6,131.86 | 1 |

### LiNEAR

Hi LiNEAR team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 538 account IDs with matured balances in linear-protocol.near; 10 named IDs in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### Meta Pool

Hi Meta Pool team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 435 account IDs with matured balances in meta-pool.near; 40 named IDs in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### Rhea

Hi Rhea team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 225 account IDs with matured balances in lst.rhealab.near (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### Meteor

Hi Meteor team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 1,106 account IDs with matured balances in meteor.poolv1.near; 6 named IDs in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### AstroStakers

Hi AstroStakers team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 6,132 account IDs with matured balances in astro-stakers.poolv1.near; 67 named IDs in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### HERE

Hi HERE team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 4,528 account IDs with matured balances in here.poolv1.near; 6 named IDs in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### Ledger by Figment

Hi Ledger by Figment team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 1,873 account IDs with matured balances in ledgerbyfigment.poolv1.near; 1 named ID in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### Dragonfly

Hi Dragonfly team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 81 account IDs with matured balances in dragonfly.poolv1.near; 4 named IDs in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### Electric Capital

Hi Electric Capital team—FOUND helps people find and finish unstaked NEAR withdrawals with their own wallet. The 10 November census lists 82 account IDs with matured balances in electric.poolv1.near; 1 named ID in the 100+ NEAR cohort had qualifying balances matching at every sampled date over a year (a dated snapshot, not proof of lost funds). Would you share the read-only checker with your delegators/users: https://foundyours.xyz/ ? The official protocol/wallet app is also a valid way to withdraw.

### FastNEAR

Hi FastNEAR team—FOUND uses your staking discovery and RPC to help NEAR users finish unfinished withdrawals. Our pinned census and sampled-history archive are independently checkable offline; 304 named IDs in the 100+ NEAR cohort had balances unchanged and withdrawable at every sampled date over two years, with the sampling limits disclosed. Would you review/share the checker with wallet builders: https://foundyours.xyz/ ?

## Private individual template

Optional local enrichment: `node scripts/prepare-outreach-profiles.mjs` reads the candidates’ self-published SocialDB profiles in batches of 25 and checks current code presence for at most 20 returned profiles, writing only to ignored `outreach/local/`. No profile is proof of identity. [SocialDB’s documented view](https://github.com/NearSocial/social-db#reading-data) accepts `get({keys:["account.near/profile/**"]})`; results were checked for account-keyed objects and string leaves.

Hi—I’m building FOUND, a small open-source withdrawal checker, and noticed a public staking record that may have an unfinished withdrawal. You can check your own account without connecting a wallet at https://foundyours.xyz/, or use the protocol’s official app directly. I will never ask for keys, a recovery phrase, a payment, or a screenshot of your wallet secrets.

Send privately after manually verifying the recipient/account association and current balance. Do not put an individual's name, account and amount into a public post. Public profile links are self-published hints, not verified identity. The local shortlist is excluded from Git. No unsolicited messages were sent.

## Local profile check completed

On 11 November 2026 at pinned block 224066247, 450 eligible named accounts were checked in SocialDB: 10 returned profiles and 7 contained a syntactically valid, self-published X handle. Three of the 10 profile accounts had deployed contract code. These are contact hints, not verified identities. Raw responses and all account-level results remain in ignored `outreach/local/`; no messages were sent.
