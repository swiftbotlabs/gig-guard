// Fund a Telegraph escrow balance on Ethereum Sepolia with one command (testnet only, no real money).
// Mints Telegraph test USDC (public mint), approves the devnode Diamond and deposits into your escrow balance.
// Needs a little Sepolia ETH for gas on the key's address (any public Sepolia faucet).
//   TELEGRAPH_PAYER_KEY=0x... node examples/fund-escrow.mjs [usdc=1]        (prints each tx hash, then your escrow deposit)
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const key = process.env.TELEGRAPH_PAYER_KEY;
if (!/^0x[0-9a-fA-F]{64}$/.test(key || "")) { console.error("set TELEGRAPH_PAYER_KEY to a testnet-only key (0x + 64 hex)"); process.exit(1); }
const usdc = Number(process.argv[2] || 1);
if (!(usdc > 0 && usdc <= 20)) { console.error("amount: 0 < usdc <= 20"); process.exit(1); }
const amount = BigInt(Math.round(usdc * 1e6));
const RPC = process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const USDC = "0xcc194e1a843B658526D0D5C431f670028582Ae17";     // Telegraph test USDC (public mint)
const DIAMOND = "0x72a70e949362670Bf8bceAd24eFC5b8f950aa08b";  // Telegraph devnode Diamond (LedgerFacet)
const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const erc20 = parseAbi(["function mint(address,uint256)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const ledger = parseAbi(["function depositUSDC(uint256)"]);

const eth = await pub.getBalance({ address: account.address });
if (eth === 0n) { console.error(`${account.address} has 0 Sepolia ETH: get some from a public faucet first`); process.exit(1); }
for (const [label, req] of [["mint", { address: USDC, abi: erc20, functionName: "mint", args: [account.address, amount] }],
  ["approve", { address: USDC, abi: erc20, functionName: "approve", args: [DIAMOND, amount] }],
  ["depositUSDC", { address: DIAMOND, abi: ledger, functionName: "depositUSDC", args: [amount] }]]) {
  const hash = await wallet.writeContract(req);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`${label}: ${hash} status ${r.status}`);
  if (r.status !== "success") process.exit(1);
}
console.log(`deposited ${usdc} test USDC for ${account.address}; it is usable from the next ledger block (a few minutes)`);
