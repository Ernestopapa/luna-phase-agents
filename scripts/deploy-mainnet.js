// Deploy LunaPhaseAgents to BSC MAINNET (chain 56).
// MAINNET ONLY. No mock registry — constructor args are the REAL Agent ID
// registry and the USER wallet as initialOwner. The deployer is a FRESH
// throwaway wallet (key only in .env.mainnet, chmod 600); it pays gas only.
// It is NOT the testnet deployer (0x80422feF2eC4b85f3D6A66a5f279E9901D5A91b9),
// never fund it with testnet keys, never use the testnet deployer here.
//
// The bytecode deployed here is byte-identical to the Gate 1 build:
// recompile keccak 0x6944ff8c9a6a42c871a2fd930000759099355650be448f43104f1e2cf7e3a862,
// 12,218 bytes — the same code that passed 55/55 local tests and 21/21
// live testnet tests. There is NO setBaseURI and NO freeMint in this
// contract (on-chain SVG art is immutable; single blended mint only).
//
// Usage:
//   node scripts/deploy-mainnet.js            # deploy (needs >= 0.001 BNB)
//   node scripts/deploy-mainnet.js --estimate # gas estimate only, no deploy
// Funding: user sends ~0.001 BNB to the deployer address from the user
// wallet. Deploy costs ~2,622,738 gas; at 0.05 gwei that is ~0.000131 BNB
// (~$0.09). 0.001 BNB leaves ample margin plus the leftover-return tx.
// Verify the top-up ON CHAIN before running (M10 lesson: never assume a
// transfer landed — this script reads the balance first and exits if
// < 0.001 BNB). After deploy, leftover deployer BNB is returned to the
// user wallet and the return tx is recorded (separate step, not this script).
// There is NO setBaseURI to call after deploy (unlike NFOX/SIGMA/AKEY).
// No mints are executed by this script — mainnet mints cost real BNB and
// would consume supply; mint logic was proven on testnet (21/21).
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "https://bsc-dataseed.binance.org/";
const CHAIN_ID = 56;
const ENV_FILE = path.join(root, ".env.mainnet");
const DEPLOY_FILE = path.join(root, "deployment-mainnet.json");
const MIN_BALANCE = ethers.parseEther("0.001");
const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const OWNER = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";
const TESTNET_DEPLOYER = "0x80422feF2eC4b85f3D6A66a5f279E9901D5A91b9";
const EXPECTED_BYTECODE_KECCAK = "0x6944ff8c9a6a42c871a2fd930000759099355650be448f43104f1e2cf7e3a862";

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

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const env = loadEnv();
let deployer;
if (env.DEPLOYER_PRIVATE_KEY) {
  deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
} else {
  deployer = ethers.Wallet.createRandom().connect(provider);
  fs.writeFileSync(
    ENV_FILE,
    `# MAINNET throwaway deployer — pays gas only, never the owner. Never fund with testnet keys, never use on testnet.\n# Address: ${deployer.address}\nDEPLOYER_PRIVATE_KEY=${deployer.privateKey}\n`,
    { mode: 0o600 }
  );
  console.log("Generated fresh throwaway MAINNET deployer.");
}
if (deployer.address.toLowerCase() === TESTNET_DEPLOYER.toLowerCase()) {
  console.log("BLOCKED: deployer is the TESTNET deployer. Never use the testnet key on mainnet.");
  process.exit(2);
}
if (deployer.address.toLowerCase() === OWNER.toLowerCase()) {
  console.log("BLOCKED: deployer must be a throwaway, not the user wallet.");
  process.exit(2);
}
console.log("Deployer address:", deployer.address);
console.log("Registry (real):", REGISTRY);
console.log("Owner (user wallet):", OWNER);

// Bytecode identity check: the build on disk must be the exact code that
// passed Gate 1 (55/55) and Gate 5 testnet (21/21). Refuse to deploy a
// different build.
const lunaArt = loadArtifact("LunaPhaseAgents");
const bytecodeKeccak = ethers.keccak256(lunaArt.bytecode);
console.log("Build bytecode keccak:", bytecodeKeccak);
if (bytecodeKeccak !== EXPECTED_BYTECODE_KECCAK) {
  console.log("BLOCKED: build bytecode does not match the tested build. Recompile from the Gate 1 source and re-check before deploying.");
  process.exit(2);
}
console.log("Bytecode matches the tested build (Gate 1 + testnet).");

const balance = await provider.getBalance(deployer.address);
console.log("Deployer BNB balance (on-chain):", ethers.formatEther(balance));
const feeData = await provider.getFeeData();
console.log("Mainnet gas price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "n/a");

const lunaFactory = new ethers.ContractFactory(lunaArt.abi, lunaArt.bytecode, deployer);
try {
  const lunaTx = await lunaFactory.getDeployTransaction(REGISTRY, OWNER);
  const lunaGas = await provider.estimateGas({ ...lunaTx, from: deployer.address });
  const price = feeData.gasPrice ?? 50_000_000n;
  console.log(`Est. deploy gas: ${lunaGas}`);
  console.log(`Est. deploy cost at ${ethers.formatUnits(price, "gwei")} gwei: ${ethers.formatEther(lunaGas * price)} BNB`);
} catch (e) {
  console.log("Gas estimate failed:", e.message);
}

if (process.argv.includes("--estimate")) process.exit(0);

if (balance < MIN_BALANCE) {
  console.log("\n=== BLOCKED: mainnet deployer needs BNB ===");
  console.log(`1. Send ~0.001 BNB (from the user wallet ${OWNER}) to: ${deployer.address}`);
  console.log("2. Verify the balance on-chain, then re-run: node scripts/deploy-mainnet.js");
  console.log("   (Key is saved in .env.mainnet — never share it, never fund it with testnet keys.)");
  process.exit(2);
}

console.log("\nDeploying LunaPhaseAgents to BSC MAINNET (owner = user wallet)...");
const luna = await lunaFactory.deploy(REGISTRY, OWNER);
await luna.waitForDeployment();
const lunaAddr = await luna.getAddress();
const deployTx = luna.deploymentTransaction();
const lunaRc = await deployTx.wait();
console.log("LunaPhaseAgents deployed:", lunaAddr, "tx", deployTx.hash, "gas", lunaRc.gasUsed.toString(), "block", lunaRc.blockNumber);

// --- On-chain reads, asserted against the locked Gate 0 expectations ---
// No mints on mainnet: reads only.
const reads = {
  name: await luna.name(),
  symbol: await luna.symbol(),
  owner: await luna.owner(),
  registry: await luna.agentIdRegistry(),
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

const checks = [
  ["name Luna Phase Agents / symbol LPHASE", reads.name === "Luna Phase Agents" && reads.symbol === "LPHASE"],
  ["owner is user wallet", reads.owner.toLowerCase() === OWNER.toLowerCase()],
  ["registry is real registry", reads.registry.toLowerCase() === REGISTRY.toLowerCase()],
  ["totalSupply 0", reads.totalSupply === "0"],
  ["freeMintedCount 0", reads.freeMintedCount === "0"],
  ["paidMinted 0", reads.paidMinted === "0"],
  ["freeRemaining 7000", reads.freeRemaining === "7000"],
  ["paidRemaining 777", reads.paidRemaining === "777"],
  ["freeOpen true", reads.freeOpen === true],
  ["paidOpen true (blended, no separate paid phase)", reads.paidOpen === true],
  ["royaltyInfo 5% to owner", reads.royalty[1] === ethers.parseEther("0.05") && reads.royalty[0].toLowerCase() === OWNER.toLowerCase()],
  ["ABI has NO setBaseURI / NO freeMint", !lunaArt.abi.some((e) => e.name === "setBaseURI") && !lunaArt.abi.some((e) => e.name === "freeMint")],
];
for (const [name, ok] of checks) console.log(`CHECK ${name}: ${ok ? "OK" : "FAIL"}`);

const deployment = {
  network: "BSC mainnet",
  chainId: CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  registry: REGISTRY,
  owner: OWNER,
  bytecodeKeccak,
  lunaPhaseAgents: lunaAddr,
  lunaPhaseAgentsDeployTx: deployTx.hash,
  lunaPhaseAgentsDeployGas: lunaRc.gasUsed.toString(),
  blockNumber: lunaRc.blockNumber,
  deployerBalanceBefore: ethers.formatEther(balance),
  onChainReads: { ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] },
  checks: Object.fromEntries(checks),
  status: "deployed",
  note: "MAINNET. No setBaseURI exists in this contract (on-chain SVG art is immutable). No mints were executed by this script. Leftover deployer BNB to be returned to the user wallet; return tx to be recorded separately. Verify on Sourcify + BscScan next, then update the site with this address.",
};
fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployment, null, 2));
console.log("\nSaved:", DEPLOY_FILE);
console.log("Verify on BscScan: https://bscscan.com/address/" + lunaAddr);
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.log(`\n${failed.length} POST-DEPLOY CHECK(S) FAILED — do not proceed to launch.`);
  process.exit(1);
}
console.log("\nAll post-deploy checks passed. Next: return leftover deployer BNB, verify Sourcify + BscScan, update site with this address.");
