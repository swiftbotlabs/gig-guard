// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Voucher {
    address public signer;
    constructor(address s) payable { signer = s; }
    function redeem(address payable to, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 h = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(to, amount))));
        require(ecrecover(h, v, r, s) == signer, "bad signature");
        to.transfer(amount);
    }
}
