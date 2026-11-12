# Gate 2 — Static scans, 2026-11-02

Tools (reused from SEVEN SIGMA / Agent Key Pass, not newly installed):
- Slither 0.11.6 (venv `~/.venvs/slither`), solc binary 0.8.26+commit.8a97fa7a (`~/.local/bin/solc`)
- Aderyn 0.6.8 (`~/.local/bin/aderyn`)
- Raw outputs: `scans/slither-2026-11-02.txt`, `scans/aderyn-2026-11-02.json` (+ `.log`)

## Slither 0.11.6 — 77 results total, 26 contracts analysed

Command: `slither contracts/LunaPhaseAgents.sol --solc ~/.local/bin/solc --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/"`
(Slither exits 255 when findings exist — same as the SIGMA/AKEY runs;
the output file is the evidence, not the exit code.)

- The bulk are inside `node_modules/@openzeppelin/` (Math.mulDiv,
  Base64, Bytes, Strings, StorageSlot, Context, ERC2981, ERC721
  internals): incorrect-exp, divide-before-multiply, assembly,
  dead-code, too-many-digits, solc-version (broad OZ pragma ranges).
  Known, audited OpenZeppelin v5.6.1 library internals, identical to
  the NFOX, SIGMA and AKEY builds. No action.
- Findings touching `contracts/LunaPhaseAgents.sol` itself — all
  informational, none a real vulnerability:

| Detector | Location | Verdict |
|---|---|---|
| encode-packed-collision | `_json()` — `abi.encodePacked(p1,p2)` | Informational. The packed bytes are NEVER hashed — they are concatenated into a JSON string and base64-encoded as the tokenURI. No keccak256 anywhere in the contract. The two parts are built by the contract itself, not user input. No collision can change funds or metadata. |
| reentrancy-no-eth | `mint()` — `_nextId++` in the loop | Mitigated. All accounting (`freeClaimed`, `_freeCount`, `paidMinted`, `mintedCount`) is written BEFORE the loop; per iteration `_nextId++` and `tokenPaid[tokenId]` are assigned BEFORE that iteration's `_safeMint`; `mint()` is `nonReentrant`. The only thing after a `_safeMint` is the `Minted` event. |
| reentrancy-benign | `mint()` — `tokenPaid[tokenId]` | Same as above: written before that iteration's `_safeMint`, under `nonReentrant`. |
| reentrancy-events | `withdraw()` — event after the low-level call | Informational. `withdraw()` is `onlyOwner`; balance is read into `amount` BEFORE the call, so a re-entrant `withdraw` during the callback sees balance 0 and reverts on "nothing to withdraw". No double-spend. |
| low-level-calls | `withdraw()` — `owner().call{value: amount}()` | Known pattern, same as NFOX/SIGMA/AKEY. Return value checked (`require(ok)`). |
| costly-loop | `mint()` — `_nextId++` (SSTORE) inside loop | Intentional, max 50 iterations. Measured local gas: mint x5 = 317,875; mint x45 = 2,285,660 (~$0.08 at 0.05 gwei / $700 BNB, paid by the minter). |
| pragma / solc-version | `^0.8.26` in LunaPhaseAgents; OZ files use `^0.8.20` etc. | Not applicable to the deployed bytecode: the build pins solc to exactly 0.8.26. |

## Aderyn 0.6.8 — 3 high, 8 low

Caveat: Aderyn compiled with its own bundled solc v0.8.33 / EVM Prague,
not the project's pinned solc 0.8.26 / Cancun. Findings are pattern-based
and still valid for review.

### High (3)

1. `abi-encode-packed-hash-collision` (9 instances, `_svg`/`_json`) —
   FALSE POSITIVE in context. Same reason as Slither above: the packed
   output is never passed to a hash function. It is string concatenation
   for SVG/JSON metadata, then base64-encoded. No hash, no collision
   risk. No fix needed.
2. `eth-send-unchecked-address` in `EoaTestCaller.sol` line 10 —
   NOT IN THE LAUNCH CONTRACT. EoaTestCaller is a local-test-only
   helper (never deployed on testnet/mainnet, never pointed at by
   minters); forwarding a call to a test-supplied target is its entire
   purpose.
3. `reentrancy-state-change` in `mint()` (line 169) — FALSE POSITIVE,
   same as the SIGMA/AKEY high. The flagged state writes
   (`freeClaimed`, `_freeCount`, `paidMinted`, `mintedCount`,
   `_nextId++`, `tokenPaid`) are ALL BEFORE the `_safeMint` in their
   iteration (checks-effects-interactions) and `mint()` is
   `nonReentrant`. The only thing after the external call is the
   `Minted` event emit. No re-entrancy path exists. No fix needed.

### Low (8) — all known / intentional

- `centralization-risk`: documented owner powers (constructor royalty,
  `withdraw`); mock `setAgent`/`setAgents` is testnet-only. Luna has
  NO setBaseURI, so the owner cannot change art/metadata at all.
- `costly-loop` (`mint()`; mock `setAgents`): intentional, max 50
  (see gas above).
- `literal-instead-of-constant` (phase names, SVG literals): intentional
  — these are display strings, not numeric constants.
- `PUSH0` (all three contracts): BSC supports Cancun.
- `require-revert-in-loop` (`mint()`): the mint is atomic by design;
  a revert in any iteration reverts the whole tx. No partial mint.
- `state-change-without-event` (mock only, testnet-only).
- `unspecific-pragma` (`^0.8.26`, compiler pinned to exactly 0.8.26).
- `unused-public-function` (view functions): these ARE the public API
  the site and radars read (`totalSupply`, `freeRemaining`, `phaseOf`,
  `quoteMint`, …).

## Verdict

No new issues vs NFOX / SEVEN SIGMA / Agent Key Pass. No real
vulnerability found. The two Aderyn highs in the launch contract are
documented false positives (encodePacked is never hashed; reentrancy
state is written before the external call under nonReentrant), and
the third high is in a test-only helper that is never deployed.
Gate 2 passes.
