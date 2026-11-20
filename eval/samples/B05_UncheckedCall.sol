// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Payroll {
    address public admin;
    mapping(address => uint256) public owed;
    constructor() payable { admin = msg.sender; }
    function addSalary(address who, uint256 amt) external { require(msg.sender == admin); owed[who] += amt; }
    function payOut(address payable who) external {
        uint256 amt = owed[who];
        owed[who] = 0;
        who.call{value: amt}("");
    }
}
