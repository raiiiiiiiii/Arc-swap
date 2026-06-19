// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ArcSwap
 * @notice Fixed 1:1 USDC <> EURC swap contract for Arc Testnet.
 *         Now supports PUBLIC liquidity provision — anyone can deposit and withdraw.
 * @dev Deployed on Arc Testnet (Chain ID: 5042002) where USDC is the native gas token.
 *      USDC:  0x3600000000000000000000000000000000000000
 *      EURC:  0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
 * @author ArcSwap
 */
contract ArcSwap is Ownable, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─── Token Addresses ─────────────────────────────────────────────────────
    address public immutable USDC;
    address public immutable EURC;

    // ─── Rate (always 1:1) ───────────────────────────────────────────────────
    uint256 public constant SWAP_RATE = 1;

    // ─── Daily Swap Limits ───────────────────────────────────────────────────
    uint256 public dailySwapLimit;
    uint256 public constant DAILY_WINDOW = 24 hours;

    // ─── Per-Swap Amount Limit ───────────────────────────────────────────────
    uint256 public maxSwapAmount;

    // ─── Per-User Swap Tracking ──────────────────────────────────────────────
    mapping(address => uint256) public swapCount;
    mapping(address => uint256) public lastWindowStart;

    // ─── Global Stats ────────────────────────────────────────────────────────
    uint256 public totalSwapCount;
    uint256 public totalUniqueUsers;
    mapping(address => bool) public hasSwapped;

    // ─── PUBLIC LP Tracking ──────────────────────────────────────────────────
    /// @notice How much USDC each address has deposited as liquidity
    mapping(address => uint256) public lpUSDC;
    /// @notice How much EURC each address has deposited as liquidity
    mapping(address => uint256) public lpEURC;
    /// @notice Total USDC deposited by public LPs
    uint256 public totalLpUSDC;
    /// @notice Total EURC deposited by public LPs
    uint256 public totalLpEURC;
    /// @notice Total number of unique liquidity providers
    uint256 public totalLpProviders;
    mapping(address => bool) public hasProvidedLiquidity;

    // ─── Custom Errors ───────────────────────────────────────────────────────
    error InvalidToken(address token);
    error InvalidAmount();
    error SwapAmountExceedsLimit(uint256 requested, uint256 limit);
    error InsufficientReserve(address token, uint256 requested, uint256 available);
    error DailyLimitExceeded(address user, uint256 used, uint256 limit);
    error ZeroAddress();
    error IdenticalTokens();
    error NotAdmin();
    error InsufficientLpBalance(address token, uint256 requested, uint256 available);

    // ─── Events ──────────────────────────────────────────────────────────────
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    event PublicLiquidityAdded(address indexed provider, address indexed token, uint256 amount);
    event PublicLiquidityRemoved(address indexed provider, address indexed token, uint256 amount);
    event LiquidityDeposited(address indexed admin, address indexed token, uint256 amount);
    event LiquidityWithdrawn(address indexed admin, address indexed token, uint256 amount, address indexed to);
    event ReservesTransferred(address indexed admin, address indexed token, uint256 amount, address indexed to);
    event DailySwapLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MaxSwapAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event AdminRoleGranted(address indexed admin, address indexed account);
    event AdminRoleRevoked(address indexed admin, address indexed account);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _usdc,
        address _eurc,
        uint256 _dailySwapLimit,
        uint256 _maxSwapAmount
    ) Ownable(msg.sender) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_eurc == address(0)) revert ZeroAddress();
        if (_usdc == _eurc) revert IdenticalTokens();
        if (_dailySwapLimit == 0) revert InvalidAmount();
        if (_maxSwapAmount == 0) revert InvalidAmount();

        USDC = _usdc;
        EURC = _eurc;
        dailySwapLimit = _dailySwapLimit;
        maxSwapAmount = _maxSwapAmount;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) revert NotAdmin();
        _;
    }

    modifier validToken(address token) {
        if (token != USDC && token != EURC) revert InvalidToken(token);
        _;
    }

    // ─── Core Swap Function ──────────────────────────────────────────────────
    function swap(
        address tokenIn,
        uint256 amount
    ) external nonReentrant whenNotPaused validToken(tokenIn) {
        if (amount == 0) revert InvalidAmount();
        if (amount > maxSwapAmount) revert SwapAmountExceedsLimit(amount, maxSwapAmount);

        address tokenOut = (tokenIn == USDC) ? EURC : USDC;

        _resetDailyWindowIfNeeded(msg.sender);
        if (swapCount[msg.sender] >= dailySwapLimit) {
            revert DailyLimitExceeded(msg.sender, swapCount[msg.sender], dailySwapLimit);
        }

        uint256 outReserve = IERC20(tokenOut).balanceOf(address(this));
        if (outReserve < amount) {
            revert InsufficientReserve(tokenOut, amount, outReserve);
        }

        unchecked {
            swapCount[msg.sender]++;
            totalSwapCount++;
        }
        if (!hasSwapped[msg.sender]) {
            hasSwapped[msg.sender] = true;
            unchecked { totalUniqueUsers++; }
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(tokenOut).safeTransfer(msg.sender, amount);

        emit Swapped(msg.sender, tokenIn, tokenOut, amount, amount, block.timestamp);
    }

    // ─── PUBLIC Liquidity Functions ──────────────────────────────────────────

    /**
     * @notice Anyone can add liquidity to the pool.
     * @dev User must approve this contract first.
     * @param token USDC or EURC address
     * @param amount Amount to deposit (6 decimals)
     */
    function addLiquidity(address token, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        validToken(token)
    {
        if (amount == 0) revert InvalidAmount();

        // Track LP balance
        if (token == USDC) {
            lpUSDC[msg.sender] += amount;
            totalLpUSDC += amount;
        } else {
            lpEURC[msg.sender] += amount;
            totalLpEURC += amount;
        }

        // Track unique providers
        if (!hasProvidedLiquidity[msg.sender]) {
            hasProvidedLiquidity[msg.sender] = true;
            unchecked { totalLpProviders++; }
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit PublicLiquidityAdded(msg.sender, token, amount);
    }

    /**
     * @notice Remove your own liquidity from the pool.
     * @param token USDC or EURC address
     * @param amount Amount to withdraw
     */
    function removeLiquidity(address token, uint256 amount)
        external
        nonReentrant
        validToken(token)
    {
        if (amount == 0) revert InvalidAmount();

        // Check user's LP balance
        uint256 userLp = (token == USDC) ? lpUSDC[msg.sender] : lpEURC[msg.sender];
        if (userLp < amount) revert InsufficientLpBalance(token, amount, userLp);

        // Check contract has enough reserve
        uint256 reserve = IERC20(token).balanceOf(address(this));
        if (reserve < amount) revert InsufficientReserve(token, amount, reserve);

        // Update LP tracking
        if (token == USDC) {
            lpUSDC[msg.sender] -= amount;
            totalLpUSDC -= amount;
        } else {
            lpEURC[msg.sender] -= amount;
            totalLpEURC -= amount;
        }

        IERC20(token).safeTransfer(msg.sender, amount);
        emit PublicLiquidityRemoved(msg.sender, token, amount);
    }

    /**
     * @notice Get a user's LP balances for both tokens.
     */
    function getLpBalance(address provider)
        external
        view
        returns (uint256 usdcBalance, uint256 eurcBalance)
    {
        usdcBalance = lpUSDC[provider];
        eurcBalance = lpEURC[provider];
    }

    /**
     * @notice Get pool stats — reserves, total LP deposits, provider count.
     */
    function getPoolStats()
        external
        view
        returns (
            uint256 usdcReserve,
            uint256 eurcReserve,
            uint256 _totalLpUSDC,
            uint256 _totalLpEURC,
            uint256 _totalLpProviders
        )
    {
        usdcReserve = IERC20(USDC).balanceOf(address(this));
        eurcReserve = IERC20(EURC).balanceOf(address(this));
        _totalLpUSDC = totalLpUSDC;
        _totalLpEURC = totalLpEURC;
        _totalLpProviders = totalLpProviders;
    }

    // ─── Daily Window Logic ──────────────────────────────────────────────────
    function _resetDailyWindowIfNeeded(address user) internal {
        uint256 windowStart = lastWindowStart[user];
        if (windowStart == 0 || block.timestamp >= windowStart + DAILY_WINDOW) {
            swapCount[user] = 0;
            lastWindowStart[user] = block.timestamp;
        }
    }

    // ─── View Functions ──────────────────────────────────────────────────────
    function getReserves() external view returns (uint256 usdcReserve, uint256 eurcReserve) {
        usdcReserve = IERC20(USDC).balanceOf(address(this));
        eurcReserve = IERC20(EURC).balanceOf(address(this));
    }

    function getUserSwapInfo(address user)
        external
        view
        returns (
            uint256 swapsUsedToday,
            uint256 swapsRemaining,
            uint256 nextResetAt
        )
    {
        uint256 windowStart = lastWindowStart[user];
        bool windowExpired = (windowStart == 0 || block.timestamp >= windowStart + DAILY_WINDOW);

        if (windowExpired) {
            swapsUsedToday = 0;
            swapsRemaining = dailySwapLimit;
            nextResetAt = block.timestamp + DAILY_WINDOW;
        } else {
            swapsUsedToday = swapCount[user];
            swapsRemaining = dailySwapLimit > swapCount[user]
                ? dailySwapLimit - swapCount[user]
                : 0;
            nextResetAt = windowStart + DAILY_WINDOW;
        }
    }

    function getSwapStats()
        external
        view
        returns (uint256 _totalSwaps, uint256 _uniqueUsers)
    {
        _totalSwaps = totalSwapCount;
        _uniqueUsers = totalUniqueUsers;
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ─── Admin-Only Liquidity Functions ──────────────────────────────────────
    function depositLiquidity(address token, uint256 amount)
        external
        onlyAdmin
        validToken(token)
    {
        if (amount == 0) revert InvalidAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityDeposited(msg.sender, token, amount);
    }

    function withdrawLiquidity(address token, uint256 amount, address to)
        external
        onlyAdmin
        validToken(token)
    {
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert ZeroAddress();
        uint256 reserve = IERC20(token).balanceOf(address(this));
        if (reserve < amount) revert InsufficientReserve(token, amount, reserve);
        IERC20(token).safeTransfer(to, amount);
        emit LiquidityWithdrawn(msg.sender, token, amount, to);
    }

    function transferReserves(address token, uint256 amount, address to)
        external
        onlyAdmin
        validToken(token)
    {
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert ZeroAddress();
        uint256 reserve = IERC20(token).balanceOf(address(this));
        if (reserve < amount) revert InsufficientReserve(token, amount, reserve);
        IERC20(token).safeTransfer(to, amount);
        emit ReservesTransferred(msg.sender, token, amount, to);
    }

    function setDailySwapLimit(uint256 newLimit) external onlyAdmin {
        if (newLimit == 0) revert InvalidAmount();
        uint256 old = dailySwapLimit;
        dailySwapLimit = newLimit;
        emit DailySwapLimitUpdated(old, newLimit);
    }

    function setMaxSwapAmount(uint256 newAmount) external onlyAdmin {
        if (newAmount == 0) revert InvalidAmount();
        uint256 old = maxSwapAmount;
        maxSwapAmount = newAmount;
        emit MaxSwapAmountUpdated(old, newAmount);
    }

    function grantAdminRole(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _grantRole(ADMIN_ROLE, account);
        emit AdminRoleGranted(msg.sender, account);
    }

    function revokeAdminRole(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _revokeRole(ADMIN_ROLE, account);
        emit AdminRoleRevoked(msg.sender, account);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
