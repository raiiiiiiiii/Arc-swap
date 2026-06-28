import { parseAbi } from "viem";

export const ARCSWAP_ABI = parseAbi([
  // ── Swap ──────────────────────────────────────────────────────────────────
  "function swap(address tokenIn, uint256 amount) external",

  // ── Public Liquidity ─────────────────────────────────────────────────────
  "function addLiquidity(address token, uint256 amount) external",
  "function removeLiquidity(address token, uint256 amount) external",
  "function getLpBalance(address provider) external view returns (uint256 usdcBalance, uint256 eurcBalance)",
  "function getPoolStats() external view returns (uint256 usdcReserve, uint256 eurcReserve, uint256 totalLpUSDC, uint256 totalLpEURC, uint256 totalLpProviders)",

  // ── Views ─────────────────────────────────────────────────────────────────
  "function getReserves() external view returns (uint256 usdcReserve, uint256 eurcReserve)",
  "function getUserSwapInfo(address user) external view returns (uint256 swapsUsedToday, uint256 swapsRemaining, uint256 nextResetAt)",
  "function getSwapStats() external view returns (uint256 _totalSwaps, uint256 _uniqueUsers)",
  "function isAdmin(address account) external view returns (bool)",
  "function dailySwapLimit() external view returns (uint256)",
  "function maxSwapAmount() external view returns (uint256)",
  "function paused() external view returns (bool)",
  "function totalLpProviders() external view returns (uint256)",
  "function lpUSDC(address) external view returns (uint256)",
  "function lpEURC(address) external view returns (uint256)",
  
  // ── Leaderboard ───────────────────────────────────────────────────────────
  "function submitHighScore(uint256 score) external",
  "function getTopScores() external view returns (tuple(address player, uint256 score)[10])",
  "function highScores(address) external view returns (uint256)",

  // ── Admin ─────────────────────────────────────────────────────────────────
  "function depositLiquidity(address token, uint256 amount) external",
  "function withdrawLiquidity(address token, uint256 amount, address to) external",
  "function transferReserves(address token, uint256 amount, address to) external",
  "function setDailySwapLimit(uint256 newLimit) external",
  "function setMaxSwapAmount(uint256 newAmount) external",
  "function pause() external",
  "function unpause() external",

  // ── Events ────────────────────────────────────────────────────────────────
  "event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp)",
  "event PublicLiquidityAdded(address indexed provider, address indexed token, uint256 amount)",
  "event PublicLiquidityRemoved(address indexed provider, address indexed token, uint256 amount)",
  "event HighScoreSubmitted(address indexed player, uint256 score)",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
]);
