function firstIndexOf(buf: Buffer, arr: Buffer[]) {
  for (let i = 0; i < arr.length; i++) {
    if (buf.equals(arr[i])) {
      return i;
    }
  }

  return -1;
}


// const BLANK_LEAF = new Buffer('0', 'hex');

// Protection against second preimage attacks
// See https://flawed.net.nz/2018/02/21/attacking-merkle-trees-with-a-second-preimage-attack/
const LEAF_PREFIX   = new Buffer('0', 'hex');
const BRANCH_PREFIX = new Buffer('1', 'hex');

class MerkleTree {
  layers: Buffer[][];
  nLayers: number;
  hashFn: (buf: Buffer) => Buffer;

  constructor(items: Buffer[], hashFn: (buf: Buffer) => Buffer) {
    let leaves = items;
    this.hashFn = hashFn;

    // Filter empty
    leaves = leaves.filter(el => el)
    
    // check for duplicates
    leaves.filter((buf, idx) => {
      if(firstIndexOf(buf, leaves) !== idx) throw new Error(`Duplicate item at ${idx}`);
    });

    // sort ASC order
    leaves = leaves.sort().reverse()

    // Make sure it's even
    if(leaves.length % 2 == 1) {
      leaves = [ leaves[0], ...leaves ]
    }
    
    // Now hash all.
    leaves = leaves.map(leaf => this.hashLeaf(leaf))

    // And compute tree
    this.layers = this.computeTree(leaves);
  }

  root(): Buffer {
    if(this.layers[0].length == 0) throw new Error("no leaves in tree");
    return this.layers[this.nLayers - 1][0];
  }

  private hashLeaf(leaf: Buffer) {
    return this.hashFn(Buffer.concat([ LEAF_PREFIX, leaf]))
  }

  private hashBranch(left, right: Buffer) {
    return this.hashFn(Buffer.concat([ BRANCH_PREFIX, left, right ]) )
  }

  generateProof(item: Buffer): Buffer[] {
    let proof: Buffer[] = new Array(this.nLayers - 1);
    
    let idx = firstIndexOf(this.hashLeaf(item), this.layers[0]);

    for(let i = 0; i < this.nLayers - 1; i++) {
      let layer = this.layers[i];

      if(i == this.nLayers - 1) {
        proof[i] = layer[0];
      } else {
        const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
        proof[i] = layer[pairIdx];
        idx = Math.floor(idx / 2);
      }
    }

    return proof
  }

  verifyProof(proof: Buffer[], item: Buffer) {
    // let node = this.hashLeaf(item);
    let node = this.hashLeaf(item);
    if(proof.length != this.nLayers - 1) throw new Error(`${proof.length} proof nodes, but only ${this.nLayers} layers in tree`)

    let dir = node.compare(proof[0]);

    for(let i = 0; i < proof.length; i++) {
      let pairNode = proof[i];

      // console.log(`Verifying layer ${i}`)
      // console.log(`\t`, node)
      // console.log(`\t`, pairNode)
      
      if(dir) {
        node = this.hashBranch(pairNode, node)
      } else {
        node = this.hashBranch(node, pairNode)
      }
    }

    console.log(`Verify root`)
    console.log('\t', this.root())
    console.log('\t', node)

    return this.root().equals(node);
  }

  private computeTree(leaves: Buffer[]) {
    // 0th layer is the leaves
    this.nLayers = Math.ceil(Math.log2(leaves.length)) + 1;
    let layers: Buffer[][] = new Array<Buffer[]>(this.nLayers);

    for(let i = 0; i < this.nLayers; i++) {
      if(i == 0) {
        layers[i] = leaves;
        continue;
      }

      layers[i] = this.computeLayer(layers[i - 1]);
    }
    
    return layers;
  }

  private computeLayer(leaves: Buffer[]): Buffer[] {
    let nodes: Buffer[] = [];
    
    for(let i = 0; i < leaves.length; ) {
      nodes.push(
        this.hashBranch(leaves[i], leaves[i+1])
      );
      i += 2;
    }

    return nodes;
  }
}

function debug(tree: MerkleTree) {
  tree.layers.map((layer, i) => {
    console.log(`Layer ${i} - `)
    for(let node of layer) {
        console.log('\t', node)
    }
  })
}

export { MerkleTree };
