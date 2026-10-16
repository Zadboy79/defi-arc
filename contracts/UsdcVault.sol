// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UsdcVault is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant APY_BPS = 500; // 5.00% APY
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    IERC20 public immutable usdc;

    mapping(address => uint256) public balances;
    mapping(address => uint256) private _accruedYield;
    mapping(address => uint256) private _lastAccrualTimestamp;

    uint256 public yieldEarned;
    uint256 private _totalDeposited;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event YieldClaimed(address indexed user, uint256 amount);

    constructor(address _usdc, address initialOwner) Ownable(initialOwner) {
        require(_usdc != address(0), "USDC address is zero");
        usdc = IERC20(_usdc);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        _checkpointYield(msg.sender);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        balances[msg.sender] += amount;
        _totalDeposited += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        _checkpointYield(msg.sender);

        balances[msg.sender] -= amount;
        _totalDeposited -= amount;

        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function claimYield() external {
        _checkpointYield(msg.sender);

        uint256 amount = _accruedYield[msg.sender];
        require(amount > 0, "No yield available");

        _accruedYield[msg.sender] = 0;
        yieldEarned += amount;

        emit YieldClaimed(msg.sender, amount);
    }

    function totalDeposited() external view returns (uint256) {
        return _totalDeposited;
    }

    function pendingYield(address user) external view returns (uint256) {
        return _accruedYield[user] + _pendingYieldSinceLast(user);
    }

    function _checkpointYield(address user) internal {
        uint256 last = _lastAccrualTimestamp[user];

        if (last == 0) {
            _lastAccrualTimestamp[user] = block.timestamp;
            return;
        }

        uint256 pending = _pendingYieldSinceLast(user);
        if (pending > 0) {
            _accruedYield[user] += pending;
        }

        _lastAccrualTimestamp[user] = block.timestamp;
    }

    function _pendingYieldSinceLast(address user) internal view returns (uint256) {
        uint256 principal = balances[user];
        if (principal == 0) {
            return 0;
        }

        uint256 last = _lastAccrualTimestamp[user];
        if (last == 0 || block.timestamp <= last) {
            return 0;
        }

        uint256 elapsed = block.timestamp - last;

        return (principal * APY_BPS * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }
}
