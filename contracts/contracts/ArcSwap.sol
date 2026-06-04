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
 *         The contract holds liquidity reserves and swaps atomically at a 1:1 rate.
 *         No AMM, no price feeds, no slippage, no routing — just a simple reserve swap.
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
    /// @notice USDC contract address (native gas token on Arc)
    address public immutable USDC;
    /// @notice EURC contract address
    address public immutable EURC;

    // ─── Rate (always 1:1) ───────────────────────────────────────────────────
    uint256 public constant SWAP_RATE = 1; // 1:1 fixed rate

    // ─── Daily Swap Limits ───────────────────────────────────────────────────
    uint256 public dailySwapLimit;
    uint256 public constant DAILY_WINDOW = 24 hours;

    // ─── Per-Swap Amount Limit ───────────────────────────────────────────────
    /// @notice Maximum amount a user can swap in a single transaction (in token decimals)
    uint256 public maxSwapAmount;

    // ─── Per-User Tracking ───────────────────────────────────────────────────
    mapping(address => uint256) public swapCount;
    mapping(address => uint256) public lastWindowStart;

    // ─── Global Stats ────────────────────────────────────────────────────────
    uint256 public totalSwapCount;
    uint256 public totalUniqueUsers;
    mapping(address => bool) public hasSwapped;

    // ─── Custom Errors ───────────────────────────────────────────────────────
    error InvalidToken(address token);
    error InvalidAmount();
    error SwapAmountExceedsLimit(uint256 requested, uint256 limit);
    error InsufficientReserve(address token, uint256 requested, uint256 available);
    error DailyLimitExceeded(address user, uint256 used, uint256 limit);
    error ZeroAddress();
    error IdenticalTokens();
    error NotAdmin();

    // ─── Events ──────────────────────────────────────────────────────────────
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    event LiquidityDeposited(address indexed admin, address indexed token, uint256 amount);
    event LiquidityWithdrawn(address indexed admin, address indexed token, uint256 amount, address indexed to);
    event ReservesTransferred(address indexed admin, address indexed token, uint256 amount, address indexed to);
    event DailySwapLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event MaxSwapAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event AdminRoleGranted(address indexed admin, address indexed account);
    event AdminRoleRevoked(address indexed admin, address indexed account);

    // ─── Constructor ─────────────────────────────────────────────────────────
    /**
     * @param _usdc USDC token address (0x3600000000000000000000000000000000000000 on Arc Testnet)
     * @param _eurc EURC token address (0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a on Arc Testnet)
     * @param _dailySwapLimit Maximum swaps per wallet per 24 hours (default: 2)
     * @param _maxSwapAmount Maximum amount per single swap in token decimals (default: 1_000_000 = 1 USDC)
     */
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

        // Grant DEFAULT_ADMIN_ROLE and ADMIN_ROLE to the deployer
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

    /**
     * @notice Swap USDC → EURC or EURC → USDC at a fixed 1:1 rate.
     * @dev The user must first approve this contract to spend `amount` of `tokenIn`.
     *      The function checks:
     *        1. Token validity
     *        2. Amount > 0
     *        3. Daily swap limit not exceeded
     *        4. Sufficient output reserve
     *      All checks must pass or the transaction reverts without taking any funds.
     * @param tokenIn  The address of the token being sent (USDC or EURC)
     * @param amount   The amount to swap (in token's native decimals, i.e. 6 decimals)
     */
    function swap(
        address tokenIn,
        uint256 amount
    ) external nonReentrant whenNotPaused validToken(tokenIn) {
        // Validate amount
        if (amount == 0) revert InvalidAmount();
        if (amount > maxSwapAmount) revert SwapAmountExceedsLimit(amount, maxSwapAmount);

        // Determine output token
        address tokenOut = (tokenIn == USDC) ? EURC : USDC;

        // ── Daily limit check ─────────────────────────────────────────────
        _resetDailyWindowIfNeeded(msg.sender);
        if (swapCount[msg.sender] >= dailySwapLimit) {
            revert DailyLimitExceeded(msg.sender, swapCount[msg.sender], dailySwapLimit);
        }

        // ── Reserve check BEFORE taking any funds ─────────────────────────
        uint256 outReserve = IERC20(tokenOut).balanceOf(address(this));
        if (outReserve < amount) {
            revert InsufficientReserve(tokenOut, amount, outReserve);
        }

        // ── Update state ──────────────────────────────────────────────────
        unchecked {
            swapCount[msg.sender]++;
            totalSwapCount++;
        }
        if (!hasSwapped[msg.sender]) {
            hasSwapped[msg.sender] = true;
            unchecked { totalUniqueUsers++; }
        }

        // ── Execute swap (pull tokenIn, push tokenOut) ────────────────────
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(tokenOut).safeTransfer(msg.sender, amount);

        emit Swapped(msg.sender, tokenIn, tokenOut, amount, amount, block.timestamp);
    }

    // ─── Daily Window Logic ──────────────────────────────────────────────────

    /**
     * @dev Resets the user's swap count if the 24h window has elapsed.
     */
    function _resetDailyWindowIfNeeded(address user) internal {
        uint256 windowStart = lastWindowStart[user];
        if (windowStart == 0 || block.timestamp >= windowStart + DAILY_WINDOW) {
            swapCount[user] = 0;
            lastWindowStart[user] = block.timestamp;
        }
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns the current USDC and EURC reserves held by the contract.
     */
    function getReserves() external view returns (uint256 usdcReserve, uint256 eurcReserve) {
        usdcReserve = IERC20(USDC).balanceOf(address(this));
        eurcReserve = IERC20(EURC).balanceOf(address(this));
    }

    /**
     * @notice Returns swap usage info for a given user.
     * @return swapsUsedToday    Number of swaps used in the current 24h window.
     * @return swapsRemaining    Remaining swaps in the current 24h window.
     * @return nextResetAt       Unix timestamp when the window resets (0 if no swaps yet).
     */
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

    /**
     * @notice Returns global swap statistics.
     */
    function getSwapStats()
        external
        view
        returns (uint256 _totalSwaps, uint256 _uniqueUsers)
    {
        _totalSwaps = totalSwapCount;
        _uniqueUsers = totalUniqueUsers;
    }

    /**
     * @notice Returns whether an address has the ADMIN_ROLE.
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    /**
     * @notice Deposit liquidity into the contract reserves.
     * @dev Admin must approve the contract before calling.
     * @param token  USDC or EURC
     * @param amount Amount to deposit
     */
    function depositLiquidity(address token, uint256 amount)
        external
        onlyAdmin
        validToken(token)
    {
        if (amount == 0) revert InvalidAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit LiquidityDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw liquidity from the contract reserves to a destination address.
     * @param token  USDC or EURC
     * @param amount Amount to withdraw
     * @param to     Destination address
     */
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

    /**
     * @notice Transfer reserves to another wallet address.
     * @param token  USDC or EURC
     * @param amount Amount to transfer
     * @param to     Recipient address
     */
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

    /**
     * @notice Update the daily swap limit per wallet.
     * @param newLimit New maximum swaps per 24 hours (must be > 0)
     */
    function setDailySwapLimit(uint256 newLimit) external onlyAdmin {
        if (newLimit == 0) revert InvalidAmount();
        uint256 old = dailySwapLimit;
        dailySwapLimit = newLimit;
        emit DailySwapLimitUpdated(old, newLimit);
    }

    /**
     * @notice Update the maximum amount allowed per single swap.
     * @param newAmount New maximum swap amount in token decimals (e.g., 1_000_000 = 1 USDC)
     */
    function setMaxSwapAmount(uint256 newAmount) external onlyAdmin {
        if (newAmount == 0) revert InvalidAmount();
        uint256 old = maxSwapAmount;
        maxSwapAmount = newAmount;
        emit MaxSwapAmountUpdated(old, newAmount);
    }

    /**
     * @notice Grant ADMIN_ROLE to an account.
     * @param account Address to grant the role
     */
    function grantAdminRole(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _grantRole(ADMIN_ROLE, account);
        emit AdminRoleGranted(msg.sender, account);
    }

    /**
     * @notice Revoke ADMIN_ROLE from an account.
     * @param account Address to revoke the role from
     */
    function revokeAdminRole(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        _revokeRole(ADMIN_ROLE, account);
        emit AdminRoleRevoked(msg.sender, account);
    }

    /**
     * @notice Pause all swaps. Emergency use only.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @notice Resume swaps after a pause.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ─── Override supportsInterface ───────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
