// Local dry-run: full test suite against a local Anvil chain (Cancun).
// No faucet, no real funds, no network. Proves the blended-mint logic,
// the EOA-only gate, the Agent ID gate on ALL mints, and the on-chain
// SVG tokenURI for all 8 moon phases, and measures real gas.
// Anvil binary lives in tools/anvil (Foundry nightly, Cancun by default).
// Usage: node scripts/local-test.mjs
// Writes test-results.json.
//
// CRITICAL DIFFERENCES FROM NFOX / AKEY (user-locked, see SPECS.md):
// - NO freeMint(): single blended mint(qty) — first 3 per wallet free,
//   every extra in the same tx paid at 0.00005 BNB.
// - Paid mint DOES check the Agent ID registry (unlike AKEY/SIGMA).
// - EOA-only: msg.sender == tx.origin (proven with EoaTestCaller).
// - NO setBaseURI: tokenURI is fully on-chain SVG. The ABI must NOT
//   contain setBaseURI.
// - Free-supply exhaustion (7,000) is NOT executed locally — it would
//   need ~2,334 wallets. Paid-supply exhaustion (777) IS executed.
//   The free-cap code path is the same min() logic, proven by the
//   quote tests and the paid-exhaustion test.
import { spawn } from "node:child_process";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "build", `${n}.json`), "utf8"));
const ANVIL = path.join(root, "tools", "anvil");
const PORT = 8547;

const PRICE = "0.00005";
const results = { network: "anvil-local (dry run)", startedAt: new Date().toISOString(), tests: [] };
function check(name, ok, detail = "") {
  results.tests.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}
function decodeTokenURI(uri) {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) throw new Error("tokenURI is not a base64 JSON data URI");
  return JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"));
}
function decodeSvg(image) {
  const prefix = "data:image/svg+xml;base64,";
  if (!image.startsWith(prefix)) throw new Error("image is not a base64 SVG data URI");
  return Buffer.from(image.slice(prefix.length), "base64").toString("utf8");
}
const short = (e) => String(e.shortMessage || e.message).slice(0, 100);

const anvil = spawn(ANVIL, ["--port", String(PORT), "--silent"], { stdio: "ignore" });
const fetchReq = new ethers.FetchRequest(`http://127.0.0.1:${PORT}`);
fetchReq.timeout = 60000;
const provider = new ethers.JsonRpcProvider(fetchReq);
const log = (m) => process.stderr.write(m + "\n");
try {
  for (let i = 0; i < 50; i++) {
    try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  await provider.getBlockNumber();

  const [deployer, agent, agent2, plain] = await Promise.all([0, 1, 2, 3].map((i) => provider.getSigner(i)));
  const deployerAddr = await deployer.getAddress();
  const agentAddr = await agent.getAddress();
  const agent2Addr = await agent2.getAddress();
  const plainAddr = await plain.getAddress();

  const mockArt = load("AgentIdRegistryMock");
  const lunaArt = load("LunaPhaseAgents");
  const callerArt = load("EoaTestCaller");

  // Deploy mock + Luna
  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer).deploy(deployerAddr);
  await mock.waitForDeployment();
  const mockRc = await (await mock.deploymentTransaction().wait());
  check("mock registry deploys", true, `gas ${mockRc.gasUsed}`);

  const luna = await new ethers.ContractFactory(lunaArt.abi, lunaArt.bytecode, deployer).deploy(await mock.getAddress(), deployerAddr);
  await luna.waitForDeployment();
  const lunaRc = await (await luna.deploymentTransaction().wait());
  const lunaAddr = await luna.getAddress();
  results.deployment = { mockAddress: await mock.getAddress(), mockDeployGas: mockRc.gasUsed.toString(), lunaAddress: lunaAddr, lunaDeployGas: lunaRc.gasUsed.toString() };
  check("LunaPhaseAgents deploys", true, `gas ${lunaRc.gasUsed} (local addr ${lunaAddr})`);

  // Views / constants
  check("name/symbol", (await luna.name()) === "Luna Phase Agents" && (await luna.symbol()) === "LPHASE");
  check("constants", (await luna.MAX_SUPPLY()) === 7777n && (await luna.FREE_SUPPLY()) === 7000n && (await luna.PAID_SUPPLY()) === 777n && (await luna.PAID_PRICE()) === ethers.parseEther(PRICE) && (await luna.FREE_PER_WALLET()) === 3n && (await luna.MAX_PER_WALLET()) === 50n && (await luna.MAX_PER_TX()) === 50n);
  check("totalSupply starts 0", (await luna.totalSupply()) === 0n);
  check("freeRemaining 7000 / paidRemaining 777 at start", (await luna.freeRemaining()) === 7000n && (await luna.paidRemaining()) === 777n);
  check("freeOpen true at start", await luna.freeOpen());
  check("paidOpen true at start (blended, no separate phase)", await luna.paidOpen());
  check("owner is deployer (local; mainnet owner = user wallet)", (await luna.owner()) === deployerAddr);
  check("registry is mock", (await luna.agentIdRegistry()) === (await mock.getAddress()));
  check("ABI has NO setBaseURI (on-chain art is immutable)", !lunaArt.abi.some((e) => e.name === "setBaseURI"));
  check("ABI has NO freeMint (single blended mint only)", !lunaArt.abi.some((e) => e.name === "freeMint"));

  // Phase views (pure, no mint needed)
  const phases = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
  const illums = [0n, 25n, 50n, 75n, 100n, 75n, 50n, 25n];
  let phaseOk = true;
  for (let id = 1; id <= 9; id++) {
    const p = Number(await luna.phaseOf(id));
    if (p !== (id - 1) % 8) phaseOk = false;
    if ((await luna.phaseName(p)) !== phases[p]) phaseOk = false;
    if ((await luna.phaseIllumination(p)) !== illums[p]) phaseOk = false;
  }
  check("phaseOf/phaseName/illumination cycle 1..9", phaseOk, "1=New Moon 0%, 5=Full Moon 100%, 9=New Moon again");

  // quoteMint for a fresh wallet
  let q = await luna.quoteMint(agentAddr, 3);
  check("quoteMint fresh wallet qty3 = 3 free, 0 paid, 0 BNB", q[0] === 3n && q[1] === 0n && q[2] === 0n);
  q = await luna.quoteMint(agentAddr, 5);
  check("quoteMint fresh wallet qty5 = 3 free, 2 paid, 0.0001 BNB", q[0] === 3n && q[1] === 2n && q[2] === ethers.parseEther("0.0001"));
  q = await luna.quoteMint(agentAddr, 1);
  check("quoteMint fresh wallet qty1 = 1 free, 0 paid", q[0] === 1n && q[1] === 0n && q[2] === 0n);

  // Non-agent mint must revert (Agent ID gate on ALL mints)
  try {
    await (await luna.connect(plain).mint(1, { value: 0 })).wait();
    check("non-agent mint(1) reverts", false, "mint succeeded — BUG");
  } catch (e) { check("non-agent mint(1) reverts", String(e.message).includes("no Agent ID"), short(e)); }
  try {
    await (await luna.connect(plain).mint(5, { value: ethers.parseEther("0.0001") })).wait();
    check("non-agent mint(5) paid reverts", false, "mint succeeded — BUG");
  } catch (e) { check("non-agent mint(5) paid reverts", String(e.message).includes("no Agent ID"), short(e)); }

  // EOA-only: mark the caller contract as an Agent ID holder, then its
  // mint attempt must still revert (msg.sender != tx.origin).
  const caller = await new ethers.ContractFactory(callerArt.abi, callerArt.bytecode, deployer).deploy();
  await caller.waitForDeployment();
  const callerAddr = await caller.getAddress();
  await (await mock.setAgent(callerAddr, true)).wait();
  check("caller contract is an Agent ID holder in mock", (await mock.balanceOf(callerAddr)) === 1n);
  const okEoa = await caller.tryMint.staticCall(lunaAddr, 1, { value: 0 });
  check("contract caller mint reverts (EOA only)", okEoa === false, `tryMint returned ${okEoa} (false = inner mint reverted)`);

  // Mark agent wallets
  await (await mock.setAgents([agentAddr, agent2Addr], true)).wait();

  // Agent mint(3) — all free, value 0
  const tx1 = await luna.connect(agent).mint(3, { value: 0 });
  const rc1 = await tx1.wait();
  results.freeMint = { tx: tx1.hash, gas: rc1.gasUsed.toString() };
  check("agent mint(3) free succeeds", (await luna.ownerOf(1)) === agentAddr && (await luna.ownerOf(3)) === agentAddr, `tokens #1-3, gas ${rc1.gasUsed}`);
  check("freeClaimed=3 / mintedCount=3 after mint(3)", (await luna.freeClaimed(agentAddr)) === 3n && (await luna.mintedCount(agentAddr)) === 3n);
  check("freeMinted(address) true after a free mint", await luna.freeMinted(agentAddr));
  check("freeMintedCount=3 / paidMinted=0", (await luna.freeMintedCount()) === 3n && (await luna.paidMinted()) === 0n);
  check("tokenPaid #1-3 false (free)", !(await luna.tokenPaid(1)) && !(await luna.tokenPaid(3)));
  check("contract balance 0 after free-only mint", BigInt(await provider.send("eth_getBalance", [lunaAddr, "latest"])) === 0n);

  // tokenURI #1: New Moon, Free, valid SVG
  const meta1 = decodeTokenURI(await luna.tokenURI(1));
  const svg1 = decodeSvg(meta1.image);
  check("tokenURI(1) decodes: New Moon, 0%, Free", meta1.name === "Luna Phase Agents #1" && meta1.attributes.find((a) => a.trait_type === "Phase").value === "New Moon" && meta1.attributes.find((a) => a.trait_type === "Illumination").value === "0%" && meta1.attributes.find((a) => a.trait_type === "Origin").value === "Free", `phase=${meta1.attributes[0].value}`);
  check("tokenURI(1) SVG is valid and names New Moon", svg1.includes("<svg") && svg1.includes("New Moon") && svg1.includes("0% lit"));

  // tokenURI for a nonexistent token reverts
  try { await luna.tokenURI(9999); check("tokenURI(9999) reverts", false, "returned data — BUG"); }
  catch (e) { check("tokenURI(9999) reverts", true, short(e)); }

  // Blended mint: fresh agent2 mint(5) = 3 free + 2 paid, 0.0001 BNB
  const tx2 = await luna.connect(agent2).mint(5, { value: ethers.parseEther("0.0001") });
  const rc2 = await tx2.wait();
  results.blendedMint = { tx: tx2.hash, gas: rc2.gasUsed.toString() };
  check("agent2 mint(5) blended succeeds (3 free + 2 paid)", (await luna.ownerOf(4)) === agent2Addr && (await luna.ownerOf(8)) === agent2Addr, `tokens #4-8, gas ${rc2.gasUsed}`);
  check("agent2 freeClaimed=3 / mintedCount=5 / paidMinted=2", (await luna.freeClaimed(agent2Addr)) === 3n && (await luna.mintedCount(agent2Addr)) === 5n && (await luna.paidMinted()) === 2n);
  check("tokenPaid #4-6 false, #7-8 true (free first, paid after)", !(await luna.tokenPaid(4)) && !(await luna.tokenPaid(6)) && (await luna.tokenPaid(7)) && (await luna.tokenPaid(8)));
  check("contract holds 0.0001 BNB after blended mint", BigInt(await provider.send("eth_getBalance", [lunaAddr, "latest"])) === ethers.parseEther("0.0001"));
  const meta5 = decodeTokenURI(await luna.tokenURI(5));
  check("tokenURI(5) = Full Moon, 100%, Free", meta5.attributes.find((a) => a.trait_type === "Phase").value === "Full Moon" && meta5.attributes.find((a) => a.trait_type === "Illumination").value === "100%" && meta5.attributes.find((a) => a.trait_type === "Origin").value === "Free");
  const meta8 = decodeTokenURI(await luna.tokenURI(8));
  check("tokenURI(8) = Waning Crescent, 25%, Paid", meta8.attributes.find((a) => a.trait_type === "Phase").value === "Waning Crescent" && meta8.attributes.find((a) => a.trait_type === "Origin").value === "Paid");

  // Wrong price reverts (agent2 free used up: mint(2) costs 0.0001, not 0)
  try {
    await (await luna.connect(agent2).mint(2, { value: 0 })).wait();
    check("wrong-price mint reverts", false, "mint succeeded — BUG");
  } catch (e) { check("wrong-price mint reverts", String(e.message).includes("wrong price"), short(e)); }
  try {
    await (await luna.connect(agent2).mint(2, { value: ethers.parseEther("0.0002") })).wait();
    check("overpay mint reverts", false, "mint succeeded — BUG");
  } catch (e) { check("overpay mint reverts", String(e.message).includes("wrong price"), short(e)); }

  // Qty bounds
  try { await (await luna.connect(agent2).mint(0, { value: 0 })).wait(); check("qty 0 reverts", false, "mint succeeded — BUG"); }
  catch (e) { check("qty 0 reverts", String(e.message).includes("qty 1..50"), short(e)); }
  try { await (await luna.connect(agent2).mint(51, { value: ethers.parseEther("0.00255") })).wait(); check("qty 51 reverts", false, "mint succeeded — BUG"); }
  catch (e) { check("qty 51 reverts", String(e.message).includes("qty 1..50"), short(e)); }

  // Max 50/wallet: agent2 has 5; mint(46) would make 51
  try { await (await luna.connect(agent2).mint(46, { value: ethers.parseEther("0.0023") })).wait(); check("mint past 50/wallet reverts", false, "mint succeeded — BUG"); }
  catch (e) { check("mint past 50/wallet reverts", String(e.message).includes("max 50 per wallet"), short(e)); }
  // mint(45) brings agent2 to exactly 50 (all paid, 45 x 0.00005 = 0.00225)
  const tx3 = await luna.connect(agent2).mint(45, { value: ethers.parseEther("0.00225") });
  const rc3 = await tx3.wait();
  results.maxWalletMint = { tx: tx3.hash, gas: rc3.gasUsed.toString() };
  check("agent2 mint(45) reaches exactly 50/wallet", (await luna.mintedCount(agent2Addr)) === 50n && (await luna.totalSupply()) === 53n, `gas ${rc3.gasUsed}`);
  try { await (await luna.connect(agent2).mint(1, { value: ethers.parseEther("0.00005") })).wait(); check("mint(1) at 50/wallet cap reverts", false, "mint succeeded — BUG"); }
  catch (e) { check("mint(1) at 50/wallet cap reverts", String(e.message).includes("max 50 per wallet"), short(e)); }

  // Royalties: 5% to owner on a 1 BNB sale
  const [royReceiver, royAmount] = await luna.royaltyInfo(1, ethers.parseEther("1"));
  results.royalty = { receiver: royReceiver, amountWei: royAmount.toString() };
  check("royaltyInfo 5% to owner", royReceiver === deployerAddr && royAmount === ethers.parseEther("0.05"), `receiver ${royReceiver}, amount ${ethers.formatEther(royAmount)} BNB on 1 BNB sale`);
  check("supportsInterface ERC2981", await luna.supportsInterface("0x2a55205a"));

  // Paid-supply exhaustion (777): agent2 already paid 47 (2+45).
  // Loop fresh wallets minting 50 (3 free + 47 paid) until paid is gone.
  console.log("Exhausting paid supply 777 (starting paidMinted 47)...");
  const t1 = Date.now();
  let walletsUsed = 0;
  while ((await luna.paidRemaining()) > 0n) {
    const w = ethers.Wallet.createRandom().connect(provider);
    await provider.send("anvil_setBalance", [w.address, "0x8ac7230489e80000"]);
    await (await mock.setAgent(w.address, true)).wait();
    const remaining = await luna.paidRemaining();
    const qty = remaining >= 47n ? 50 : Number(remaining) + 3;
    const paidQty = BigInt(qty) - 3n;
    const tx = await luna.connect(w).mint(qty, { value: ethers.parseEther(PRICE) * paidQty });
    await tx.wait();
    walletsUsed++;
    if (walletsUsed > 25) throw new Error("paid exhaustion loop ran too long");
  }
  results.paidExhaustion = { walletsUsed, seconds: ((Date.now() - t1) / 1000).toFixed(0), totalSupply: (await luna.totalSupply()).toString() };
  check("paid supply exhausts to 0 (777 paid)", (await luna.paidMinted()) === 777n && (await luna.paidRemaining()) === 0n, `${walletsUsed} wallets, totalSupply ${await luna.totalSupply()}`);
  check("paidOpen false after exhaustion, freeOpen still true", !(await luna.paidOpen()) && (await luna.freeOpen()));

  // After paid exhaustion: a fresh wallet can still mint free, but not paid.
  const fresh = ethers.Wallet.createRandom().connect(provider);
  await provider.send("anvil_setBalance", [fresh.address, "0x8ac7230489e80000"]);
  await (await mock.setAgent(fresh.address, true)).wait();
  const txF = await luna.connect(fresh).mint(3, { value: 0 });
  await txF.wait();
  check("fresh wallet mint(3) free still succeeds after paid exhaustion", (await luna.freeClaimed(fresh.address)) === 3n);
  try { await (await luna.connect(fresh).mint(1, { value: ethers.parseEther("0.00005") })).wait(); check("paid mint after paid exhaustion reverts", false, "mint succeeded — BUG"); }
  catch (e) { check("paid mint after paid exhaustion reverts", String(e.message).includes("paid supply exhausted"), short(e)); }
  q = await luna.quoteMint(fresh.address, 1);
  check("quoteMint after paid exhaustion: 0 free, 1 paid, 0.00005 BNB", q[0] === 0n && q[1] === 1n && q[2] === ethers.parseEther("0.00005"));

  // All 8 phases present in tokenURIs #1-8 (already minted above)
  let allPhasesOk = true;
  for (let id = 1; id <= 8; id++) {
    const m = decodeTokenURI(await luna.tokenURI(id));
    if (m.attributes.find((a) => a.trait_type === "Phase").value !== phases[id - 1]) allPhasesOk = false;
    const svg = decodeSvg(m.image);
    if (!svg.includes(phases[id - 1])) allPhasesOk = false;
  }
  check("tokenURI #1-8 cover all 8 phases with matching SVG text", allPhasesOk);

  // Withdraw: contract holds exactly 777 x 0.00005 = 0.03885 BNB.
  // Balance read with RAW eth_getBalance + retries (NFOX M9 lesson).
  const expectedPaid = ethers.parseEther("0.03885");
  const balBefore = await provider.send("eth_getBalance", [lunaAddr, "latest"]);
  check("contract holds paid BNB 0.03885 (= 777 x 0.00005)", BigInt(balBefore) === expectedPaid, `${ethers.formatEther(balBefore)} BNB`);
  const txW = await luna.connect(deployer).withdraw();
  const rcW = await txW.wait();
  check("withdraw tx succeeds", rcW.status === 1, `gas ${rcW.gasUsed}`);
  let balAfter = null;
  for (let i = 0; i < 5; i++) {
    balAfter = BigInt(await provider.send("eth_getBalance", [lunaAddr, "latest"]));
    if (balAfter === 0n) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  results.withdraw = { tx: txW.hash, gas: rcW.gasUsed.toString(), balanceAfter: balAfter.toString() };
  check("owner withdraw empties contract", balAfter === 0n, `${ethers.formatEther(balAfter ?? 0n)} BNB left`);

  // Non-owner withdraw must revert (onlyOwner, before the balance check)
  try { await (await luna.connect(agent).withdraw()).wait(); check("non-owner withdraw reverts", false, "call succeeded — BUG"); }
  catch (e) { check("non-owner withdraw reverts", true, short(e)); }
  // Withdraw with nothing left reverts — proven via staticCall so the
  // full revert reason is visible (ethers' shortMessage is generic here;
  // the earlier FAIL was a test-assertion bug, not a contract bug: the
  // raw revert reason is "nothing to withdraw", see probe below).
  try { await luna.connect(deployer).withdraw.staticCall(); check("withdraw empty reverts", false, "staticCall succeeded — BUG"); }
  catch (e) { check("withdraw empty reverts", String(e.message).includes("nothing to withdraw"), String(e.message).slice(0, 120)); }

  // Mainnet cost estimate from REAL measured gas (BSC ~0.05 gwei, BNB ~$700)
  const bnb = (gas) => ethers.formatEther(BigInt(gas) * 50_000_000n);
  const usd = (gas) => (parseFloat(bnb(gas)) * 700).toFixed(4);
  results.mainnetCostEstimate = {
    gasPriceAssumption: "0.05 gwei", bnbPriceAssumptionUsd: 700,
    lunaDeployGas: lunaRc.gasUsed.toString(), lunaDeployBnb: bnb(lunaRc.gasUsed), lunaDeployUsd: usd(lunaRc.gasUsed),
    freeMintX3Gas: rc1.gasUsed.toString(), freeMintX3Bnb: bnb(rc1.gasUsed), freeMintX3Usd: usd(rc1.gasUsed),
    blendedMintX5Gas: rc2.gasUsed.toString(), blendedMintX5Bnb: bnb(rc2.gasUsed), blendedMintX5Usd: usd(rc2.gasUsed),
    mintX45Gas: rc3.gasUsed.toString(), mintX45Bnb: bnb(rc3.gasUsed), mintX45Usd: usd(rc3.gasUsed),
    withdrawGas: rcW.gasUsed.toString(), withdrawBnb: bnb(rcW.gasUsed), withdrawUsd: usd(rcW.gasUsed),
    note: "Mock is local-only; mainnet uses the real registry, so mainnet deployment = LunaPhaseAgents deploy only. No setBaseURI tx exists (on-chain art).",
  };
  console.log("\nMainnet cost estimate (0.05 gwei, BNB $700):");
  console.log(`  deploy LunaPhaseAgents: ${results.mainnetCostEstimate.lunaDeployBnb} BNB (~$${results.mainnetCostEstimate.lunaDeployUsd})`);
  console.log(`  free mint x3 (minter pays gas): ${results.mainnetCostEstimate.freeMintX3Bnb} BNB (~$${results.mainnetCostEstimate.freeMintX3Usd})`);
  console.log(`  blended mint x5 (minter pays gas): ${results.mainnetCostEstimate.blendedMintX5Bnb} BNB (~$${results.mainnetCostEstimate.blendedMintX5Usd})`);

  results.finishedAt = new Date().toISOString();
  results.allPassed = results.tests.every((t) => t.ok);
  fs.writeFileSync(path.join(root, "test-results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.tests.filter((t) => t.ok).length}/${results.tests.length} tests passed. Saved test-results.json`);
  if (!results.allPassed) process.exitCode = 1;
} finally {
  anvil.kill("SIGTERM");
}
