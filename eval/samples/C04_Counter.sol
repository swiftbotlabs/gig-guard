// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Counter {
    mapping(address => uint256) public count;
    event Bumped(address indexed who, uint256 n);
    function bump() external { count[msg.sender] += 1; emit Bumped(msg.sender, count[msg.sender]); }
    function reset() external { count[msg.sender] = 0; }
}
