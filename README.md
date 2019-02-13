typescript-solidity-merkle-tree
===============================

[![npm version](https://badge.fury.io/js/typescript-solidity-merkle-tree.svg)](https://badge.fury.io/js/typescript-solidity-merkle-tree)

TypeScript Merkle tree that comes with Solidity proof verifier. Unit tested for your pleasure!

 * handles all edge cases: odd numbers of items, empty/duplicates, canonical sorting
 * simple API based on Buffer's - use whatever data type you want, just convert it
 * works well with Ethereum smart contracts, with its accompanying Solidity verifier
 * fixed array allocations (perf++)
 * secure against [second preimage attacks](https://flawed.net.nz/2018/02/21/attacking-merkle-trees-with-a-second-preimage-attack/)

Developed as part of our [cross-chain communications protocol, 0dex](https://github.com/liamzebedee/0dex).

## Usage
### TypeScript
```ts
import { MerkleTree } from 'typescript-solidity-merkle-tree';
import { keccak256 } from 'ethereumjs-util';

let items = [
    Buffer.from('123', 'hex'),
    Buffer.from('foobar')
];

let tree = new MerkleTree(items, keccak256);

let proof = tree.generateProof(items[1]);
tree.verifyProof(proof, tree.findLeaf(items[1])); // true
tree.verifyProof(proof, tree.findLeaf(items[0])); // false

tree.root() // Buffer(aa bb cc)

// Print tree for debugging
console.log(tree.toString())
```

### Solidity
```sol
pragma solidity ^0.5.0;

import "typescript-solidity-merkle-tree/contracts/MerkleTreeVerifier.sol";

contract YourContract {
    bytes root = 0x00;

    function updateState(bytes32[] proof, bytes32 leaf) public {
        require(MerkleTreeVerifier._verify(proof, root, leaf) == true, "INVALID_PROOF");
        // allow withdraw, etc.
    }
}
```

Note that if you are using 0x's compiler, you should be aware of naming conflicts if there are other contract files named 'MerkleTreeVerifier.sol'.