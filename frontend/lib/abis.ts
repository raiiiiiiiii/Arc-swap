import { parseAbi } from "viem";

export const ARCSWAP_ABI = parseAbi([
  "function swap(address tokenIn, uint256 amount) external",
  "function getReserves() external view returns (uint256 usdcReserve, uint256 eurcReserve)",
  "function getUserSwapInfo(address user) external view returns (uint256 swapsUsedToday, uint256 swapsRemaining, uint256 nextResetAt)",
  "function getSwapStats() external view returns (uint256 _totalSwaps, uint256 _uniqueUsers)",
  "function isAdmin(address account) external view returns (bool)",
  "function depositLiquidity(address token, uint256 amount) external",
  "function withdrawLiquidity(address token, uint256 amount, address to) external",
  "function transferReserves(address token, uint256 amount, address to) external",
  "function setDailySwapLimit(uint256 newLimit) external",
  "function setMaxSwapAmount(uint256 newAmount) external",
  "function pause() external",
  "function unpause() external",
  "function dailySwapLimit() external view returns (uint256)",
  "function maxSwapAmount() external view returns (uint256)",
  "function paused() external view returns (bool)",
  "event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp)"
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
]);
