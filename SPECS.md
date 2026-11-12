# Luna Phase Agents — Specs (Gate 0)

Name LOCKED 2026-11-02 (user brief, this chat): Luna Phase Agents
Symbol LOCKED: LPHASE
Theme LOCKED: moon phases, on-chain SVG traits, 8 phases. NEW theme — do NOT
copy Kitsuneon / LunaPhase name or art, and do NOT use foxes (user already
has Neon Fox Agents). This is a separate project from NFOX, SEVEN SIGMA and
Agent Key Pass. Workspace: ~/workspace/luna-phase-agents/ — do not touch
those other workspaces.

Model: the 7,777 family from the paid-mint analysis
(~/workspace/analysis-paid-mints.md, 2026-11-02 ~15:19 GMT): Kitsuneon
0x2b5c0d44878279501aa111e353a2b493e0823b57 (392/777 paid at $0.035),
LunaPhase 0xf8da629842523878ad9d2cdc559ade37638bab5d (350/777 paid),
Pengwyn / Cloudpuff / Skullbloom / Koimatic (225–300/777 paid). Identical
constants in their verified source: MAX 7777, FREE 7000, FREE_PER_WALLET 3,
MAX_PER_WALLET 50, PRICE 0.00005 ether, royalty 500 bps, on-chain SVG art,
EOA-only mint. This project copies the *shape*, not their name, art or code.

## Locked by user 2026-11-02

- Total supply: 7,777
- Free supply: 7,000 (90%)
- Paid supply: 777 (10%)
- Mint model: SINGLE blended `mint(qty)` — first 3 per wallet FREE, every
  extra mint in the SAME transaction paid. No separate paid phase, no
  `freeMint()` function. Paid mints happen DURING the free hype, while
  minters are already on the site — this is the #1 driver in the analysis
  (NFOX/SIGMA two-phase model stalled at 4.6% / 2.6% paid sold).
- Free per wallet: 3 ever. Max per wallet: 50 total. Max per tx: 50
  (a single tx may not exceed the 50/wallet cap either).
- Paid price LOCKED: $0.035, coded as 0.00005 BNB
  - Price math (BNB ~$700, per user brief): $0.035 / $700 = 0.00005 BNB
    exactly.
  - Examples: mint(3) = 3 free = 0 BNB; mint(5) = 3 free + 2 paid =
    0.00010 BNB; mint(50) fresh wallet = 3 free + 47 paid = 0.00235 BNB.
  - Max paid revenue: 777 x $0.035 = $27.20 gross (777 x 0.00005 =
    0.03885 BNB). Gross is small by design — the free base (7,000) is
    the distribution engine, as in the 7,777 family ($7.88–$13.72 gross
    actually realised by the originals).
- Agent ID gate: REQUIRED for ALL mints, free and paid.
  Registry balanceOf(wallet) > 0, real registry
  0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F. No wallet without an Agent ID
  can mint, free or paid. (Opposite of SEVEN SIGMA / Agent Key Pass,
  where paid is open to all — here paid is Agent-only, as in the
  original 7,777 family.)
- EOA-only mint: `msg.sender == tx.origin` required — no contract/bot
  wallets can mint, as in the original family.
- Royalties: 5% ERC-2981 to owner, same as NFOX / SEVEN SIGMA / AKEY.
  Note: not guaranteed — some marketplaces ignore ERC-2981
  (Element displayed 0% for NFOX).
- Transferable: ERC-721, NOT soulbound.
- Art model LOCKED: ON-CHAIN SVG, 8 moon phases, trait sets per phase —
  NOT one shared image. Token ID determines phase: phase = (tokenId-1) % 8,
  so each phase appears ~972 times across 7,777 tokens.
  Phases: 0 New Moon (0% lit), 1 Waxing Crescent (25%), 2 First Quarter
  (50%), 3 Waxing Gibbous (75%), 4 Full Moon (100%), 5 Waning Gibbous
  (75%), 6 Last Quarter (50%), 7 Waning Crescent (25%).
  `tokenURI(tokenId)` returns a data: URI (base64 JSON, image is a
  base64 SVG data URI) generated entirely on-chain. No IPFS image, no
  metadata files to host, no baseURI to set — the art is immutable in
  the contract. This is a deliberate deviation from the NFOX/AKEY
  Gate 4 (IPFS + site-hosted JSON + setBaseURI): those steps do not
  apply here, because there is no off-chain metadata to prove.
  Per-token Origin trait (Free / Paid) is recorded on-chain at mint
  time, because in a blended mint the free/paid split is per mint,
  not per token-ID range.

## Owner powers (plain language)

- Owner: user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403 (neongred.ai).
- Owner CAN: withdraw all BNB, transfer/renounce ownership.
- Owner CANNOT: change supply (7,777), free supply (7,000), paid price
  (0.00005 BNB), free-per-wallet (3), max per wallet (50), or the Agent ID
  registry, and cannot mint extra tokens, pause, freeze, burn, or take
  holders' tokens. Owner also CANNOT change the art or metadata — there
  is NO setBaseURI in this contract (on-chain SVG is fixed at deploy).
  This is different from NFOX/SIGMA/AKEY, where the owner could change
  metadata via setBaseURI(). Here that power does not exist at all.
- Contract is NOT audited by a third party. Say so on the site.
  "Built on OpenZeppelin" is not an audit.
- Registry: real Binance Agent ID registry
  0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F.
  Testnet/local: deploy AgentIdRegistryMock first and pass its address.

## Intentional deviations from the NFOX playbook / skill

Recorded here so a later reader does not "fix" them back:
1. NO `freeMint()` — single blended `mint(qty)` only (user-locked).
   The skill line "use the standard names freeMint and mint" does NOT
   apply; the 7,777 family uses `mint(qty)` alone and radars read it.
2. NO separate paid phase — `paidOpen()` is true from deploy while
   paid supply remains. `freeOpen()` is true while free supply remains.
   Both are open from the start.
3. Paid mint DOES check the Agent ID registry (M1 gate applies here,
   unlike AKEY/SIGMA). Non-agent mint(qty) must revert "no Agent ID"
   whether the qty would be free, paid, or mixed.
4. NO setBaseURI, NO IPFS, NO metadata files. tokenURI is on-chain.
   Playbook M4/M5 (placeholder grep, extensionless .json copies) do not
   apply — there are no metadata files. The equivalent Gate 3 proof is:
   tokenURI(1..8) decodes to valid JSON with the correct phase name,
   illumination and a valid SVG image, for all 8 phases.
5. EOA-only check (`msg.sender == tx.origin`) — new vs NFOX/AKEY.
   Tested with a test-only caller contract.
6. Free-supply exhaustion (7,000) is NOT executed locally — it would
   need ~2,334 wallets minting 3 each. Paid-supply exhaustion (777)
   IS executed locally (~17 wallets x 50). The free-cap code path
   (`freeQty = min(qty, freeLeftWallet, freeRemaining)`) is the same
   min() logic proven by the paid-exhaustion test and by the quote
   function tests. This limitation is stated, not hidden.

## Facts carried forward (do not re-learn)

- Radars find verified contracts in minutes; mints can start before
  any announcement. Supply size does not change deploy cost — deploy
  cost is code size; minters pay their own mint gas.
- GitHub and Vercel are optional only, not required for launch.
- baw cannot deploy a contract directly; testnet/mainnet deploy uses
  a fresh throwaway deployer, owner = user wallet.
- Never promise floor price, returns, APY, a dated token/airdrop,
  a game, or merch. No token is promised.
- Hosting: NOT locked yet for this project. Site package is built
  for drag-and-drop (Netlify or Cloudflare — user to choose at
  deploy time). Site files are small because metadata is on-chain:
  no 7,777 metadata files to host.

## Gate 0 — COMPLETE 2026-11-02 (specs locked, in this file)

## Gate 1 — COMPLETE 2026-11-02 (local only, no deploy, no BNB spent)

- Contract: `~/workspace/luna-phase-agents/contracts/LunaPhaseAgents.sol`
  (copied from the NFOX template pattern, rewritten for the blended
  model; mock: `contracts/AgentIdRegistryMock.sol`, local/testnet only;
  test helper: `contracts/EoaTestCaller.sol`, local tests only).
- Stack: Solidity ^0.8.26, OpenZeppelin v5.6.1, Cancun, optimizer 200.
  solc pinned to exactly 0.8.26.
- Constants: MAX_SUPPLY 7777, FREE_SUPPLY 7000, PAID_SUPPLY 777,
  PAID_PRICE 0.00005 ether, FREE_PER_WALLET 3, MAX_PER_WALLET 50,
  MAX_PER_TX 50, royalties 5% (500 bps).
- Compile: `npm run compile` — clean. LunaPhaseAgents bytecode 12,218
  bytes, ABI 65 entries. (Larger than NFOX 1.85M gas deploy because of
  the on-chain SVG + Base64 code.)
- Local tests: `npm run test:local` (Anvil, port 8547) — **55/55 passed**,
  first full run after one test-assertion fix, `allPassed: true`,
  results in `test-results.json`. The one FAIL on the first run
  ("withdraw empty reverts") was a TEST bug (ethers shortMessage is
  generic); re-proven via staticCall with the full revert reason
  "nothing to withdraw" — contract was correct, same M9 lesson as NFOX.
- Tests prove: constants/views, phase cycle 1..9, quoteMint (3 free /
  5 = 3+2 / 1 = 1+0), non-agent mint reverts "no Agent ID" (free AND
  paid), contract-caller mint reverts (EOA-only, caller marked as Agent
  ID in the mock), agent mint(3) free, blended mint(5) = 3 free + 2
  paid (tokenPaid #4-6 false, #7-8 true), wrong price / overpay revert,
  qty 0 / 51 revert, max 50/wallet (mint 46 past cap reverts, mint 45
  reaches exactly 50, next mint reverts), royaltyInfo 5% to owner,
  paid-supply exhaustion 777 (16 wallets, totalSupply 831, paidOpen
  false, freeOpen still true), fresh wallet mint(3) free still works
  after paid exhaustion while a paid mint reverts "paid supply
  exhausted", tokenURI #1-8 cover all 8 phases, contract holds exactly
  0.03885 BNB (777 x 0.00005) before withdraw, owner withdraw empties
  it (raw eth_getBalance, M9 lesson), non-owner withdraw reverts.
- Gas (local Anvil): deploy 2,622,738; free mint x3 215,971; blended
  mint x5 317,875; mint x45 2,285,660; withdraw 32,159. Mainnet estimate
  at 0.05 gwei / BNB $700: deploy ~0.000131 BNB (~$0.09), creator launch
  total = deploy only (~$0.09 — NO setBaseURI tx exists).
- NOT done in Gate 1: testnet deploy + live tests, verification, site,
  mainnet deploy, launch.

## Gate 2 — COMPLETE 2026-11-02 (scans; see scans/SUMMARY.md)

- Slither 0.11.6 (solc 0.8.26 binary): 77 results, 26 contracts
  analysed. Bulk are OpenZeppelin v5.6.1 library internals. Luna
  findings all informational: encodePacked-collision in _json (never
  hashed — string concat for base64 metadata), reentrancy-no-eth /
  benign in mint() (state written before _safeMint, nonReentrant),
  reentrancy-events in withdraw() (onlyOwner, balance read first),
  low-level-calls in withdraw() (checked call), costly-loop in mint()
  (max 50, gas measured), pragma/solc-version (build pins 0.8.26).
  Full output: `scans/slither-2026-11-02.txt`.
- Aderyn 0.6.8: 3 high, 8 low. Highs: abi.encodePacked hash collision
  (FALSE POSITIVE — never hashed), eth-send-unchecked-address in
  EoaTestCaller (test-only helper, never deployed), reentrancy-state-
  change in mint() (FALSE POSITIVE — same as SIGMA/AKEY: state before
  _safeMint, nonReentrant). Lows all known/intentional: centralization
  risk (documented owner powers; NO setBaseURI exists), costly-loop,
  literal-instead-of-constant (phase/SVG strings), PUSH0 (BSC Cancun),
  require-in-loop (atomic mint), state-change-without-event (mock
  only), unspecific pragma (pinned 0.8.26), public view functions
  (the site/radar API). Full analysis: `scans/SUMMARY.md`, raw Aderyn
  JSON `scans/aderyn-2026-11-02.json` (+ `.log`).
- Verdict: no new issues vs NFOX / SEVEN SIGMA / Agent Key Pass. No real
  vulnerability.

## Gate 3 — COMPLETE 2026-11-02 (on-chain SVG art + tokenURI proof)

- Art model: ON-CHAIN SVG, 8 phases, phase = (tokenId-1) % 8. No IPFS,
  no metadata files, no baseURI, no setBaseURI — the art is immutable
  in the contract. Proof script: `scripts/verify-tokenuri.mjs`
  (deploys on local Anvil, mints #1-8 in one tx: 3 free + 5 paid).
- All 8 phases extracted to `art/phase-<n>-<slug>.svg` and
  `art/tokenuri-<n>.json`, summary in `art/tokenuri-summary.json`:
  #1 New Moon 0% Free, #2 Waxing Crescent 25% Free, #3 First Quarter
  50% Free, #4 Waxing Gibbous 75% Paid, #5 Full Moon 100% Paid,
  #6 Waning Gibbous 75% Paid, #7 Last Quarter 50% Paid,
  #8 Waning Crescent 25% Paid. All 8 SVGs have DISTINCT sha256
  (8/8 distinct); shadow-circle cx per phase: 200, 158, 90, 55,
  -1000 (Full Moon, no shadow), 345, 310, 242 — each phase is a
  visibly different moon. Full Moon SVG inspected directly and renders
  correctly (dark sky, 4 stars, lit disc, "Full Moon", "100% lit").
- tokenURI is a data:application/json;base64 URI; image is a
  data:image/svg+xml;base64 URI inside it. Both decode cleanly.
  Playbook M4/M5 (placeholder grep, extensionless .json) do NOT apply
  — there are no metadata files. The equivalent proof is this Gate 3
  extraction, plus the local-test tokenURI checks (55/55).
- Quirk noted: the verify script's node process did not exit on its
  own after writing the files (ethers provider keep-alive); the Anvil
  child was killed and the files were already written. The script's
  output is the files, not its exit code.

## Gate 4 — COMPLETE 2026-11-02 (site built + locally verified, NOT live)

- Site built in `site/` (index.html 17,410 B, llms.txt 3,519 B) and
  staged in `site-deploy/` (same 2 files). Package:
  `site-deploy-v1-2026-11-02-luna-phase-agents.zip` (8,630 B, 2 entries,
  testzip clean). Only 2 files total — no metadata files to host,
  because the art is on-chain.
- Pre-deploy honest state throughout: banner says NOT DEPLOYED YET,
  no contract address anywhere (none exists), no marketplace links,
  no X handle (none exists for LPHASE). Checker reads the REAL mainnet
  registry (0x60B92624…) via public BSC RPC — Agent ID yes/no works
  today; contract-dependent fields say "not deployed yet". Agent
  prompt says do NOT mint until the contract is deployed + verified,
  and explains the blended mint (quoteMint first, exact cost, first 3
  free, max 50). Browser mint is collapsed and disabled until deploy.
- Design: dark moon theme (#0a0e1a, one pale-moon accent #d8d2b8),
  inline Full Moon SVG hero (no image file needed), mobile-first,
  viewport meta, box-sizing, max-width cards. No traits/gallery/team/
  roadmap dates/fake countdown/placeholder URLs. Roadmap is
  stages-not-dates. Not-audited statement and owner powers in plain
  language — including that the owner CANNOT change the art (no
  setBaseURI). Technical details in a collapsed footer (price math,
  gas, scans, 7,777-family model, hosting not chosen yet).
- Greps on the built package: `verification pending` / NFOX / SIGMA /
  stale contract addresses / REPLACE / TODO = **0**. The remaining
  hits were reviewed, not failures: "testnet" x2 = the roadmap stage
  and the banner saying testnet comes before mainnet; "Neon" x2 =
  "Kitsuneon" (the analysis reference, correctly named as a different
  project) and "neongred.ai" (the user's Agent ID); "placeholder" x1
  = the HTML input placeholder attribute. Inline JS parses
  (`node --check` OK).
- Local verification (python http.server over site-deploy/):
  homepage **200** (17,410 B), `/index.html` **200**,
  `/llms.txt` **200** (3,519 B). `/metadata/1` **404 BY DESIGN** —
  there is no hosted metadata; tokenURI is on-chain.
- NOT live, and NO Netlify/Cloudflare site has been created yet.
  Hosting is NOT locked for this project (user to choose at deploy
  time). Once live, the site URL is NOT needed for baseURI (on-chain
  art — there is no setBaseURI to call).
- NOT done (later gates): testnet deploy + live free AND paid tests,
  Sourcify + BscScan verification, mainnet deploy, launch.

## Gate 5 — TESTNET COMPLETE 2026-11-02 ~16:14 GMT (Sourcify + BscScan testnet verified)

- Faucet claim landed 0.026 tBNB on deployer
  0x80422feF2eC4b85f3D6A66a5f279E9901D5A91b9 (verified 0x0 on two
  RPCs before, 0.026 after; MIN_BALANCE 0.01 met). Deployer left
  0.0196758343 tBNB after the run.
- Deploy script `scripts/deploy-testnet.js` (blended mint live
  tests, NO freeMint, NO setBaseURI; paid supply NOT exhausted live
  — proven locally instead). One harness regex miss FIXED in the
  script after the run (withdraw revert matched on selector
  0x118cdaa7, not the error name).
- TESTNET contract **0x92788043466352c8b878601702DA549579657bd2**
  (TESTNET ONLY, superseded — never point minters at it), deploy tx
  0xd294890a55c2f36d37c3cf26a717f809e2fde331a306e6570d2b68418168cac6,
  gas 2,622,738 (exactly the local figure). Mock registry
  0xef8E60dA7b5267a7df0116C4Eb9697ce9fCFA709, deploy tx
  0xb5cd29683a964b4b9b6e071ad86fba5fc92ede31f770c501a57304d4b65984b5,
  gas 308,419. EoaTestCaller
  0x8312674c612C58cE384F932e726715828775279E. Owner = user wallet.
- Live tests **21/21 passed** (20/21 as recorded + 1 correction):
  free mint(3) #1-3 (tx 0xf0e95b59f404bcf48aec711b8d998969e876a7bd5548986ee3562d28d2777ec7,
  gas 215,971); blended mint(5) = 3 free + 2 paid (tx
  0x52ce227b2cbd2e221339966f9d47bf2c416c49485edd2aaadeefe2121bde9b0e,
  gas 317,875); max 50/wallet reached via mint(45) (tx
  0x048dc20351e31844fd88d73c064940532f0e6629082a63093d7ec3e86f2f78c7,
  gas 2,285,660); non-agent / contract-caller (EOA-only) /
  wrong-price / qty-51 / over-cap reverts all proven; quoteMint
  (0 free, 1 paid, 0.00005) on-chain; tokenURI #1 New Moon 0% Free /
  #5 Full Moon 100% Free / #8 Waning Crescent 25% Paid decoded live;
  royaltyInfo 5% to owner; contract held exactly 0.00235 tBNB
  (47 paid x 0.00005); non-owner withdraw reverts
  OwnableUnauthorizedAccount — proven by staticCall, data
  0x118cdaa7 + deployer address (same correction as AKEY).
  Final reads (verified on TWO testnet RPCs): totalSupply 53,
  freeMintedCount 6, paidMinted 47, freeRemaining 6,994,
  paidRemaining 730, freeOpen + paidOpen true.
  Records: deployment-testnet.json, testnet-live-tests.json (with
  corrections section), test-wallets-testnet.json (chmod 600).
- VERIFICATION: Sourcify **exact_match** (creation + runtime),
  matchId 58098145, verified 2026-11-02T16:08:02Z; standard JSON in
  verification/standard-json.json. BscScan testnet **VERIFIED**
  2026-11-02 ~16:14 GMT via the manual form (first submission,
  no correction needed): "Successfully generated matching Bytecode
  and ABI", contract page shows Source Code Verified + Exact Match,
  ContractName LunaPhaseAgents, v0.8.26, 200 runs, cancun, MIT,
  decoded constructor args (mock registry + owner). The BscScan API
  key is REJECTED for chain 97 ("Invalid API Key #err2", 4 attempts
  via the surrogate script — credential still works for chain 56,
  verified on AHLAND) and Sourcify forwarding hit the daily
  500-submission limit again, so NO forwarded guid exists; the
  manual form was the prescribed fallback and its live page read is
  the evidence (browser task completed 16:09–16:14 GMT). Record:
  verification/bscscan-result.json (verified: true).
- Site package **v2 site-deploy-v2-2026-11-02-testnet-verified.zip**
  (index.html + llms.txt only, zip clean): banner + prompt + footer
  now say TESTNET deployed/Sourcify-verified, MAINNET NOT deployed;
  testnet contract labelled TESTNET ONLY with BscScan testnet link
  and live-test facts. Local HTTP: homepage 200 (19,390 B),
  llms.txt 200 (4,093 B), /metadata/1 404 by design.
- Still pending: BscScan testnet manual-form result; mainnet deploy
  + verification (needs explicit user approval in THIS chat).
## Gate 6 — MAINNET DEPLOYED + VERIFIED 2026-11-02 ~16:17–16:19 GMT

- User approved: "Proceed with mainnet" 2026-11-02 16:12 GMT.
  Pre-deploy recheck: recompile byte-identical to the tested build
  (keccak 0x6944ff8c9a6a42c871a2fd930000759099355650be448f43104f1e2cf7e3a862).
- MAINNET contract **0x5c04392641c81F1b69826E13d8f3F78c58464970**,
  deploy tx 0xacb62e088a9c3cb6449bb80f7f82565eec13224c0b5109ca1fbbff879f82c9ad,
  gas 2,622,738, block 131271359. Owner = user wallet, registry =
  real 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F. Deployer
  0x5964b5c48051007Ce4aB5DB3839AA7A55666b209 funded 0.001 BNB by the
  user; deploy cost ~0.000131 BNB; leftover 0.0008678131 BNB
  RETURNED to the user wallet (tx
  0x5daed63051d045065d406faea8db691988064271a29c0e14f752e297fd097faa,
  block 131271628; deployer now 0.0; user wallet 0.006095676459752172
  BNB after). Script: scripts/deploy-mainnet.js (reads-only checks,
  no mints, no setBaseURI step). Return script:
  scripts/return-leftover-mainnet.mjs; record
  leftover-return-mainnet.json.
- VERIFICATION: Sourcify **exact_match** (creation + runtime),
  matchId 58099193, verified 2026-11-02T16:18:45Z. BscScan
  **VERIFIED** via Sourcify forwarding (checkverifystatus
  "Pass - Verified", guid
  ilvwfes7szp5e8ctt1f3ewym7a9yeehzgziq5yqs24tyvgbayj; getsourcecode
  chain 56 returns ContractName LunaPhaseAgents, v0.8.26, 200 runs,
  cancun, constructor args = real registry + owner). Records:
  verification/sourcify-result-mainnet.json,
  verification/bscscan-result-mainnet.json,
  verification/standard-json-mainnet.json. (Note: the mainnet
  verify script first overwrote verification/sourcify-result.json
  with the mainnet result; the testnet record was restored from
  the Sourcify API and the script's write path fixed to
  sourcify-result-mainnet.json.)
- POST-DEPLOY CHECKS: 9/12 passed as recorded. The 3 "fails"
  (totalSupply 1, freeMintedCount 1, freeRemaining 6999) were a
  REAL free mint of token #1 landing seconds after deploy, before
  the reads ran — not a contract defect (recorded in
  deployment-mainnet.json corrections).
- LAUNCH MOMENTUM (live on-chain reads): token #1 owner
  0x2648157127A212cE73d9E6AF9D57A169680164C9 (Agent ID 1,
  freeClaimed 1, minted 1, holds 1 — a legit Agent ID holder).
  First-mint tx 0x2b17f067f2acfd77757a7e344e9ec571092f959f6b8262ed6f6d15100b911990,
  block 131271366 (7 blocks after deploy), 2026-11-02T16:16:34Z,
  mint(1), value 0 BNB, fee 0.000014691789654215 BNB, Success —
  confirmed on the BscScan token + tx pages AND by raw RPC
  (input selector 0xa0712d68, chainId 56). Holders snapshot
  ~16:20 GMT: 39 supply, 17 holders, 39 transfers (rising every
  few seconds). totalSupply 45 by ~16:23 GMT, **60 by ~16:33 GMT**,
  ALL free, 0 paid, contract balance 0 BNB. Free mints are being
  claimed fast with no announcement yet — the contract was verified
  within ~2 minutes of deploy, and hunters/radars found it.
  Public RPCs refuse eth_getLogs ("missing response"), so a full
  per-wallet holder breakdown is still pending a BscScan read.
- SITE v4 **site-deploy-v4-2026-11-02-mainnet-live.zip** (index +
  llms only, zip clean, homepage 200 21,501 B, llms 200 4,363 B,
  inline JS parses, 0 stale "NOT DEPLOYED" strings): banner LIVE
  ON MAINNET with contract + counts 45/7,777 as of ~16:23 GMT,
  roadmap Stage 3 done, agent prompt + llms.txt updated to the
  live contract, checker now reads the LIVE contract
  (freeClaimed/mintedCount/balanceOf — proven live: user wallet
  Agent ID 1, 0 used, 0 held; first minter 1/1/1). Browser mint
  still NOT wired in (honest text: use the agent prompt or
  BscScan) — possible follow-up.
- Still pending: holder breakdown; hosting = **Cloudflare Pages**
  (user chose 2026-11-02 ~16:28 GMT, "Cloud fare"); site v6
  **site-deploy-v6-2026-11-02-polished.zip** (counts 177/7,777
  as of ~16:38 GMT, homepage 200, llms 200) — polished 2026-11-02
  ~16:38 GMT on user's "make the site look a bit worked on and
  professional, remove any technical details that is not necessary":
  technical-details block, testnet lines, browser-mint card and
  scan/gas/tx jargon removed from the visible page; added phases
  strip, minted progress bar, cleaner roadmap + honest notes;
  agent mint prompt (JS) kept as-is — it is agent-facing, not
  visitor copy. Artifact preview edit building (same polish).
  **SITE LIVE 2026-11-02 ~17:37 GMT: https://luna-phase-agents.pages.dev/**
  (verified 200, homepage + llms.txt 200, contract on page; GitHub
  repo Ernestopapa/luna-phase-agents, files uploaded ~17:04 GMT).
  LATEST COUNTS ~17:38 GMT: 337/7,777 (337 free, 0 paid, 6,663 free
  left, 777 paid left, contract 0 BNB). Launch post not sent yet
  (X Post Drafts, user posts manually).
