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
    Buffer.from('12', 'hex'),
    Buffer.from('15', 'hex'),
    Buffer.from('20', 'hex'),
    Buffer.from('25', 'hex')
];

let tree = new MerkleTree(items, keccak256);

let proof = tree.generateProof(items[1]);
tree.verifyProof(proof, tree.findLeaf(items[1])); // true
tree.verifyProof(proof, tree.findLeaf(items[0])); // false

tree.root() 
// <Buffer 8c 9f ef 65 d6 b7 e7 73 d3 56 b6 ef cd 62 af 26 ef 51 24 22 f0 f6 16 78 b7 c8 9b 4a 37 6f f3 d3>

// Print tree for debugging (it shows the unhashed leaves on the right)
console.log(tree.toString())

/*
Layer 0 - 
         677034980f47f6cb0a55e7d8674ba838c39165afe34da2fc538f695d4950b38e       12
         33ae796f786efa387ecd29accca89b44e9194cc6689994e4fe5870f88e84e1e8       15
         123aaed9e19ab45afd57abf57eb48ebcdd3940c31f412aceb059602b877e61bf       25
         123aaed9e19ab45afd57abf57eb48ebcdd3940c31f412aceb059602b877e61bf       25
Layer 1 - 
         7e42e1f215cc6f44fa77b0d8e51285787e962eeab58733a1d6ffe703829e50d5
         8ed73d335daaa310ddda00cd4bafa7047fe759d86058c4aef727d02147d9e5cb
Layer 2 - 
         8c9fef65d6b7e773d356b6efcd62af26ef512422f0f61678b7c89b4a376ff3d3
*/
```

### Solidity
```sol
pragma solidity ^0.5.0;

import "typescript-solidity-merkle-tree/contracts/MerkleTreeVerifier.sol";

contract YourContract {
    bytes root = 0x00;
    bytes32[] events;

    function computeState() public {
        root = MerkleTreeVerifier._computeMerkleRoot(events);
    }

    function updateState(bytes32[] proof, bool[] proofPaths, bytes32 leaf) public {
        require(MerkleTreeVerifier._verify(proof, proofPaths, root, leaf) == true, "INVALID_PROOF");
        // allow withdraw, etc.
    }
}
```

Note that if you are using 0x's compiler, you should be aware of naming conflicts if there are other contract files named 'MerkleTreeVerifier.sol'.