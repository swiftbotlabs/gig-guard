// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Wallet {
    address public owner;
    constructor() { owner = msg.sender; }
    receive() external payable {}
    function run(address module, bytes calldata data) external returns (bytes memory) {
        (bool ok, bytes memory out) = module.delegatecall(data);
        require(ok, "module failed");
        return out;
    }
    function withdraw(uint256 amt) external {
        require(msg.sender == owner, "only owner");
        payable(owner).transfer(amt);
    }
}
