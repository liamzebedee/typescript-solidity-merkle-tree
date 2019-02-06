ts-merkle-tree
==============

TypeScript Merkle tree implementation:

 * handles all edge cases: odd numbers of items, empty/duplicates, canonical sorting
 * simple API based on Buffer's - use whatever data type you want, just convert it
 * works well with Ethereum (Solidity verifier coming soon ^TM)
 * fixed array allocations (perf++)
 * secure against [second preimage attacks](https://flawed.net.nz/2018/02/21/attacking-merkle-trees-with-a-second-preimage-attack/)

## Usage
```ts
import { MerkleTree } from 'ts-merkle-tree';
import { keccak256 } from 'ethereumjs-util';

let items = [
    Buffer.from('123', 'hex'),
    Buffer.from('foobar')
];

let tree = new MerkleTree(items, keccak256);

let proof = tree.generateProof(items[1]);
tree.verifyProof(proof, items[1]); // true
tree.verifyProof(proof, items[0]); // false

tree.root() // Buffer(aa bb cc)

// Print tree for debugging
console.log(tree.toString())
```