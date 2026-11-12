// Deploy LunaPhaseAgents + AgentIdRegistryMock to BSC TESTNET (chain 97).
// TESTNET ONLY. Never point this at mainnet, never use the user's real
// wallet key. The deployer is a FRESH throwaway wallet generated locally
// and stored in .env.testnet (chmod 600). Only its ADDRESS is recorded
// in deployment-testnet.json / SPECS.md / reports.
//
// Owner on testnet = user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403
// (same as mainnet will be). Consequence: withdraw() is owner-only, so
// it CANNOT be executed live on testnet by the deployer — it is proven
// locally (55/55 Anvil) and the live script records the non-owner
// revert + the contract's held balance instead. There is NO setBaseURI
// in this contract (on-chain SVG art is immutable), so nothing to set.
//
// Luna differences from the AKEY script this was adapted from:
// - NO freeMint(): single blended mint(qty) — first 3 per wallet free,
//   every extra in the same tx paid at 0.00005 tBNB.
// - Paid mint DOES check the Agent ID registry (unlike AKEY/SIGMA).
// - EOA-only: msg.sender == tx.origin (proven live with EoaTestCaller).
// - Paid supply is NOT exhausted live (777 would need ~17 wallets x 50);
//   live tests prove the blended math, the caps and the reverts on a
//   small number of wallets. Exhaustion was proven locally (55/55).
//
// Usage:
//   node scripts/deploy-testnet.js            # deploy + run live tests
//   node scripts/deploy-testnet.js --estimate # gas estimate only, no deploy
// The deployer needs >= 0.01 tBNB. Actual need at 0.1 gwei:
// deploys ~2.93M gas = ~0.0003 + setAgents ~0.00001 + funding values
// ~0.0035 (agent2 paid mints) + test gas ~0.0005 = ~0.0045 tBNB total.
// One faucet claim (~0.1 tBNB) is more than enough. If the balance is
// lower the script stops (exit 2) with faucet instructions. Fund it,
// then re-run.
// Faucet: https://testnet.bnbchain.org/faucet-smart
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const CHAIN_ID = 97;
const FAUCET = "https://testnet.bnbchain.org/faucet-smart";
const ENV_FILE = path.join(root, ".env.testnet");
const DEPLOY_FILE = path.join(root, "deployment-testnet.json");
const TESTS_FILE = path.join(root, "testnet-live-tests.json");
const WALLETS_FILE = path.join(root, "test-wallets-testnet.json");
const MIN_BALANCE = ethers.parseEther("0.01");
const PAID_PRICE = ethers.parseEther("0.00005");
const USER_WALLET = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "build", `${name}.json`), "utf8"));
}
function loadEnv() {
  const out = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
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

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const env = loadEnv();
let deployer;
if (env.DEPLOYER_PRIVATE_KEY) {
  deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
} else {
  deployer = ethers.Wallet.createRandom().connect(provider);
  fs.writeFileSync(
    ENV_FILE,
    `# TESTNET-ONLY throwaway deployer — never fund with real BNB, never use on mainnet.\n# Address: ${deployer.address}\nDEPLOYER_PRIVATE_KEY=${deployer.privateKey}\n`,
    { mode: 0o600 }
  );
  console.log("Generated fresh throwaway testnet deployer.");
}
console.log("Deployer address:", deployer.address);

const balance = await provider.getBalance(deployer.address);
console.log("Deployer tBNB balance (on-chain):", ethers.formatEther(balance));
const feeData = await provider.getFeeData();
console.log("Testnet gas price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "n/a");

const mockArt = loadArtifact("AgentIdRegistryMock");
const lunaArt = loadArtifact("LunaPhaseAgents");
const callerArt = loadArtifact("EoaTestCaller");
const mockFactory = new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer);
const lunaFactory = new ethers.ContractFactory(lunaArt.abi, lunaArt.bytecode, deployer);
const callerFactory = new ethers.ContractFactory(callerArt.abi, callerArt.bytecode, deployer);
try {
  const mockTx = await mockFactory.getDeployTransaction(deployer.address);
  const lunaTx = await lunaFactory.getDeployTransaction(await mockFactory.getDeployTransaction(deployer.address).then(() => deployer.address).catch(() => deployer.address), USER_WALLET).catch(() => null);
  const mockGas = await provider.estimateGas({ ...mockTx, from: deployer.address });
  console.log(`Est. deploy gas: mock ${mockGas} (Luna estimate needs the mock address — see local test: Luna deploy 2,622,738 gas)`);
  const price = feeData.gasPrice ?? 3_000_000_000n;
  console.log(`Est. deploy cost at ${ethers.formatUnits(price, "gwei")} gwei: mock ~${ethers.formatEther(mockGas * price)} tBNB, Luna ~${ethers.formatEther(2622738n * price)} tBNB`);
  console.log(`Plus ~0.0035 tBNB to fund agent2's paid mints + test gas ~0.0005. Total needed: ~0.005 tBNB (MIN_BALANCE 0.01 tBNB; one faucet claim of ~0.1 tBNB is plenty).`);
} catch (e) {
  console.log("Gas estimate failed (RPC may need a funded from-address):", e.message);
}

if (process.argv.includes("--estimate")) process.exit(0);

if (balance < MIN_BALANCE) {
  console.log("\n=== BLOCKED: testnet deployer needs tBNB ===");
  console.log(`1. Open ${FAUCET}`);
  console.log(`2. Paste this address: ${deployer.address}`);
  console.log(`3. Claim testnet BNB (faucet gives ~0.1 tBNB per claim; one claim is plenty).`);
  console.log("4. Re-run: node scripts/deploy-testnet.js");
  console.log("   (Key is saved in .env.testnet — never share it, never fund it with real BNB.)");
  console.log("   Verify the balance on-chain before re-running: the script reads it first.");
  process.exit(2);
}

const tests = [];
function record(name, ok, detail) {
  tests.push({ name, ok, detail });
  console.log(`TEST ${name}: ${ok ? "OK" : "FAIL"}${detail ? " — " + detail : ""}`);
}

console.log("\nDeploying AgentIdRegistryMock...");
const mock = await mockFactory.deploy(deployer.address);
await mock.waitForDeployment();
const mockAddr = await mock.getAddress();
const mockRc = await (await mock.deploymentTransaction().wait());
console.log("Mock deployed:", mockAddr, "tx", mock.deploymentTransaction().hash, "gas", mockRc.gasUsed.toString());

// 2 agent test wallets + 1 plain wallet (never an agent).
const agent = ethers.Wallet.createRandom().connect(provider);
const agent2 = ethers.Wallet.createRandom().connect(provider);
const plainWallet = ethers.Wallet.createRandom().connect(provider);
console.log("Agent test wallets:", agent.address, agent2.address, "Plain test wallet:", plainWallet.address);
// Persist test wallets IMMEDIATELY (lesson from the 2026-11-02 SIGMA crash).
fs.writeFileSync(
  WALLETS_FILE,
  JSON.stringify(
    {
      note: "TESTNET-ONLY throwaway wallets. Never use on mainnet, never fund with real BNB.",
      agent: { address: agent.address, privateKey: agent.privateKey },
      agent2: { address: agent2.address, privateKey: agent2.privateKey },
      plain: { address: plainWallet.address, privateKey: plainWallet.privateKey },
    },
    null,
    2
  ),
  { mode: 0o600 }
);
console.log("Test wallets saved to test-wallets-testnet.json (before any deploy).");
await (await mock.setAgents([agent.address, agent2.address], true)).wait();
console.log("Mock: agent + agent2 marked as Agent ID holders.");

// EOA-only proof needs a contract caller that IS an Agent ID holder.
const caller = await callerFactory.deploy();
await caller.waitForDeployment();
const callerAddr = await caller.getAddress();
await (await mock.setAgent(callerAddr, true)).wait();
console.log("EoaTestCaller deployed:", callerAddr, "(marked as Agent ID holder in mock)");

console.log(`Deploying LunaPhaseAgents (owner = user wallet ${USER_WALLET}, TESTNET ONLY)...`);
const luna = await lunaFactory.deploy(mockAddr, USER_WALLET);
await luna.waitForDeployment();
const lunaAddr = await luna.getAddress();
const lunaRc = await (await luna.deploymentTransaction().wait());
console.log("LunaPhaseAgents deployed:", lunaAddr, "tx", luna.deploymentTransaction().hash, "gas", lunaRc.gasUsed.toString());

// On-chain constants / owner check right after deploy
record("name/symbol", (await luna.name()) === "Luna Phase Agents" && (await luna.symbol()) === "LPHASE", `${await luna.name()} / ${await luna.symbol()}`);
record(
  "constants + owner is user wallet",
  (await luna.MAX_SUPPLY()) === 7777n && (await luna.FREE_SUPPLY()) === 7000n && (await luna.PAID_SUPPLY()) === 777n && (await luna.PAID_PRICE()) === PAID_PRICE && (await luna.FREE_PER_WALLET()) === 3n && (await luna.MAX_PER_WALLET()) === 50n && (await luna.owner()) === USER_WALLET,
  `owner ${await luna.owner()}`
);
record("totalSupply 0 / freeRemaining 7000 / paidRemaining 777", (await luna.totalSupply()) === 0n && (await luna.freeRemaining()) === 7000n && (await luna.paidRemaining()) === 777n, "");
record("freeOpen true / paidOpen true at start (blended)", (await luna.freeOpen()) === true && (await luna.paidOpen()) === true, "");
record("ABI has NO setBaseURI / NO freeMint", !lunaArt.abi.some((e) => e.name === "setBaseURI") && !lunaArt.abi.some((e) => e.name === "freeMint"), "");

// Fund test wallets: agent needs mint gas only; agent2 needs paid value
// 0.00235 (47 paid) + gas; plain needs revert-attempt gas only.
await (await deployer.sendTransaction({ to: agent.address, value: ethers.parseEther("0.001") })).wait();
await (await deployer.sendTransaction({ to: agent2.address, value: ethers.parseEther("0.004") })).wait();
await (await deployer.sendTransaction({ to: plainWallet.address, value: ethers.parseEther("0.001") })).wait();
console.log("Test wallets funded (agent 0.001, agent2 0.004, plain 0.001 tBNB).");

// --- Live test 1: agent mint(3) — all free, value 0 ---
const tx1 = await luna.connect(agent).mint(3, { value: 0 });
const rc1 = await tx1.wait();
record("agent mint(3) free succeeds", (await luna.ownerOf(1)) === agent.address && (await luna.ownerOf(3)) === agent.address, `tx ${tx1.hash} gas ${rc1.gasUsed} tokens #1-3`);

// --- Live test 2: non-agent mint(1) must revert "no Agent ID" ---
try {
  await (await luna.connect(plainWallet).mint(1, { value: 0 })).wait();
  record("non-agent mint(1) reverts", false, "non-agent minted (BUG)");
} catch (e) {
  record("non-agent mint(1) reverts", /no Agent ID/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 3: contract caller (Agent ID holder) must revert EOA-only ---
const okEoa = await caller.tryMint.staticCall(lunaAddr, 1, { value: 0 });
record("contract caller mint reverts (EOA only)", okEoa === false, `tryMint returned ${okEoa} (false = inner mint reverted)`);

// --- Live test 4: blended mint(5) by agent2 = 3 free + 2 paid, 0.0001 tBNB ---
const tx2 = await luna.connect(agent2).mint(5, { value: ethers.parseEther("0.0001") });
const rc2 = await tx2.wait();
record(
  "agent2 mint(5) blended succeeds (3 free + 2 paid)",
  (await luna.ownerOf(4)) === agent2.address && (await luna.ownerOf(8)) === agent2.address && (await luna.paidMinted()) === 2n,
  `tx ${tx2.hash} gas ${rc2.gasUsed} tokens #4-8`
);
record("tokenPaid #4-6 false, #7-8 true", !(await luna.tokenPaid(4)) && !(await luna.tokenPaid(6)) && (await luna.tokenPaid(7)) && (await luna.tokenPaid(8)), "");

// --- Live test 5: wrong price must revert ---
try {
  await (await luna.connect(agent2).mint(2, { value: 0 })).wait();
  record("wrong-price mint reverts", false, "wrong price succeeded (BUG)");
} catch (e) {
  record("wrong-price mint reverts", /wrong price/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 6: qty 51 must revert ---
try {
  await (await luna.connect(agent2).mint(51, { value: ethers.parseEther("0.00255") })).wait();
  record("qty 51 reverts", false, "qty 51 succeeded (BUG)");
} catch (e) {
  record("qty 51 reverts", /qty 1\.\.50/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 7: max 50/wallet — agent2 has 5, mint(45) reaches exactly 50 ---
const tx3 = await luna.connect(agent2).mint(45, { value: ethers.parseEther("0.00225") });
const rc3 = await tx3.wait();
record("agent2 mint(45) reaches exactly 50/wallet", (await luna.mintedCount(agent2.address)) === 50n && (await luna.totalSupply()) === 53n, `tx ${tx3.hash} gas ${rc3.gasUsed}`);
try {
  await (await luna.connect(agent2).mint(1, { value: PAID_PRICE })).wait();
  record("mint(1) at 50/wallet cap reverts", false, "mint succeeded past cap (BUG)");
} catch (e) {
  record("mint(1) at 50/wallet cap reverts", /max 50 per wallet/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 8: quoteMint on-chain ---
const q = await luna.quoteMint(agent.address, 1);
record("quoteMint agent (free used) qty1 = 0 free, 1 paid, 0.00005", q[0] === 0n && q[1] === 1n && q[2] === PAID_PRICE, `free=${q[0]} paid=${q[1]} cost=${ethers.formatEther(q[2])} tBNB`);

// --- Live test 9: tokenURI decodes live — #1 New Moon Free, #5 Full Moon Free, #8 Waning Crescent Paid ---
const meta1 = decodeTokenURI(await luna.tokenURI(1));
const svg1 = decodeSvg(meta1.image);
record("tokenURI(1) live: New Moon, 0%, Free, valid SVG", meta1.attributes.find((a) => a.trait_type === "Phase").value === "New Moon" && meta1.attributes.find((a) => a.trait_type === "Origin").value === "Free" && svg1.includes("New Moon"), `phase=${meta1.attributes[0].value}`);
const meta5 = decodeTokenURI(await luna.tokenURI(5));
record("tokenURI(5) live: Full Moon, 100%, Free", meta5.attributes.find((a) => a.trait_type === "Phase").value === "Full Moon" && meta5.attributes.find((a) => a.trait_type === "Illumination").value === "100%", "");
const meta8 = decodeTokenURI(await luna.tokenURI(8));
record("tokenURI(8) live: Waning Crescent, 25%, Paid", meta8.attributes.find((a) => a.trait_type === "Phase").value === "Waning Crescent" && meta8.attributes.find((a) => a.trait_type === "Origin").value === "Paid", "");

// --- On-chain reads ---
const reads = {
  owner: await luna.owner(),
  totalSupply: (await luna.totalSupply()).toString(),
  freeMintedCount: (await luna.freeMintedCount()).toString(),
  paidMinted: (await luna.paidMinted()).toString(),
  freeRemaining: (await luna.freeRemaining()).toString(),
  paidRemaining: (await luna.paidRemaining()).toString(),
  freeOpen: await luna.freeOpen(),
  paidOpen: await luna.paidOpen(),
  royalty: await luna.royaltyInfo(1, ethers.parseEther("1")),
};
console.log("\nOn-chain reads:", JSON.stringify({ ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] }, null, 2));
record("royaltyInfo 5% to owner (user wallet)", reads.royalty[1] === ethers.parseEther("0.05") && reads.royalty[0] === USER_WALLET, `receiver ${reads.royalty[0]} amount ${ethers.formatEther(reads.royalty[1])} tBNB on 1 tBNB sale`);

// --- Withdraw: owner is the USER wallet, deployer is NOT owner ---
// Contract balance after the paid tests should be 47 x 0.00005 = 0.00235 tBNB.
const contractBal = await provider.send("eth_getBalance", [lunaAddr, "latest"]);
record("contract holds paid tBNB 0.00235 for owner", BigInt(contractBal) === ethers.parseEther("0.00235"), `${ethers.formatEther(contractBal)} tBNB`);
try {
  await (await luna.connect(deployer).withdraw()).wait();
  record("non-owner (deployer) withdraw reverts", false, "withdraw succeeded (BUG)");
} catch (e) {
  // ethers shows Ownable custom errors as "unknown custom error" with
  // revert data 0x118cdaa7 + address — match the SELECTOR, not the name
  // (same correction as AKEY testnet: the name never appears in e.message).
  record("non-owner (deployer) withdraw reverts", /0x118cdaa7/i.test(String(e.data || e.message)) || /OwnableUnauthorizedAccount/.test(e.message), String(e.message).slice(0, 120));
}

const deployment = {
  network: "BSC testnet",
  chainId: CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  mockRegistry: mockAddr,
  mockDeployTx: mock.deploymentTransaction().hash,
  mockDeployGas: mockRc.gasUsed.toString(),
  eoaTestCaller: callerAddr,
  lunaPhaseAgents: lunaAddr,
  lunaPhaseAgentsDeployTx: luna.deploymentTransaction().hash,
  lunaPhaseAgentsDeployGas: lunaRc.gasUsed.toString(),
  owner: USER_WALLET,
  agentTestWallet: agent.address,
  agent2TestWallet: agent2.address,
  plainTestWallet: plainWallet.address,
  freeMintTx: tx1.hash,
  freeMintGas: rc1.gasUsed.toString(),
  blendedMintTx: tx2.hash,
  blendedMintGas: rc2.gasUsed.toString(),
  maxWalletMintTx: tx3.hash,
  maxWalletMintGas: rc3.gasUsed.toString(),
  contractBalanceAfterTestsTBNB: ethers.formatEther(contractBal),
  onChainReads: { ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] },
  note: "TESTNET ONLY — SUPERSEDED contract, never point minters at it. Private keys are in .env.testnet / test-wallets-testnet.json (throwaway wallets). Never use on mainnet. Owner is the user wallet, so withdraw needs the user wallet to sign. There is no setBaseURI in this contract.",
};
fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployment, null, 2));
fs.writeFileSync(TESTS_FILE, JSON.stringify({ network: "BSC testnet", chainId: CHAIN_ID, at: new Date().toISOString(), tests }, null, 2));
console.log("\nSaved:", DEPLOY_FILE, "and", TESTS_FILE);
console.log("Verify on BscScan testnet: https://testnet.bscscan.com/address/" + lunaAddr);
const failed = tests.filter((t) => !t.ok);
if (failed.length) {
  console.log(`\n${failed.length} LIVE TEST(S) FAILED — do not proceed to mainnet.`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} live tests passed.`);
